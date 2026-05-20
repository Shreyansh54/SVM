from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_current_user, require_role
import models
import schemas

router = APIRouter(prefix="/api/stockists", tags=["Stockists"])


@router.post("/", response_model=schemas.StockistOut)
def create_stockist(
    stockist: schemas.StockistCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager"))
):
    db_st = models.Stockist(**stockist.model_dump())
    db.add(db_st)
    db.commit()
    db.refresh(db_st)
    return db_st


@router.get("/", response_model=List[schemas.StockistOut])
def get_stockists(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Stockist).all()


@router.get("/{stockist_id}", response_model=schemas.StockistOut)
def get_stockist(
    stockist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    st = db.query(models.Stockist).filter(models.Stockist.id == stockist_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Stockist not found")
    return st


@router.put("/{stockist_id}", response_model=schemas.StockistOut)
def update_stockist(
    stockist_id: int,
    st_update: schemas.StockistUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager"))
):
    st = db.query(models.Stockist).filter(models.Stockist.id == stockist_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Stockist not found")
    for key, value in st_update.model_dump(exclude_unset=True).items():
        setattr(st, key, value)
    db.commit()
    db.refresh(st)
    return st


@router.delete("/{stockist_id}")
def delete_stockist(
    stockist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager"))
):
    st = db.query(models.Stockist).filter(models.Stockist.id == stockist_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Stockist not found")
    db.delete(st)
    db.commit()
    return {"message": "Stockist deleted"}
