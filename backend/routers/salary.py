from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_current_user, require_role, log_action
import models
import schemas

router = APIRouter(prefix="/api/salary", tags=["Salary"])


@router.post("/calculate", response_model=schemas.SalaryOut)
def calculate_salary(
    req: schemas.SalaryCalculate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "hr"))
):
    # Get employee
    emp = db.query(models.Employee).filter(models.Employee.id == req.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Count attendance for the month
    attendance_records = db.query(models.Attendance).filter(
        models.Attendance.employee_id == req.employee_id
    ).all()

    # Filter by month string match (e.g., "2024-01")
    month_records = [a for a in attendance_records if a.date.strftime("%Y-%m") == req.month]

    days_present = 0
    leaves = 0
    for record in month_records:
        if record.status == "present":
            days_present += 1
        elif record.status == "half-day":
            days_present += 0.5
            leaves += 0.5
        elif record.status == "absent":
            leaves += 1

    # Calculate salary based on days actually present
    base_salary = emp.salary_per_month
    per_day = base_salary / req.working_days
    
    # If attendance records exist, pay for days present only
    # If no attendance records at all, pay full salary (assume all days worked)
    if month_records:
        final_salary = round(per_day * days_present, 2)
    else:
        final_salary = round(base_salary, 2)

    # Check if salary already calculated for this month
    existing = db.query(models.Salary).filter(
        models.Salary.employee_id == req.employee_id,
        models.Salary.month == req.month
    ).first()

    if existing:
        existing.base_salary = base_salary
        existing.leaves_taken = int(leaves)
        existing.final_salary = final_salary
        db.commit()
        db.refresh(existing)
        result = existing
    else:
        db_salary = models.Salary(
            employee_id=req.employee_id,
            month=req.month,
            base_salary=base_salary,
            leaves_taken=int(leaves),
            final_salary=final_salary
        )
        db.add(db_salary)
        db.commit()
        db.refresh(db_salary)
        result = db_salary

    log_action(db, current_user.username, "CALCULATE_SALARY", f"Calculated salary for employee {emp.name} (Month: {req.month}, Final: Rs. {final_salary})")

    return schemas.SalaryOut(
        id=result.id,
        employee_id=result.employee_id,
        month=result.month,
        base_salary=result.base_salary,
        leaves_taken=result.leaves_taken,
        final_salary=result.final_salary,
        employee_name=emp.name
    )


@router.get("/{employee_id}", response_model=List[schemas.SalaryOut])
def get_salary(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    salaries = db.query(models.Salary).filter(
        models.Salary.employee_id == employee_id
    ).all()

    result = []
    for s in salaries:
        emp = db.query(models.Employee).filter(models.Employee.id == s.employee_id).first()
        result.append(schemas.SalaryOut(
            id=s.id,
            employee_id=s.employee_id,
            month=s.month,
            base_salary=s.base_salary,
            leaves_taken=s.leaves_taken,
            final_salary=s.final_salary,
            employee_name=emp.name if emp else None
        ))
    return result
