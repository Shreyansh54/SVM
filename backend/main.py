import os
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                key, val = line.strip().split("=", 1)
                os.environ[key.strip()] = val.strip()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, employees, stockists, products, stock, sales, attendance, salary, dashboard, doctors, export, upload, batches, invoices, audit

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SHREYANSH VOLLORA - Every Step GUIDED BY CARE", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(stockists.router)
app.include_router(products.router)
app.include_router(stock.router)
app.include_router(sales.router)
app.include_router(attendance.router)
app.include_router(salary.router)
app.include_router(dashboard.router)
app.include_router(doctors.router)
app.include_router(export.router)
app.include_router(upload.router)
app.include_router(batches.router)
app.include_router(invoices.router)
app.include_router(audit.router)


@app.get("/")
def root():
    return {"message": "SHREYANSH VOLLORA API is running", "docs": "/docs"}
