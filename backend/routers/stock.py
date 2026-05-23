from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_current_user, require_role
import models
import schemas

router = APIRouter(prefix="/api/stock", tags=["Stock"])


def stock_to_out(s: models.Stock) -> schemas.StockOut:
    return schemas.StockOut(
        id=s.id,
        stockist_id=s.stockist_id,
        product_id=s.product_id,
        batch_id=s.batch_id,
        quantity=s.quantity,
        last_updated=s.last_updated,
        product_name=s.product.name if s.product else None,
        stockist_name=s.stockist.name if s.stockist else None,
        batch_number=s.batch.batch_number if s.batch else None,
        expiry_date=s.batch.expiry_date if s.batch else None,
        batch_status=s.batch.status if s.batch else None,
    )


@router.post("/add", response_model=schemas.StockOut)
def add_stock(
    stock: schemas.StockAdd,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    # Validate stockist and product exist
    stockist = db.query(models.Stockist).filter(models.Stockist.id == stock.stockist_id).first()
    if not stockist:
        raise HTTPException(status_code=404, detail="Stockist not found")
    product = db.query(models.Product).filter(models.Product.id == stock.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Validate batch if provided
    if stock.batch_id:
        batch = db.query(models.Batch).filter(models.Batch.id == stock.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if batch.product_id != stock.product_id:
            raise HTTPException(status_code=400, detail="Batch does not belong to the selected product")
        if batch.status == "recalled":
            raise HTTPException(status_code=400, detail="Cannot add stock for a recalled batch")

    # Check if stock record already exists for this stockist-product-batch combo
    query = db.query(models.Stock).filter(
        models.Stock.stockist_id == stock.stockist_id,
        models.Stock.product_id == stock.product_id,
    )
    if stock.batch_id:
        query = query.filter(models.Stock.batch_id == stock.batch_id)
    else:
        query = query.filter(models.Stock.batch_id == None)
    existing = query.first()

    if existing:
        existing.quantity += stock.quantity
        db.commit()
        db.refresh(existing)
        result = existing
    else:
        db_stock = models.Stock(**stock.model_dump())
        db.add(db_stock)
        db.commit()
        db.refresh(db_stock)
        result = db_stock

    return stock_to_out(result)


@router.get("/{stockist_id}", response_model=List[schemas.StockOut])
def get_stock_by_stockist(
    stockist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    stocks = db.query(models.Stock).filter(models.Stock.stockist_id == stockist_id).all()
    return [stock_to_out(s) for s in stocks]


@router.get("/", response_model=List[schemas.StockOut])
def get_all_stock(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    stocks = db.query(models.Stock).all()
    return [stock_to_out(s) for s in stocks]


@router.put("/update", response_model=schemas.StockOut)
def update_stock(
    stock: schemas.StockUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    query = db.query(models.Stock).filter(
        models.Stock.stockist_id == stock.stockist_id,
        models.Stock.product_id == stock.product_id
    )
    if stock.batch_id:
        query = query.filter(models.Stock.batch_id == stock.batch_id)
    else:
        query = query.filter(models.Stock.batch_id == None)

    existing = query.first()
    if not existing:
        raise HTTPException(status_code=404, detail="Stock record not found")

    existing.quantity = stock.quantity
    db.commit()
    db.refresh(existing)
    return stock_to_out(existing)


@router.put("/{stock_id}", response_model=schemas.StockOut)
def edit_stock(
    stock_id: int,
    stock_edit: schemas.StockEdit,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    stock = db.query(models.Stock).filter(models.Stock.id == stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    stock.quantity = stock_edit.quantity
    db.commit()
    db.refresh(stock)
    return stock_to_out(stock)


@router.delete("/{stock_id}")
def delete_stock(
    stock_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    stock = db.query(models.Stock).filter(models.Stock.id == stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    db.delete(stock)
    db.commit()
    return {"message": "Stock deleted successfully"}
