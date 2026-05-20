from openpyxl import Workbook

# Employees
wb_emp = Workbook()
ws_emp = wb_emp.active
ws_emp.append(['Name', 'Email', 'Phone', 'Salary', 'Joining Date', 'Role'])
ws_emp.append(['John Doe', 'john@company.com', '1234567890', 50000, '2026-05-19', 'employee'])
ws_emp.append(['Jane Smith', 'jane@company.com', '0987654321', 60000, '2026-05-20', 'manager'])
wb_emp.save('employees_template.xlsx')

# Products
wb_prod = Workbook()
ws_prod = wb_prod.active
ws_prod.append(['Name', 'Price', 'Category', 'Generic Name', 'Composition', 'Dosage', 'Packaging', 'Manufacturer', 'HSN Code', 'Schedule Type'])
ws_prod.append(['Paracetamol 500mg', 50.0, 'Tablet', 'Paracetamol', 'Paracetamol IP 500mg', '500mg', '10x10', 'Cipla', '300490', 'OTC'])
ws_prod.append(['Amoxicillin 250mg', 120.0, 'Capsule', 'Amoxicillin', 'Amoxicillin Trihydrate', '250mg', '10x10', 'Sun Pharma', '300490', 'H'])
wb_prod.save('products_template.xlsx')

print("Created templates!")
