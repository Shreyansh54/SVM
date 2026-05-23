from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


# ─── Auth ────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "employee"
    employee_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    employee_id: Optional[int] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    employee_id: Optional[int] = None
    must_change_password: bool


class LoginRequest(BaseModel):
    username: str
    password: str


class ForgotPasswordRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


# ─── Employee ────────────────────────────────────────────
class EmployeeCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    salary_per_month: float
    joining_date: date
    date_of_birth: Optional[date] = None
    role: str = "employee"
    post: Optional[str] = None
    is_active: bool = True


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    salary_per_month: Optional[float] = None
    joining_date: Optional[date] = None
    date_of_birth: Optional[date] = None
    role: Optional[str] = None
    post: Optional[str] = None
    is_active: Optional[bool] = None


class EmployeeOut(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    salary_per_month: float
    joining_date: date
    date_of_birth: Optional[date] = None
    role: str
    post: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


# ─── Stockist ────────────────────────────────────────────
class StockistCreate(BaseModel):
    name: str
    location: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None


class StockistUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None


class StockistOut(BaseModel):
    id: int
    name: str
    location: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Product (Medicine Master) ────────────────────────────
class ProductCreate(BaseModel):
    name: str
    category: Optional[str] = None
    price: float
    generic_name: Optional[str] = None
    composition: Optional[str] = None
    dosage: Optional[str] = None
    packaging: Optional[str] = None
    manufacturer: Optional[str] = None
    hsn_code: Optional[str] = None
    schedule_type: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    generic_name: Optional[str] = None
    composition: Optional[str] = None
    dosage: Optional[str] = None
    packaging: Optional[str] = None
    manufacturer: Optional[str] = None
    hsn_code: Optional[str] = None
    schedule_type: Optional[str] = None


class ProductOut(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    price: float
    generic_name: Optional[str] = None
    composition: Optional[str] = None
    dosage: Optional[str] = None
    packaging: Optional[str] = None
    manufacturer: Optional[str] = None
    hsn_code: Optional[str] = None
    schedule_type: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Batch ───────────────────────────────────────────────
class BatchCreate(BaseModel):
    product_id: int
    batch_number: str
    manufacturing_date: date
    expiry_date: date
    mrp: float
    gst_percentage: float = 12.0
    purchase_price: float = 0.0
    notes: Optional[str] = None


class BatchUpdate(BaseModel):
    batch_number: Optional[str] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    mrp: Optional[float] = None
    gst_percentage: Optional[float] = None
    purchase_price: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class BatchOut(BaseModel):
    id: int
    product_id: int
    batch_number: str
    manufacturing_date: date
    expiry_date: date
    mrp: float
    gst_percentage: float
    purchase_price: float
    status: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    product_name: Optional[str] = None
    days_to_expiry: Optional[int] = None

    class Config:
        from_attributes = True


# ─── Stock ───────────────────────────────────────────────
class StockAdd(BaseModel):
    stockist_id: int
    product_id: int
    batch_id: Optional[int] = None
    quantity: int


class StockUpdate(BaseModel):
    stockist_id: int
    product_id: int
    batch_id: Optional[int] = None
    quantity: int


class StockEdit(BaseModel):
    quantity: int


class StockOut(BaseModel):
    id: int
    stockist_id: int
    product_id: int
    batch_id: Optional[int] = None
    quantity: int
    last_updated: Optional[datetime] = None
    product_name: Optional[str] = None
    stockist_name: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    batch_status: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Sale ────────────────────────────────────────────────
class SaleCreate(BaseModel):
    employee_id: int
    sale_type: str = "stockist"  # "stockist" or "doctor"
    stockist_id: Optional[int] = None
    doctor_id: Optional[int] = None
    product_id: int
    batch_id: Optional[int] = None
    quantity_sold: int
    bonus_quantity: int = 0
    discount_percentage: float = 0.0


class SaleOut(BaseModel):
    id: int
    invoice_number: Optional[str] = None
    sale_order_id: Optional[str] = None
    employee_id: int
    sale_type: str
    stockist_id: Optional[int] = None
    doctor_id: Optional[int] = None
    product_id: int
    batch_id: Optional[int] = None
    quantity_sold: int
    bonus_quantity: int = 0
    gst_rate: float = 5.0
    total_amount: float
    discount_percentage: float
    date: Optional[datetime] = None
    employee_name: Optional[str] = None
    product_name: Optional[str] = None
    stockist_name: Optional[str] = None
    doctor_name: Optional[str] = None
    batch_number: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Bulk / Multi-Product Sale ───────────────────────────
class SaleLineItem(BaseModel):
    """One product row within a multi-product order."""
    product_id: int
    batch_id: Optional[int] = None
    quantity_sold: int
    bonus_quantity: int = 0
    discount_percentage: float = 0.0
    gst_rate: float = 5.0  # default 5% GST


class BulkSaleCreate(BaseModel):
    """Full multi-product order submitted in one shot."""
    employee_id: int
    sale_type: str = "stockist"   # "stockist" or "doctor"
    stockist_id: Optional[int] = None
    doctor_id: Optional[int] = None
    items: List[SaleLineItem]    # must have at least 1 item


# ─── Attendance ──────────────────────────────────────────
class AttendanceCreate(BaseModel):
    employee_id: int
    date: date
    status: str = "present"


class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    date: date
    status: str

    class Config:
        from_attributes = True


# ─── Salary ──────────────────────────────────────────────
class SalaryCalculate(BaseModel):
    employee_id: int
    month: str
    working_days: int = 22


class SalaryOut(BaseModel):
    id: int
    employee_id: int
    month: str
    base_salary: float
    leaves_taken: int
    final_salary: float
    employee_name: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Dashboard ───────────────────────────────────────────
class DashboardSummary(BaseModel):
    total_employees: int
    total_stockists: int
    total_products: int
    total_sales_amount: float
    total_sales_count: int
    low_stock_count: int


class TopEmployee(BaseModel):
    employee_id: int
    employee_name: str
    total_sales: float


class LowStockItem(BaseModel):
    stockist_name: str
    product_name: str
    quantity: int


# ─── Doctor ──────────────────────────────────────────────
class DoctorCreate(BaseModel):
    name: str
    specialization: Optional[str] = None
    hospital: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    gstin: Optional[str] = None


class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    specialization: Optional[str] = None
    hospital: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    gstin: Optional[str] = None


class DoctorOut(BaseModel):
    id: int
    name: str
    specialization: Optional[str] = None
    hospital: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    gstin: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Doctor Prescription ─────────────────────────────────
class DoctorPrescriptionCreate(BaseModel):
    product_id: int
    notes: Optional[str] = None


class DoctorPrescriptionOut(BaseModel):
    id: int
    doctor_id: int
    product_id: int
    notes: Optional[str] = None
    date: Optional[datetime] = None
    doctor_name: Optional[str] = None
    product_name: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Doctor Order ────────────────────────────────────────
class DoctorOrderCreate(BaseModel):
    doctor_id: int
    employee_id: int
    product_id: int
    quantity: int = 1
    notes: Optional[str] = None


class DoctorOrderOut(BaseModel):
    id: int
    doctor_id: int
    employee_id: int
    product_id: int
    quantity: int
    date: Optional[datetime] = None
    notes: Optional[str] = None
    doctor_name: Optional[str] = None
    employee_name: Optional[str] = None
    product_name: Optional[str] = None

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    new_password: str


# ─── Collections ────────────────────────────────────────
class CollectionCreate(BaseModel):
    collection_type: str  # "stockist" or "doctor"
    stockist_id: Optional[int] = None
    doctor_id: Optional[int] = None
    employee_id: Optional[int] = None
    amount: float
    payment_mode: str = "Cash"
    date: date
    remarks: Optional[str] = None


class CollectionUpdate(BaseModel):
    collection_type: Optional[str] = None
    stockist_id: Optional[int] = None
    doctor_id: Optional[int] = None
    employee_id: Optional[int] = None
    amount: Optional[float] = None
    payment_mode: Optional[str] = None
    date: Optional[date] = None
    remarks: Optional[str] = None


class CollectionOut(BaseModel):
    id: int
    collection_type: str
    stockist_id: Optional[int] = None
    doctor_id: Optional[int] = None
    employee_id: Optional[int] = None
    amount: float
    payment_mode: str
    date: date
    remarks: Optional[str] = None
    
    stockist_name: Optional[str] = None
    doctor_name: Optional[str] = None
    employee_name: Optional[str] = None

    class Config:
        from_attributes = True


