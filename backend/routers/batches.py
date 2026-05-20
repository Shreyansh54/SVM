from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, date
from database import get_db
from auth import require_role, get_current_user
import models
import schemas

router = APIRouter(prefix="/api/batches", tags=["Batches"])


def batch_to_out(b: models.Batch) -> schemas.BatchOut:
    """Convert a Batch model to BatchOut with computed fields."""
    days_to_expiry = (b.expiry_date - date.today()).days if b.expiry_date else None
    return schemas.BatchOut(
        id=b.id,
        product_id=b.product_id,
        batch_number=b.batch_number,
        manufacturing_date=b.manufacturing_date,
        expiry_date=b.expiry_date,
        mrp=b.mrp,
        gst_percentage=b.gst_percentage,
        purchase_price=b.purchase_price,
        status=b.status,
        notes=b.notes,
        created_at=b.created_at,
        product_name=b.product.name if b.product else None,
        days_to_expiry=days_to_expiry
    )


@router.post("/", response_model=schemas.BatchOut)
def create_batch(
    batch: schemas.BatchCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    # Validate product exists
    product = db.query(models.Product).filter(models.Product.id == batch.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check unique batch number
    existing = db.query(models.Batch).filter(models.Batch.batch_number == batch.batch_number).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Batch number '{batch.batch_number}' already exists")

    # Validate dates
    if batch.expiry_date <= batch.manufacturing_date:
        raise HTTPException(status_code=400, detail="Expiry date must be after manufacturing date")

    db_batch = models.Batch(**batch.model_dump(), status="active")
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return batch_to_out(db_batch)


@router.get("/", response_model=List[schemas.BatchOut])
def get_batches(
    product_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Batch)
    if product_id:
        query = query.filter(models.Batch.product_id == product_id)
    if status:
        query = query.filter(models.Batch.status == status)
    batches = query.order_by(models.Batch.expiry_date.asc()).all()

    # Auto-mark expired batches
    today = date.today()
    for b in batches:
        if b.status == "active" and b.expiry_date < today:
            b.status = "expired"
    db.commit()

    return [batch_to_out(b) for b in batches]


@router.get("/expiring-soon", response_model=List[schemas.BatchOut])
def get_expiring_batches(
    days: int = 90,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    """Get active batches expiring within N days."""
    cutoff = date.today() + timedelta(days=days)
    batches = db.query(models.Batch).filter(
        models.Batch.status == "active",
        models.Batch.expiry_date <= cutoff,
        models.Batch.expiry_date >= date.today()
    ).order_by(models.Batch.expiry_date.asc()).all()
    return [batch_to_out(b) for b in batches]


@router.get("/{batch_id}", response_model=schemas.BatchOut)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch_to_out(batch)


@router.put("/{batch_id}", response_model=schemas.BatchOut)
def update_batch(
    batch_id: int,
    update: schemas.BatchUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    update_data = update.model_dump(exclude_unset=True)

    # If batch_number changes, ensure uniqueness
    if "batch_number" in update_data:
        existing = db.query(models.Batch).filter(
            models.Batch.batch_number == update_data["batch_number"],
            models.Batch.id != batch_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Batch number already exists")

    for key, value in update_data.items():
        setattr(batch, key, value)
    db.commit()
    db.refresh(batch)
    return batch_to_out(batch)


@router.put("/{batch_id}/recall", response_model=schemas.BatchOut)
def recall_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    """One-click batch recall for compliance."""
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    batch.status = "recalled"
    batch.notes = (batch.notes or "") + f" | RECALLED on {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    db.commit()
    db.refresh(batch)
    return batch_to_out(batch)


@router.delete("/{batch_id}")
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Check if batch has associated stock or sales
    has_stock = db.query(models.Stock).filter(models.Stock.batch_id == batch_id).first()
    has_sales = db.query(models.Sale).filter(models.Sale.batch_id == batch_id).first()
    if has_stock or has_sales:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete batch with existing stock or sales records. Use recall instead."
        )

    db.delete(batch)
    db.commit()
    return {"message": "Batch deleted"}
