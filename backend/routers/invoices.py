from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from fpdf import FPDF
import io
import models

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


class GSTInvoice(FPDF):
    def __init__(self, sale: models.Sale):
        super().__init__()
        self.sale = sale

    def header(self):
        # Company Logo / Name
        self.set_font("Helvetica", "B", 20)
        self.set_text_color(33, 37, 41)
        self.cell(0, 10, "SHREYANSH VOLLORA", align="L", new_x="LMARGIN", new_y="NEXT")
        
        self.set_font("Helvetica", "", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, "123 Health Avenue, Business Park", align="L", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 5, "Mumbai, Maharashtra 400001", align="L", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 5, "GSTIN: 27AAAAA0000A1Z5", align="L", new_x="LMARGIN", new_y="NEXT")
        self.ln(5)

        # Invoice Title
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(33, 37, 41)
        self.cell(0, 10, "TAX INVOICE", align="C", new_x="LMARGIN", new_y="NEXT")
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def footer(self):
        self.set_y(-25)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(2)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 5, "This is a computer generated invoice and does not require a physical signature.", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 5, f"Page {self.page_no()}/{{nb}}", align="C")

    def build_invoice(self):
        self.add_page()
        self.alias_nb_pages()

        # Split info into two columns
        # Left: Billed To
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(33, 37, 41)
        self.cell(100, 6, "Billed To:")
        
        # Right: Invoice Details
        self.cell(90, 6, "Invoice Details:")
        self.ln(6)

        self.set_font("Helvetica", "", 10)
        
        # Billed To Info
        if self.sale.sale_type == "doctor":
            client_name = f"Dr. {self.sale.doctor.name}" if self.sale.doctor else "N/A"
            address = self.sale.doctor.location or "N/A"
            gstin = self.sale.doctor.gstin or "Unregistered"
        else:
            client_name = self.sale.stockist.name if self.sale.stockist else "N/A"
            address = self.sale.stockist.location or "N/A"
            gstin = self.sale.stockist.gstin or "Unregistered"

        # Save Y position
        y_pos = self.get_y()

        self.cell(100, 5, client_name)
        self.cell(40, 5, "Invoice Number:")
        self.set_font("Helvetica", "B", 10)
        self.cell(50, 5, self.sale.invoice_number or f"INV-{self.sale.id:05d}")
        self.ln(5)

        self.set_font("Helvetica", "", 10)
        self.cell(100, 5, address)
        self.cell(40, 5, "Invoice Date:")
        self.cell(50, 5, self.sale.date.strftime("%d-%b-%Y") if self.sale.date else "")
        self.ln(5)

        self.cell(100, 5, f"GSTIN: {gstin}")
        self.cell(40, 5, "Sales Rep:")
        self.cell(50, 5, self.sale.employee.name if self.sale.employee else "")
        self.ln(10)

        # Table Header
        self.set_font("Helvetica", "B", 9)
        self.set_fill_color(240, 240, 240)
        
        cols = [
            ("Item Description", 60),
            ("HSN Code", 25),
            ("Qty", 15),
            ("Bonus", 15),
            ("Rate", 20),
            ("Disc%", 15),
            ("GST%", 15),
            ("Amount", 25)
        ]

        for heading, width in cols:
            self.cell(width, 8, heading, border=1, align="C", fill=True)
        self.ln(8)

        # Table Row
        self.set_font("Helvetica", "", 9)
        
        product = self.sale.product
        batch = self.sale.batch
        
        item_name = product.name if product else "Unknown"
        if batch:
            item_name += f" (Batch: {batch.batch_number})"
            
        hsn = product.hsn_code if product else ""
        qty = str(self.sale.quantity_sold)
        bonus = str(self.sale.bonus_quantity or 0)
        
        if batch:
            rate = batch.mrp
            gst = batch.gst_percentage
        else:
            rate = product.price if product else 0.0
            gst = 12.0 # default if no batch

        disc = self.sale.discount_percentage or 0.0
        
        disc_rate = rate * (1 - (disc/100))
        base_amount = self.sale.quantity_sold * disc_rate
        
        # Calculate GST backwards if base amount is inclusive of GST, 
        # but in standard practice MRP is inclusive, so taxable value = amount / (1 + GST/100)
        taxable_value = base_amount / (1 + (gst/100))
        gst_amount = base_amount - taxable_value
        cgst = gst_amount / 2
        sgst = gst_amount / 2

        self.cell(cols[0][1], 8, item_name[:35], border=1, align="L")
        self.cell(cols[1][1], 8, hsn, border=1, align="C")
        self.cell(cols[2][1], 8, qty, border=1, align="C")
        self.cell(cols[3][1], 8, bonus, border=1, align="C")
        self.cell(cols[4][1], 8, f"{rate:.2f}", border=1, align="R")
        self.cell(cols[5][1], 8, f"{disc:.1f}%", border=1, align="C")
        self.cell(cols[6][1], 8, f"{gst:.1f}%", border=1, align="C")
        self.cell(cols[7][1], 8, f"{base_amount:.2f}", border=1, align="R")
        self.ln(8)

        # Totals Section
        self.ln(5)
        self.set_font("Helvetica", "", 10)
        
        self.set_x(120)
        self.cell(45, 6, "Taxable Value:")
        self.cell(35, 6, f"Rs. {taxable_value:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

        self.set_x(120)
        self.cell(45, 6, f"CGST ({gst/2:.1f}%):")
        self.cell(35, 6, f"Rs. {cgst:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

        self.set_x(120)
        self.cell(45, 6, f"SGST ({gst/2:.1f}%):")
        self.cell(35, 6, f"Rs. {sgst:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

        self.set_x(120)
        self.set_font("Helvetica", "B", 12)
        self.cell(45, 8, "Grand Total:")
        self.cell(35, 8, f"Rs. {base_amount:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")


@router.get("/{sale_id}/pdf")
def download_invoice_pdf(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
        
    # Security: If employee, only download own sales
    if current_user.role == "employee" and sale.employee_id != current_user.employee_id:
        raise HTTPException(status_code=403, detail="Access denied to this invoice")

    pdf = GSTInvoice(sale)
    pdf.build_invoice()

    buf = io.BytesIO(pdf.output())
    buf.seek(0)

    # Return as streaming response
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Invoice_{sale.invoice_number or sale.id}.pdf"'
        }
    )
