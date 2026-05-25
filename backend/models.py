from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, Enum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class RoleEnum(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    employee = "employee"
    hr = "hr"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    half_day = "half-day"


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    phone = Column(String)
    salary_per_month = Column(Float, nullable=False)
    joining_date = Column(Date, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    role = Column(String, default="employee")
    post = Column(String)  # designation: MR, ABM, RSM, etc.
    is_active = Column(Boolean, default=True)

    sales = relationship("Sale", back_populates="employee")
    attendance = relationship("Attendance", back_populates="employee")
    salaries = relationship("Salary", back_populates="employee")
    user = relationship("User", back_populates="employee", uselist=False)


class Stockist(Base):
    __tablename__ = "stockists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String)
    contact_person = Column(String)
    phone = Column(String)
    gstin = Column(String)

    stocks = relationship("Stock", back_populates="stockist")
    sales = relationship("Sale", back_populates="stockist")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String)
    price = Column(Float, nullable=False)  # Legacy generic price
    mrp = Column(Float, default=0.0)       # Maximum Retail Price
    pts = Column(Float, default=0.0)       # Price to Stockist
    ptr = Column(Float, default=0.0)       # Price to Retailer
    generic_name = Column(String)
    composition = Column(String)
    dosage = Column(String)
    packaging = Column(String)
    manufacturer = Column(String)
    hsn_code = Column(String)
    schedule_type = Column(String)  # H, H1, X, OTC, etc.

    stocks = relationship("Stock", back_populates="product")
    sales = relationship("Sale", back_populates="product")
    batches = relationship("Batch", back_populates="product", cascade="all, delete-orphan")


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_number = Column(String, unique=True, nullable=False, index=True)
    manufacturing_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False)
    mrp = Column(Float, nullable=False)
    gst_percentage = Column(Float, default=12.0)
    purchase_price = Column(Float, default=0.0)
    status = Column(String, default="active")  # active, recalled, expired
    notes = Column(String)
    created_at = Column(DateTime, server_default=func.now())

    product = relationship("Product", back_populates="batches")
    stocks = relationship("Stock", back_populates="batch")
    sales = relationship("Sale", back_populates="batch")


class Stock(Base):
    __tablename__ = "stock"

    id = Column(Integer, primary_key=True, index=True)
    stockist_id = Column(Integer, ForeignKey("stockists.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    quantity = Column(Integer, default=0)
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())

    stockist = relationship("Stockist", back_populates="stocks")
    product = relationship("Product", back_populates="stocks")
    batch = relationship("Batch", back_populates="stocks")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    stockist_id = Column(Integer, ForeignKey("stockists.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    sale_type = Column(String, default="stockist")  # stockist or doctor
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    discount_percentage = Column(Float, default=0.0)
    quantity_sold = Column(Integer, nullable=False)
    bonus_quantity = Column(Integer, default=0)  # free units given to stockist or doctor
    gst_rate = Column(Float, default=5.0)         # GST % applied to this sale line
    total_amount = Column(Float, nullable=False)   # amount AFTER discount and INCLUSIVE of GST
    date = Column(DateTime, server_default=func.now())
    sale_order_id = Column(String, nullable=True, index=True)  # groups multi-product line items under one order

    employee = relationship("Employee", back_populates="sales")
    stockist = relationship("Stockist", back_populates="sales")
    product = relationship("Product", back_populates="sales")
    batch = relationship("Batch", back_populates="sales")
    doctor = relationship("Doctor")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, default="present")

    employee = relationship("Employee", back_populates="attendance")


class Salary(Base):
    __tablename__ = "salaries"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    month = Column(String, nullable=False)
    base_salary = Column(Float, nullable=False)
    leaves_taken = Column(Integer, default=0)
    final_salary = Column(Float, nullable=False)

    employee = relationship("Employee", back_populates="salaries")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="employee")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    must_change_password = Column(Boolean, default=True)

    employee = relationship("Employee", back_populates="user")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    specialization = Column(String)
    hospital = Column(String)
    phone = Column(String)
    location = Column(String)
    gstin = Column(String)

    prescriptions = relationship("DoctorPrescription", back_populates="doctor", cascade="all, delete-orphan")
    orders = relationship("DoctorOrder", back_populates="doctor", cascade="all, delete-orphan")


class DoctorPrescription(Base):
    __tablename__ = "doctor_prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    notes = Column(String)
    date = Column(DateTime, server_default=func.now())

    doctor = relationship("Doctor", back_populates="prescriptions")
    product = relationship("Product")


class DoctorOrder(Base):
    __tablename__ = "doctor_orders"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=1)
    date = Column(DateTime, server_default=func.now())
    notes = Column(String)

    doctor = relationship("Doctor", back_populates="orders")
    employee = relationship("Employee")
    product = relationship("Product")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False, index=True)
    details = Column(String)
    timestamp = Column(DateTime, server_default=func.now())


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    collection_type = Column(String, nullable=False)  # "stockist" or "doctor"
    stockist_id = Column(Integer, ForeignKey("stockists.id"), nullable=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)  # MR who collected it
    amount = Column(Float, nullable=False)
    payment_mode = Column(String, default="Cash")  # UPI, Cash, Cheque, Bank Transfer
    date = Column(Date, nullable=False)
    remarks = Column(String, nullable=True)

    stockist = relationship("Stockist")
    doctor = relationship("Doctor")
    employee = relationship("Employee")



