from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_current_user, require_role, log_action
import models
import schemas

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


@router.post("/", response_model=schemas.AttendanceOut)
def mark_attendance(
    att: schemas.AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Employees and managers can only mark their own attendance
    if current_user.role in ["employee", "manager"]:
        if not current_user.employee_id:
            raise HTTPException(status_code=403, detail="Your account is not linked to an employee record")
        att.employee_id = current_user.employee_id

    # Check if employee exists
    emp = db.query(models.Employee).filter(models.Employee.id == att.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check if already marked for this date
    existing = db.query(models.Attendance).filter(
        models.Attendance.employee_id == att.employee_id,
        models.Attendance.date == att.date
    ).first()
    if existing:
        existing.status = att.status
        db.commit()
        db.refresh(existing)
        log_action(db, current_user.username, "MARK_ATTENDANCE", f"Updated attendance for employee ID {att.employee_id} on {att.date} as {att.status}")
        return existing

    db_att = models.Attendance(**att.model_dump())
    db.add(db_att)
    db.commit()
    db.refresh(db_att)
    log_action(db, current_user.username, "MARK_ATTENDANCE", f"Marked attendance for employee ID {att.employee_id} on {att.date} as {att.status}")
    return db_att


@router.get("/{employee_id}", response_model=List[schemas.AttendanceOut])
def get_attendance(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Employees and managers can only see their own attendance
    if current_user.role in ["employee", "manager"] and current_user.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return db.query(models.Attendance).filter(
        models.Attendance.employee_id == employee_id
    ).order_by(models.Attendance.date.desc()).all()
