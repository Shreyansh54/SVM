from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_current_user, require_role, log_action
import models
import schemas

router = APIRouter(prefix="/api/employees", tags=["Employees"])


@router.post("/", response_model=schemas.EmployeeOut)
def create_employee(
    emp: schemas.EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "hr"))
):
    existing = db.query(models.Employee).filter(models.Employee.email == emp.email).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Email '{emp.email}' is already registered to another employee.")

    db_emp = models.Employee(**emp.model_dump())
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    log_action(db, current_user.username, "CREATE_EMPLOYEE", f"Created employee {db_emp.name} (Role: {db_emp.role}, Post: {db_emp.post})")
    return db_emp


@router.get("/", response_model=List[schemas.EmployeeOut])
def get_employees(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager", "hr"))
):
    return db.query(models.Employee).all()


@router.get("/{employee_id}", response_model=schemas.EmployeeOut)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "manager", "hr"))
):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.put("/{employee_id}", response_model=schemas.EmployeeOut)
def update_employee(
    employee_id: int,
    emp_update: schemas.EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "hr"))
):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if emp_update.email:
        existing = db.query(models.Employee).filter(
            models.Employee.email == emp_update.email,
            models.Employee.id != employee_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Email '{emp_update.email}' is already registered to another employee.")

    for key, value in emp_update.model_dump(exclude_unset=True).items():
        setattr(emp, key, value)
        
    # Synchronize linked User account role in DB — match by employee_id OR by name
    user = db.query(models.User).filter(models.User.employee_id == employee_id).first()
    if not user:
        # Fallback: find by username match and link them
        user = db.query(models.User).filter(models.User.username == emp.name).first()
    if user:
        user.role = emp.role
        if user.employee_id is None:
            user.employee_id = employee_id  # Auto-link if missing

    db.commit()
    db.refresh(emp)
    log_action(db, current_user.username, "UPDATE_EMPLOYEE", f"Updated employee {emp.name} (ID: {emp.id}, Role: {emp.role})")
    return emp


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin", "hr"))
):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    emp_name = emp.name
    try:
        # 1. Delete linked User accounts (login credentials)
        associated_users = db.query(models.User).filter(
            (models.User.employee_id == employee_id) |
            (models.User.username == emp.name)
        ).all()
        for user in associated_users:
            db.delete(user)
        db.flush()  # flush user deletions before removing employee FK refs

        # 2. Delete Attendance records
        db.query(models.Attendance).filter(
            models.Attendance.employee_id == employee_id
        ).delete(synchronize_session=False)

        # 3. Delete Salary records
        db.query(models.Salary).filter(
            models.Salary.employee_id == employee_id
        ).delete(synchronize_session=False)

        # 4. Nullify or delete Sales records
        #    Sales has employee_id NOT NULL so we delete them
        db.query(models.Sale).filter(
            models.Sale.employee_id == employee_id
        ).delete(synchronize_session=False)

        # 5. Delete Doctor Orders
        db.query(models.DoctorOrder).filter(
            models.DoctorOrder.employee_id == employee_id
        ).delete(synchronize_session=False)

        # 6. Nullify Collections (employee_id is nullable there)
        db.query(models.Collection).filter(
            models.Collection.employee_id == employee_id
        ).update({"employee_id": None}, synchronize_session=False)

        # 7. Finally delete the employee
        db.delete(emp)
        db.commit()

        log_action(
            db, current_user.username, "DELETE_EMPLOYEE",
            f"Deleted employee {emp_name} (ID: {employee_id}) and all associated records."
        )
        return {"message": f"Employee '{emp_name}' and all associated records deleted successfully."}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
