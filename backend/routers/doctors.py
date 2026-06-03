from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_current_user, require_role
import models
import schemas

router = APIRouter(prefix="/api", tags=["Doctors"])


# ─── Doctor CRUD ─────────────────────────────────────────
@router.post("/doctors", response_model=schemas.DoctorOut)
def create_doctor(
    doctor: schemas.DoctorCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager", "employee"))
):
    db_doc = models.Doctor(**doctor.model_dump())
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return db_doc


@router.get("/doctors", response_model=List[schemas.DoctorOut])
def get_doctors(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Doctor).all()


@router.get("/doctors/{doctor_id}", response_model=schemas.DoctorOut)
def get_doctor(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager", "employee"))
):
    doc = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doc


@router.put("/doctors/{doctor_id}", response_model=schemas.DoctorOut)
def update_doctor(
    doctor_id: int,
    update: schemas.DoctorUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager", "employee"))
):
    doc = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(doc, key, value)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/doctors/{doctor_id}")
def delete_doctor(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager"))
):
    doc = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    db.delete(doc)
    db.commit()
    return {"message": "Doctor deleted"}


# ─── Prescriptions ───────────────────────────────────────
@router.post("/doctors/{doctor_id}/prescriptions", response_model=schemas.DoctorPrescriptionOut)
def add_prescription(
    doctor_id: int,
    presc: schemas.DoctorPrescriptionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager"))
):
    doc = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    product = db.query(models.Product).filter(models.Product.id == presc.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db_presc = models.DoctorPrescription(
        doctor_id=doctor_id,
        product_id=presc.product_id,
        notes=presc.notes
    )
    db.add(db_presc)
    db.commit()
    db.refresh(db_presc)

    return schemas.DoctorPrescriptionOut(
        id=db_presc.id, doctor_id=db_presc.doctor_id, product_id=db_presc.product_id,
        notes=db_presc.notes, date=db_presc.date,
        doctor_name=doc.name, product_name=product.name
    )


@router.get("/doctors/{doctor_id}/prescriptions", response_model=List[schemas.DoctorPrescriptionOut])
def get_prescriptions(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager"))
):
    prescs = db.query(models.DoctorPrescription).filter(
        models.DoctorPrescription.doctor_id == doctor_id
    ).all()
    return [
        schemas.DoctorPrescriptionOut(
            id=p.id, doctor_id=p.doctor_id, product_id=p.product_id,
            notes=p.notes, date=p.date,
            doctor_name=p.doctor.name if p.doctor else None,
            product_name=p.product.name if p.product else None
        ) for p in prescs
    ]


# ─── Doctor Orders ───────────────────────────────────────
@router.post("/doctor-orders", response_model=schemas.DoctorOrderOut)
def create_doctor_order(
    order: schemas.DoctorOrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager"))
):
    doc = db.query(models.Doctor).filter(models.Doctor.id == order.doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    emp = db.query(models.Employee).filter(models.Employee.id == order.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    product = db.query(models.Product).filter(models.Product.id == order.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db_order = models.DoctorOrder(**order.model_dump())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    return schemas.DoctorOrderOut(
        id=db_order.id, doctor_id=db_order.doctor_id, employee_id=db_order.employee_id,
        product_id=db_order.product_id, quantity=db_order.quantity,
        date=db_order.date, notes=db_order.notes,
        doctor_name=doc.name, employee_name=emp.name, product_name=product.name
    )


@router.get("/doctor-orders", response_model=List[schemas.DoctorOrderOut])
def get_doctor_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager"))
):
    orders = db.query(models.DoctorOrder).all()
    return [
        schemas.DoctorOrderOut(
            id=o.id, doctor_id=o.doctor_id, employee_id=o.employee_id,
            product_id=o.product_id, quantity=o.quantity,
            date=o.date, notes=o.notes,
            doctor_name=o.doctor.name if o.doctor else None,
            employee_name=o.employee.name if o.employee else None,
            product_name=o.product.name if o.product else None
        ) for o in orders
    ]


@router.get("/doctor-orders/doctor/{doctor_id}", response_model=List[schemas.DoctorOrderOut])
def get_orders_by_doctor(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager"))
):
    orders = db.query(models.DoctorOrder).filter(models.DoctorOrder.doctor_id == doctor_id).all()
    return [
        schemas.DoctorOrderOut(
            id=o.id, doctor_id=o.doctor_id, employee_id=o.employee_id,
            product_id=o.product_id, quantity=o.quantity,
            date=o.date, notes=o.notes,
            doctor_name=o.doctor.name if o.doctor else None,
            employee_name=o.employee.name if o.employee else None,
            product_name=o.product.name if o.product else None
        ) for o in orders
    ]


@router.get("/doctor-orders/employee/{employee_id}", response_model=List[schemas.DoctorOrderOut])
def get_orders_by_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager"))
):
    orders = db.query(models.DoctorOrder).filter(models.DoctorOrder.employee_id == employee_id).all()
    return [
        schemas.DoctorOrderOut(
            id=o.id, doctor_id=o.doctor_id, employee_id=o.employee_id,
            product_id=o.product_id, quantity=o.quantity,
            date=o.date, notes=o.notes,
            doctor_name=o.doctor.name if o.doctor else None,
            employee_name=o.employee.name if o.employee else None,
            product_name=o.product.name if o.product else None
        ) for o in orders
    ]
