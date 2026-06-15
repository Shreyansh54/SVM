import sys
import os

# Add backend to path so we can import modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

import models
from database import SessionLocal

db = SessionLocal()

# Enable foreign keys in SQLite
db.execute(__import__('sqlalchemy').text("PRAGMA foreign_keys = ON"))

try:
    # 1. Create a dummy employee
    emp = models.Employee(
        name="Test Employee",
        email="test_emp@example.com",
        salary_per_month=1000.0,
        joining_date=__import__('datetime').date.today(),
        role="employee"
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    print(f"Created employee: {emp.id}, {emp.name}")

    # 2. Create a dummy collection referencing the employee
    coll = models.Collection(
        collection_type="doctor",
        amount=500.0,
        payment_mode="Cash",
        date=__import__('datetime').date.today(),
        employee_id=emp.id
    )
    db.add(coll)
    db.commit()
    db.refresh(coll)
    print(f"Created collection: {coll.id}, employee_id={coll.employee_id}")

    # 3. Perform the delete sequence
    print("Attempting delete sequence...")
    # Nullify collections
    db.query(models.Collection).filter(
        models.Collection.employee_id == emp.id
    ).update({"employee_id": None}, synchronize_session=False)

    # Finally delete the employee
    db.delete(emp)
    db.commit()
    print("Employee deleted successfully!")

except Exception as e:
    db.rollback()
    print("ERROR OCCURRED:")
    import traceback
    traceback.print_exc()

finally:
    # Clean up test data if still there
    try:
        db.query(models.Collection).filter(models.Collection.amount == 500.0).delete()
        db.query(models.Employee).filter(models.Employee.email == "test_emp@example.com").delete()
        db.commit()
    except:
        pass
    db.close()
