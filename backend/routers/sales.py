from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import datetime
from database import get_db
from auth import get_current_user, require_role
import models
import schemas

router = APIRouter(prefix="/api/sales", tags=["Sales"])


def sale_to_out(s: models.Sale) -> schemas.SaleOut:
    return schemas.SaleOut(
        id=s.id, employee_id=s.employee_id,
        invoice_number=s.invoice_number,
        sale_type=s.sale_type or "stockist",
        stockist_id=s.stockist_id,
        doctor_id=s.doctor_id,
        product_id=s.product_id, batch_id=s.batch_id,
        quantity_sold=s.quantity_sold, bonus_quantity=s.bonus_quantity or 0,
        total_amount=s.total_amount,
        discount_percentage=s.discount_percentage or 0.0,
        date=s.date,
        employee_name=s.employee.name if s.employee else None,
        product_name=s.product.name if s.product else None,
        stockist_name=s.stockist.name if s.stockist else None,
        doctor_name=s.doctor.name if s.doctor else None,
        batch_number=s.batch.batch_number if s.batch else None,
    )


@router.post("/", response_model=schemas.SaleOut)
def create_sale(
    sale: schemas.SaleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # If employee role, force employee_id to their own linked employee
    if current_user.role == "employee":
        if not current_user.employee_id:
            raise HTTPException(status_code=403, detail="Your account is not linked to an employee record")
        sale.employee_id = current_user.employee_id

    # Validate employee
    employee = db.query(models.Employee).filter(models.Employee.id == sale.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Validate product
    product = db.query(models.Product).filter(models.Product.id == sale.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Validate sale channel
    sale_type = sale.sale_type or "stockist"
    if sale_type not in ("stockist", "doctor"):
        raise HTTPException(status_code=400, detail="sale_type must be 'stockist' or 'doctor'")

    if sale_type == "stockist":
        if not sale.stockist_id:
            raise HTTPException(status_code=400, detail="stockist_id required for stockist sale")
        stockist = db.query(models.Stockist).filter(models.Stockist.id == sale.stockist_id).first()
        if not stockist:
            raise HTTPException(status_code=404, detail="Stockist not found")
    elif sale_type == "doctor":
        if not sale.doctor_id:
            raise HTTPException(status_code=400, detail="doctor_id required for doctor sale")
        doctor = db.query(models.Doctor).filter(models.Doctor.id == sale.doctor_id).first()
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")

    # Validate batch if provided
    batch = None
    if sale.batch_id:
        batch = db.query(models.Batch).filter(models.Batch.id == sale.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if batch.status == "recalled":
            raise HTTPException(status_code=400, detail="Cannot sell from a recalled batch")
        if batch.status == "expired":
            raise HTTPException(status_code=400, detail="Cannot sell from an expired batch")

    # Check stock availability (only for stockist sales — doctor sales are direct)
    if sale_type == "stockist":
        stock_query = db.query(models.Stock).filter(
            models.Stock.stockist_id == sale.stockist_id,
            models.Stock.product_id == sale.product_id
        )
        if sale.batch_id:
            stock_query = stock_query.filter(models.Stock.batch_id == sale.batch_id)
        stock = stock_query.first()
        if not stock or stock.quantity < sale.quantity_sold:
            raise HTTPException(status_code=400, detail="Insufficient stock at this stockist")
        # Deduct stock for stockist sales
        stock.quantity -= sale.quantity_sold

    # Calculate price
    if sale.batch_id and batch:
        unit_price = batch.mrp
    else:
        unit_price = product.price

    # Apply discount for doctor sales
    discount = max(0, min(100, sale.discount_percentage or 0))
    if discount > 0:
        discounted_price = unit_price * (1 - discount / 100)
    else:
        discounted_price = unit_price

    total_amount = sale.quantity_sold * discounted_price

    # Create sale
    bonus = max(0, sale.bonus_quantity or 0) if sale_type == "doctor" else 0
    db_sale = models.Sale(
        employee_id=sale.employee_id,
        sale_type=sale_type,
        stockist_id=sale.stockist_id if sale_type == "stockist" else None,
        doctor_id=sale.doctor_id if sale_type == "doctor" else None,
        product_id=sale.product_id,
        batch_id=sale.batch_id,
        quantity_sold=sale.quantity_sold,
        bonus_quantity=bonus,
        discount_percentage=discount,
        total_amount=total_amount
    )
    db.add(db_sale)
    db.flush()  # To get the ID before committing
    current_month = datetime.now().strftime("%Y%m")
    db_sale.invoice_number = f"INV-{current_month}-{db_sale.id:05d}"
    db.commit()
    db.refresh(db_sale)
    return sale_to_out(db_sale)


@router.get("/", response_model=List[schemas.SaleOut])
def get_all_sales(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role == "employee":
        if not current_user.employee_id:
            return []
        sales = db.query(models.Sale).filter(models.Sale.employee_id == current_user.employee_id).all()
    else:
        sales = db.query(models.Sale).all()
    return [sale_to_out(s) for s in sales]


@router.get("/employee/{employee_id}", response_model=List[schemas.SaleOut])
def get_sales_by_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role == "employee" and current_user.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Access denied")
    sales = db.query(models.Sale).filter(models.Sale.employee_id == employee_id).all()
    return [sale_to_out(s) for s in sales]


@router.get("/stockist/{stockist_id}", response_model=List[schemas.SaleOut])
def get_sales_by_stockist(
    stockist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager"))
):
    sales = db.query(models.Sale).filter(models.Sale.stockist_id == stockist_id).all()
    return [sale_to_out(s) for s in sales]


@router.get("/monthly")
def get_monthly_sales(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    now = datetime.now()
    query = db.query(models.Sale).filter(
        extract('year', models.Sale.date) == now.year
    )
    if current_user.role == "employee" and current_user.employee_id:
        query = query.filter(models.Sale.employee_id == current_user.employee_id)

    sales = query.all()
    monthly = {}
    for s in sales:
        month_key = s.date.strftime("%Y-%m") if s.date else "unknown"
        if month_key not in monthly:
            monthly[month_key] = {"month": month_key, "total_amount": 0, "total_count": 0}
        monthly[month_key]["total_amount"] += s.total_amount
        monthly[month_key]["total_count"] += 1
    return list(monthly.values())
