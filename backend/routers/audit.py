from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth import require_role
import models

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])


@router.get("/")
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    # Retrieve audit logs ordered by timestamp descending
    logs = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).all()
    return logs
