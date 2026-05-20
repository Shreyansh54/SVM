from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import datetime, timedelta
from database import get_db
from auth import get_current_user
import models
import schemas

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

LOW_STOCK_THRESHOLD = 500


@router.get("/summary", response_model=schemas.DashboardSummary)
def get_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    total_employees = db.query(models.Employee).filter(models.Employee.is_active == True).count()
    total_stockists = db.query(models.Stockist).count()
    total_products = db.query(models.Product).count()

    sales_agg = db.query(
        func.coalesce(func.sum(models.Sale.total_amount), 0),
        func.count(models.Sale.id)
    ).first()

    low_stock = db.query(models.Stock).filter(models.Stock.quantity < LOW_STOCK_THRESHOLD).count()

    return schemas.DashboardSummary(
        total_employees=total_employees,
        total_stockists=total_stockists,
        total_products=total_products,
        total_sales_amount=float(sales_agg[0]),
        total_sales_count=sales_agg[1],
        low_stock_count=low_stock
    )


@router.get("/top-employee", response_model=List[schemas.TopEmployee])
def get_top_employees(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    results = db.query(
        models.Sale.employee_id,
        models.Employee.name,
        func.sum(models.Sale.total_amount).label("total_sales")
    ).join(
        models.Employee, models.Sale.employee_id == models.Employee.id
    ).group_by(
        models.Sale.employee_id, models.Employee.name
    ).order_by(
        func.sum(models.Sale.total_amount).desc()
    ).limit(5).all()

    return [
        schemas.TopEmployee(
            employee_id=r[0],
            employee_name=r[1],
            total_sales=float(r[2])
        ) for r in results
    ]


@router.get("/low-stock", response_model=List[schemas.LowStockItem])
def get_low_stock(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    stocks = db.query(models.Stock).filter(
        models.Stock.quantity < LOW_STOCK_THRESHOLD
    ).all()

    return [
        schemas.LowStockItem(
            stockist_name=s.stockist.name if s.stockist else "Unknown",
            product_name=s.product.name if s.product else "Unknown",
            quantity=s.quantity
        ) for s in stocks
    ]


# ─── AI Insights Endpoint ────────────────────────────────
@router.get("/insights")
def get_insights(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Generate smart, logic-based business insights."""
    insights = []
    now = datetime.now()

    # 1. Sales trend analysis — compare this month vs last month
    this_month_sales = db.query(func.coalesce(func.sum(models.Sale.total_amount), 0)).filter(
        extract('year', models.Sale.date) == now.year,
        extract('month', models.Sale.date) == now.month
    ).scalar()

    last_month = now.replace(day=1) - timedelta(days=1)
    last_month_sales = db.query(func.coalesce(func.sum(models.Sale.total_amount), 0)).filter(
        extract('year', models.Sale.date) == last_month.year,
        extract('month', models.Sale.date) == last_month.month
    ).scalar()

    if last_month_sales and last_month_sales > 0:
        change_pct = ((float(this_month_sales) - float(last_month_sales)) / float(last_month_sales)) * 100
        if change_pct < -20:
            insights.append({
                "type": "warning",
                "icon": "📉",
                "title": "Sales Drop Alert",
                "message": f"Sales dropped by {abs(change_pct):.0f}% this month (₹{float(this_month_sales):,.0f}) compared to last month (₹{float(last_month_sales):,.0f})"
            })
        elif change_pct < 0:
            insights.append({
                "type": "info",
                "icon": "📊",
                "title": "Slight Sales Decline",
                "message": f"Sales are down {abs(change_pct):.0f}% from last month. Consider reviewing your sales strategy."
            })
        elif change_pct > 20:
            insights.append({
                "type": "success",
                "icon": "🚀",
                "title": "Sales Surge!",
                "message": f"Sales are up {change_pct:.0f}% this month! Great performance by the team."
            })
        elif change_pct > 0:
            insights.append({
                "type": "success",
                "icon": "📈",
                "title": "Steady Growth",
                "message": f"Sales increased by {change_pct:.0f}% compared to last month. Keep it up!"
            })

    # 2. Low stock alerts with specific stockist+product
    low_stocks = db.query(models.Stock).filter(models.Stock.quantity < LOW_STOCK_THRESHOLD).all()
    for s in low_stocks[:3]:  # Top 3 most critical
        stockist_name = s.stockist.name if s.stockist else "Unknown"
        product_name = s.product.name if s.product else "Unknown"
        insights.append({
            "type": "warning",
            "icon": "📦",
            "title": "Low Stock Alert",
            "message": f"{stockist_name} is running low on {product_name} — only {s.quantity} units left"
        })

    # 3. Underperforming employees (no sales this month)
    all_active_emps = db.query(models.Employee).filter(models.Employee.is_active == True).all()
    employees_with_sales = db.query(models.Sale.employee_id).filter(
        extract('year', models.Sale.date) == now.year,
        extract('month', models.Sale.date) == now.month
    ).distinct().all()
    emp_ids_with_sales = {r[0] for r in employees_with_sales}

    for emp in all_active_emps:
        if emp.role == 'employee' and emp.id not in emp_ids_with_sales:
            insights.append({
                "type": "info",
                "icon": "👤",
                "title": "Employee Needs Attention",
                "message": f"{emp.name} has no sales recorded this month. Check in with them."
            })

    # 4. Salary processing reminder
    salaries_this_month = db.query(models.Salary).filter(
        models.Salary.month == now.strftime("%Y-%m")
    ).count()
    active_emp_count = len(all_active_emps)
    if active_emp_count > 0 and salaries_this_month < active_emp_count:
        pending = active_emp_count - salaries_this_month
        insights.append({
            "type": "info",
            "icon": "💰",
            "title": "Salary Processing Pending",
            "message": f"{pending} employee(s) salary not yet processed for {now.strftime('%B %Y')}"
        })

    # 5. Attendance alert — employees with excessive absences this month
    attendance_records = db.query(
        models.Attendance.employee_id,
        models.Employee.name,
        func.count(models.Attendance.id).label("absent_count")
    ).join(models.Employee).filter(
        extract('year', models.Attendance.date) == now.year,
        extract('month', models.Attendance.date) == now.month,
        models.Attendance.status == "absent"
    ).group_by(models.Attendance.employee_id, models.Employee.name).all()

    for rec in attendance_records:
        if rec.absent_count >= 3:
            insights.append({
                "type": "warning",
                "icon": "⚠️",
                "title": "Excessive Absences",
                "message": f"{rec.name} has been absent {rec.absent_count} days this month"
            })

    # 6. Batch expiry alerts
    from datetime import date as date_type
    today = date_type.today()

    # Batches expiring within 30 days
    expiring_30 = db.query(models.Batch).filter(
        models.Batch.status == "active",
        models.Batch.expiry_date <= today + timedelta(days=30),
        models.Batch.expiry_date >= today
    ).all()
    for b in expiring_30:
        days_left = (b.expiry_date - today).days
        product_name = b.product.name if b.product else "Unknown"
        insights.append({
            "type": "danger" if days_left <= 7 else "warning",
            "icon": "⏰" if days_left <= 7 else "📅",
            "title": "Batch Expiring Soon!" if days_left <= 7 else "Batch Expiry Warning",
            "message": f"Batch {b.batch_number} ({product_name}) expires in {days_left} day(s) — {b.expiry_date.strftime('%d %b %Y')}"
        })

    # Already expired batches still marked active
    expired_active = db.query(models.Batch).filter(
        models.Batch.status == "active",
        models.Batch.expiry_date < today
    ).all()
    for b in expired_active:
        b.status = "expired"
        product_name = b.product.name if b.product else "Unknown"
        insights.append({
            "type": "danger",
            "icon": "🚫",
            "title": "Batch Expired",
            "message": f"Batch {b.batch_number} ({product_name}) expired on {b.expiry_date.strftime('%d %b %Y')} — auto-marked as expired"
        })
    if expired_active:
        db.commit()

    # 7. Recalled batches
    recalled = db.query(models.Batch).filter(models.Batch.status == "recalled").count()
    if recalled > 0:
        insights.append({
            "type": "danger",
            "icon": "🔴",
            "title": "Active Recalls",
            "message": f"{recalled} batch(es) currently under recall. Review and clear stock immediately."
        })

    # 8. No data yet — encourage setup
    if not insights:
        insights.append({
            "type": "info",
            "icon": "✨",
            "title": "Getting Started",
            "message": "Add employees, products, and stockists to start seeing AI-powered insights here!"
        })

    return insights


# ─── Medicine Analytics ──────────────────────────────────
@router.get("/top-medicines")
def get_top_medicines(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Top-selling medicines by total quantity sold."""
    results = db.query(
        models.Sale.product_id,
        models.Product.name,
        models.Product.generic_name,
        models.Product.category,
        models.Product.manufacturer,
        func.sum(models.Sale.quantity_sold).label("total_qty"),
        func.sum(models.Sale.total_amount).label("total_revenue"),
        func.count(models.Sale.id).label("order_count")
    ).join(
        models.Product, models.Sale.product_id == models.Product.id
    ).group_by(
        models.Sale.product_id, models.Product.name,
        models.Product.generic_name, models.Product.category,
        models.Product.manufacturer
    ).order_by(
        func.sum(models.Sale.quantity_sold).desc()
    ).limit(limit).all()

    return [
        {
            "product_id": r[0],
            "medicine_name": r[1],
            "generic_name": r[2],
            "category": r[3],
            "manufacturer": r[4],
            "total_qty_sold": int(r[5]),
            "total_revenue": float(r[6]),
            "order_count": int(r[7])
        } for r in results
    ]


@router.get("/least-medicines")
def get_least_medicines(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Least-selling medicines by total quantity sold."""
    # Get products that have at least 1 sale
    results = db.query(
        models.Sale.product_id,
        models.Product.name,
        models.Product.generic_name,
        models.Product.category,
        models.Product.manufacturer,
        func.sum(models.Sale.quantity_sold).label("total_qty"),
        func.sum(models.Sale.total_amount).label("total_revenue"),
        func.count(models.Sale.id).label("order_count")
    ).join(
        models.Product, models.Sale.product_id == models.Product.id
    ).group_by(
        models.Sale.product_id, models.Product.name,
        models.Product.generic_name, models.Product.category,
        models.Product.manufacturer
    ).order_by(
        func.sum(models.Sale.quantity_sold).asc()
    ).limit(limit).all()

    # Also get products with zero sales
    products_with_sales = db.query(models.Sale.product_id).distinct().all()
    sold_ids = {r[0] for r in products_with_sales}
    zero_sales = db.query(models.Product).filter(
        ~models.Product.id.in_(sold_ids) if sold_ids else True
    ).limit(limit).all()

    output = [
        {
            "product_id": p.id,
            "medicine_name": p.name,
            "generic_name": p.generic_name,
            "category": p.category,
            "manufacturer": p.manufacturer,
            "total_qty_sold": 0,
            "total_revenue": 0.0,
            "order_count": 0
        } for p in zero_sales
    ]

    output += [
        {
            "product_id": r[0],
            "medicine_name": r[1],
            "generic_name": r[2],
            "category": r[3],
            "manufacturer": r[4],
            "total_qty_sold": int(r[5]),
            "total_revenue": float(r[6]),
            "order_count": int(r[7])
        } for r in results
    ]

    return output[:limit]


@router.get("/birthdays")
def get_birthdays(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Returns employees with birthdays today and upcoming in the next 7 days."""
    from datetime import date
    today = date.today()
    
    all_employees = db.query(models.Employee).filter(
        models.Employee.is_active == True,
        models.Employee.date_of_birth != None
    ).all()
    
    today_birthdays = []
    upcoming_birthdays = []
    
    for emp in all_employees:
        dob = emp.date_of_birth
        # Birthday this year (ignore year)
        try:
            birthday_this_year = dob.replace(year=today.year)
        except ValueError:
            # Feb 29 on non-leap year
            birthday_this_year = dob.replace(year=today.year, day=28)
        
        delta = (birthday_this_year - today).days
        
        if delta == 0:
            today_birthdays.append({
                "id": emp.id,
                "name": emp.name,
                "role": emp.role,
                "post": emp.post,
                "date_of_birth": str(emp.date_of_birth),
                "days_until": 0
            })
        elif 1 <= delta <= 7:
            upcoming_birthdays.append({
                "id": emp.id,
                "name": emp.name,
                "role": emp.role,
                "post": emp.post,
                "date_of_birth": str(emp.date_of_birth),
                "days_until": delta
            })
    
    upcoming_birthdays.sort(key=lambda x: x["days_until"])
    
    return {
        "today": today_birthdays,
        "upcoming": upcoming_birthdays
    }
