import os
import secrets
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database import get_db
from auth import get_password_hash, verify_password, create_access_token, log_action, get_current_user
import models
import schemas

router = APIRouter(prefix="/api", tags=["Auth"])

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
_backend_raw         = os.getenv("BACKEND_URL", "https://shreyansh-vollora-backend.onrender.com")
_frontend_raw        = os.getenv("FRONTEND_URL", "https://svm-xi.vercel.app")
BACKEND_URL          = _backend_raw if _backend_raw.startswith("http") else f"https://{_backend_raw}"
FRONTEND_URL         = _frontend_raw if _frontend_raw.startswith("http") else f"https://{_frontend_raw}"
GOOGLE_REDIRECT_URI  = f"{BACKEND_URL}/api/auth/google/callback"


@router.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        is_orphan = False
        if existing.role != "admin":
            if existing.employee_id is None:
                is_orphan = True
            else:
                emp_exists = db.query(models.Employee).filter(models.Employee.id == existing.employee_id).first()
                if not emp_exists:
                    is_orphan = True
        
        if is_orphan:
            db.delete(existing)
            db.commit()
        else:
            raise HTTPException(status_code=400, detail="Username already exists")

    # Always auto-link to employee record by matching name
    # Role is ALWAYS taken from the employee record (set by admin/HR) — not from the register form
    emp_id = user.employee_id
    final_role = user.role  # fallback if no employee found

    emp = db.query(models.Employee).filter(models.Employee.name == user.username).first()
    if emp:
        emp_id = emp.id
        final_role = emp.role  # Use the role admin/HR set in the employee profile

    db_user = models.User(
        username=user.username,
        password_hash=get_password_hash(user.password),
        role=final_role,
        employee_id=emp_id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    log_action(db, db_user.username, "USER_REGISTER", f"User account registered successfully (Role: {db_user.role})")
    return db_user


@router.post("/login", response_model=schemas.Token)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Pure admin accounts (role=admin, no employee_id) bypass employee record check
    if user.role == "admin" and user.employee_id is None:
        role = "admin"
    else:
        # For all other users, verify they still exist in the employee list
        emp = None

        # Find employee by linked employee_id
        if user.employee_id:
            emp = db.query(models.Employee).filter(models.Employee.id == user.employee_id).first()

        # Fallback: find by name match
        if not emp:
            emp = db.query(models.Employee).filter(models.Employee.name == user.username).first()

        if not emp:
            # Employee was deleted — block login for non-admin users only
            if user.role != "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Your account has been removed. Please contact your administrator."
                )
            # If user is admin (but employee record was deleted), still allow login
            role = user.role
        else:
            # Always use the role set by admin/HR in the employee profile
            role = emp.role

            # Keep user account in sync
            if user.role != role:
                user.role = role
            if user.employee_id != emp.id:
                user.employee_id = emp.id
            db.commit()

    token = create_access_token(data={"sub": user.username, "role": role, "employee_id": user.employee_id})
    log_action(db, user.username, "USER_LOGIN", f"User logged in successfully (Role: {role})")
    return {"access_token": token, "token_type": "bearer", "role": role, "employee_id": user.employee_id, "must_change_password": user.must_change_password, "profile_picture": user.profile_picture}


@router.put("/profile-picture")
def update_profile_picture(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Upload or clear profile picture (stored as base64 string)."""
    picture_data = payload.get("profile_picture")  # base64 string or None to clear
    if picture_data and len(picture_data) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="Image too large. Please use an image under 2MB.")
    current_user.profile_picture = picture_data
    db.commit()
    db.refresh(current_user)
    return {"profile_picture": current_user.profile_picture, "message": "Profile picture updated"}


@router.post("/forgot-password")
def forgot_password(req: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    if not req.username and not req.email:
        raise HTTPException(status_code=400, detail="Please provide either a username or email address.")

    user = None
    email_to = None

    # Strategy 1: Lookup by username
    if req.username:
        user = db.query(models.User).filter(models.User.username == req.username).first()

    # Strategy 2: If no username, or user not found, search by email via Employee table
    if not user and req.email:
        search_email = req.email.strip().lower()
        emp = db.query(models.Employee).filter(
            models.Employee.email.ilike(search_email)
        ).first()
        if emp:
            # Find the linked user account
            user = db.query(models.User).filter(
                (models.User.employee_id == emp.id) |
                (models.User.username == emp.name)
            ).first()
            if user:
                email_to = emp.email.strip().lower()

    if not user:
        raise HTTPException(status_code=404, detail="No account found with that username or email address.")

    # Automatically find the employee's registered email (if not already found by email search)
    if not email_to:
        # 1. Check if linked via employee_id
        if user.employee_id:
            emp = db.query(models.Employee).filter(models.Employee.id == user.employee_id).first()
            if emp and emp.email:
                email_to = emp.email.strip().lower()

        # 2. Check if username matches employee name directly
        if not email_to:
            emp = db.query(models.Employee).filter(models.Employee.name == user.username).first()
            if emp and emp.email:
                email_to = emp.email.strip().lower()

        # 3. If email was provided in the request, use it directly as last resort
        if not email_to and req.email:
            email_to = req.email.strip().lower()

    if not email_to:
        raise HTTPException(status_code=400, detail="No email address found for this account. Please contact your administrator.")

        
    # Generate short-lived JWT token (15 mins)
    from datetime import timedelta
    token = create_access_token(
        data={"sub": user.username, "purpose": "password-reset"},
        expires_delta=timedelta(minutes=15)
    )
    
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={token}"
    
    # Print to console log so it's always accessible in development
    print("\n" + "="*80)
    print("PASSWORD RESET REQUEST RECEIVED:")
    print(f"User: {user.username}")
    print(f"Email: {email_to}")
    print(f"Reset Link: {reset_link}")
    print("="*80 + "\n")
    
    # Mask email for display: s****h@gmail.com
    at_idx = email_to.index("@")
    masked_email = email_to[0] + "****" + email_to[at_idx-1:]
    
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #F0F6F6; color: #1A3D40; padding: 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 40px; border: 1px solid #E1ECEB; box-shadow: 0 4px 20px rgba(10,55,58,0.08);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #0A373A, #14A89C); width: 56px; height: 56px; border-radius: 16px; line-height: 56px; color: white; font-weight: bold; font-size: 20px;">SV</div>
          </div>
          <h2 style="color: #0A373A; text-align: center; margin-bottom: 8px; font-size: 22px;">SHREYANSH VOLLORA</h2>
          <p style="text-align: center; color: #14A89C; font-size: 11px; letter-spacing: 2px; font-weight: 600; margin-bottom: 30px;">EVERY STEP GUIDED BY CARE</p>
          
          <p style="color: #4A6D71; font-size: 15px;">Hello <strong style="color: #0A373A;">{user.username}</strong>,</p>
          <p style="color: #4A6D71; font-size: 15px; line-height: 1.6;">We received a request to reset your account password. Click the button below to set a new secure password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}" style="background: linear-gradient(135deg, #0A373A, #14A89C); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block; letter-spacing: 0.5px;">Reset My Password</a>
          </div>
          
          <div style="background-color: #F0F6F6; border-radius: 10px; padding: 16px; margin: 20px 0; border: 1px solid #E1ECEB;">
            <p style="font-size: 13px; color: #4A6D71; margin: 0; line-height: 1.5;">
              ⏱ This link will <strong>expire in 15 minutes</strong>.<br/>
              🔒 If you did not make this request, you can safely ignore this email.
            </p>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #E1ECEB; margin: 25px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">SHREYANSH VOLLORA PVT LTD &bull; Every Step GUIDED BY CARE</p>
        </div>
      </body>
    </html>
    """

    # Send email via Google Apps Script HTTP API (completely bypasses Render SMTP port blocks!)
    email_sent = False
    email_api_url = os.getenv("EMAIL_API_URL")
    
    if not email_api_url:
        print("EMAIL_API_URL is not configured. Email not sent, displaying link in logs.")
    else:
        import json
        import urllib.request
        
        post_data = {
            "to": email_to,
            "subject": "Password Reset Request - SHREYANSH VOLLORA",
            "htmlBody": html
        }
        
        try:
            req_obj = urllib.request.Request(
                email_api_url,
                data=json.dumps(post_data).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req_obj, timeout=15) as resp:
                resp_text = resp.read().decode("utf-8")
                resp_data = json.loads(resp_text)
                if resp_data.get("status") == "success":
                    email_sent = True
                    print(f"Email sent successfully via Google Apps Script to {email_to}!")
                else:
                    print(f"Google Apps Script Error: {resp_data.get('message')}")
        except Exception as e:
            print(f"Failed to send email via HTTP relay: {str(e)}")
    
    # Mask email for response
    at_idx = email_to.index("@")
    masked_email = email_to[0] + "****" + email_to[at_idx-1:]
        
    return {
        "message": f"Password reset link has been sent to {masked_email}.",
        "email_sent": email_sent,
        "dev_link": reset_link
    }


@router.post("/reset-password")
def reset_password(req: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    from jose import JWTError, jwt
    from auth import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(req.token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        purpose: str = payload.get("purpose")
        if username is None or purpose != "password-reset":
            raise HTTPException(status_code=400, detail="Invalid token or purpose")
    except JWTError:
        raise HTTPException(status_code=400, detail="The reset token has expired or is invalid.")
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.password_hash = get_password_hash(req.password)
    db.commit()
    return {"message": "Password reset successfully!"}


@router.post("/change-password")
def change_password(
    req: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    current_user.password_hash = get_password_hash(req.new_password)
    current_user.must_change_password = False
    db.commit()
    log_action(db, current_user.username, "UPDATE_PASSWORD", "User successfully updated their password on first-time login.")
    return {"message": "Password updated successfully!"}


# ── Google OAuth ────────────────────────────────────────────────────────────

@router.get("/auth/google")
def google_login():
    """Redirect user to Google's OAuth consent screen."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth not configured.")
    params = (
        f"?client_id={GOOGLE_CLIENT_ID}"
        "&response_type=code"
        "&scope=openid+email+profile"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        "&access_type=offline"
        "&prompt=select_account"
    )
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth{params}")


@router.get("/auth/google/callback")
def google_callback(code: str = None, error: str = None, db: Session = Depends(get_db)):
    """Handle Google OAuth callback — exchange code for user info, issue JWT."""
    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_denied")

    # 1. Exchange code for tokens
    token_res = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
    )
    if token_res.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_token_failed")

    access_token = token_res.json().get("access_token")

    # 2. Fetch user info from Google
    info_res = httpx.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if info_res.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_userinfo_failed")

    info      = info_res.json()
    g_email   = info.get("email", "").strip().lower()
    g_name    = info.get("name", "").strip()
    g_picture = info.get("picture", None)

    # 3. Find existing user by google_email field
    user = db.query(models.User).filter(models.User.google_email == g_email).first()

    # Try to find employee with matching email
    emp = db.query(models.Employee).filter(
        models.Employee.email.ilike(g_email)
    ).first()

    if not user:
        if not emp:
            # Reject login since email is not registered to any user or employee
            return RedirectResponse(f"{FRONTEND_URL}/login?error=email_not_found")
        
        # Link to existing user account for this employee (if any exists)
        user = db.query(models.User).filter(
            (models.User.employee_id == emp.id) |
            (models.User.username == emp.name)
        ).first()

        if user:
            # Link Google email to the existing user account
            user.google_email = g_email
            user.employee_id = emp.id
            user.role = emp.role
            if not user.profile_picture and g_picture:
                user.profile_picture = g_picture
            db.commit()
        else:
            # Create a brand-new user account linked to this employee
            user = models.User(
                username=emp.name,
                password_hash=get_password_hash(secrets.token_hex(16)),
                role=emp.role,
                employee_id=emp.id,
                must_change_password=False,
                google_email=g_email,
                profile_picture=g_picture,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            log_action(db, user.username, "GOOGLE_REGISTER", f"Linked and registered new account for employee {emp.name} ({g_email})")
    else:
        # User already exists by google_email, ensure it's synced with the employee profile (if one exists)
        if emp:
            if user.employee_id != emp.id or user.role != emp.role:
                user.employee_id = emp.id
                user.role = emp.role
                db.commit()

    log_action(db, user.username, "GOOGLE_LOGIN", f"Logged in via Google ({g_email})")

    # 4. Issue JWT and redirect to frontend
    jwt = create_access_token(data={"sub": user.username, "role": user.role, "employee_id": user.employee_id})
    redirect_url = (
        f"{FRONTEND_URL}/auth/callback"
        f"?token={jwt}"
        f"&role={user.role}"
        f"&username={user.username}"
        f"&employee_id={user.employee_id or ''}"
        f"&profile_picture={'1' if user.profile_picture else ''}"
    )
    return RedirectResponse(redirect_url)
