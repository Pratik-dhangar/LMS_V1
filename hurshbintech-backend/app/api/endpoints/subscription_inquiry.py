"""
Public Subscription Inquiry Endpoints
--------------------------------------
Allows prospective learners to submit a subscription interest form from the landing page.
No authentication is required for submission.
Admin-protected endpoints allow viewing, updating and exporting the collected data.
"""

import csv
import io
import logging
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_admin, get_db
from app.crud import subscription_crud
from app.models.user_model import User
from app.schemas.subscription import (
    PublicSubscriptionInquiryResponse,
    PublicSubscriptionInquiryUpdate,
    SubscriptionPackageResponse,
)
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Subscription Inquiry"])


# ======================================================
# PUBLIC ROUTES — no authentication required
# ======================================================

@router.get(
    "/subscription-packages/public",
    response_model=List[SubscriptionPackageResponse],
    tags=["Public"],
)
async def get_public_subscription_packages(db: AsyncSession = Depends(get_db)):
    """
    Return all *active* subscription packages so the landing-page form
    can populate the package dropdown without requiring a login.
    """
    packages = await subscription_crud.get_all_packages(db, active_only=True)
    return packages


@router.post(
    "/subscription-inquiries",
    response_model=PublicSubscriptionInquiryResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Public"],
)
async def submit_subscription_inquiry(
    # ---- personal details ----
    learner_name: str = Form(...),
    email: str = Form(...),
    contact_number: str = Form(...),
    age: Optional[int] = Form(None),
    date_of_birth: Optional[str] = Form(None),        # ISO date string YYYY-MM-DD
    date_of_assessment: Optional[str] = Form(None),   # ISO date string YYYY-MM-DD
    # ---- package & payment ----
    package_id: Optional[int] = Form(None),
    package_name: Optional[str] = Form(None),
    package_price: Optional[str] = Form(None),        # string so Decimal parsing is robust
    payment_method: Optional[str] = Form(None),       # "UPI" | "BANK_TRANSFER"
    # ---- optional receipt upload ----
    payment_receipt: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a subscription purchase inquiry from the public landing page.
    Optionally attach a payment receipt image / PDF.
    No subscription or learner account is created — this only records the intent.
    """

    # --- parse dates ---
    dob: Optional[date] = None
    if date_of_birth:
        try:
            dob = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_of_birth format. Use YYYY-MM-DD.")

    doa: Optional[date] = None
    if date_of_assessment:
        try:
            doa = datetime.strptime(date_of_assessment, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_of_assessment format. Use YYYY-MM-DD.")

    from decimal import Decimal, InvalidOperation
    price: Optional[Decimal] = None
    if package_price:
        try:
            price = Decimal(package_price)
        except InvalidOperation:
            raise HTTPException(status_code=400, detail="Invalid package_price value.")

    # --- handle optional receipt upload ---
    receipt_url: Optional[str] = None
    receipt_filename: Optional[str] = None

    if payment_receipt and payment_receipt.filename:
        try:
            content = await payment_receipt.read()
            if len(content) > 10 * 1024 * 1024:  # 10 MB limit
                raise HTTPException(status_code=400, detail="Payment receipt exceeds 10 MB limit.")

            # Extract file extension
            file_ext = Path(payment_receipt.filename).suffix or ""
            
            # Build filename with learner_name and assessment_date for easy identification
            learner_name_slug = learner_name.replace(" ", "_").lower()
            assessment_date_str = doa.strftime('%Y%m%d') if doa else "nodate"
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            
            safe_name = (
                f"inquiry_receipt_{learner_name_slug}_{assessment_date_str}_{timestamp}{file_ext}"
            )
            receipt_filename = payment_receipt.filename

            if settings.USE_S3:
                from app.utils.s3_utils import S3Manager
                s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                content_type = payment_receipt.content_type or "application/octet-stream"
                s3_key = s3_manager.upload_file(
                    content,
                    folder="subscription_receipts",
                    filename=safe_name,
                    content_type=content_type,
                )
                receipt_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
            else:
                upload_dir = Path("uploads/subscription_receipts")
                upload_dir.mkdir(parents=True, exist_ok=True)
                file_path = upload_dir / safe_name
                with open(file_path, "wb") as f:
                    f.write(content)
                receipt_url = f"/uploads/subscription_receipts/{safe_name}"
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"Receipt upload failed: {exc}")
            raise HTTPException(status_code=500, detail="Failed to upload payment receipt.")

    inquiry = await subscription_crud.create_inquiry(
        db=db,
        learner_name=learner_name,
        email=email,
        contact_number=contact_number,
        age=age,
        date_of_birth=dob,
        date_of_assessment=doa,
        package_id=package_id,
        package_name=package_name,
        package_price=price,
        payment_method=payment_method,
        payment_receipt_url=receipt_url,
        payment_receipt_filename=receipt_filename,
    )
    return inquiry


# ======================================================
# ADMIN ROUTES — require admin authentication
# ======================================================

@router.get(
    "/admin/subscription-inquiries",
    response_model=List[PublicSubscriptionInquiryResponse],
    tags=["Admin - Subscription Inquiries"],
)
async def list_subscription_inquiries(
    review_status: Optional[str] = Query(None, description="Filter by status: NEW, REVIEWED, PROCESSED"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin: list all public subscription inquiries with optional status filter."""
    inquiries = await subscription_crud.get_all_inquiries(db, review_status=review_status, skip=skip, limit=limit)
    return inquiries


@router.patch(
    "/admin/subscription-inquiries/{inquiry_id}",
    response_model=PublicSubscriptionInquiryResponse,
    tags=["Admin - Subscription Inquiries"],
)
async def update_subscription_inquiry(
    inquiry_id: int,
    update_data: PublicSubscriptionInquiryUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Admin: update the review status and/or notes for a specific inquiry.
    Sends confirmation email to learner when status is changed.
    """
    inquiry = await subscription_crud.update_inquiry(
        db,
        inquiry_id=inquiry_id,
        review_status=update_data.review_status,
        admin_notes=update_data.admin_notes,
    )
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found.")
    
    # Send confirmation email when status is updated (especially REVIEWED or PROCESSED)
    if update_data.review_status == "PROCESSED":
        try:
            inquiry_data = {
                "email": inquiry.email,
                "contact_number": inquiry.contact_number,
                "age": inquiry.age,
                "date_of_birth": inquiry.date_of_birth.isoformat() if inquiry.date_of_birth else None,
                "date_of_assessment": inquiry.date_of_assessment.isoformat() if inquiry.date_of_assessment else None,
                "package_name": inquiry.package_name,
                "package_price": str(inquiry.package_price) if inquiry.package_price else None,
                "payment_method": inquiry.payment_method,
                "payment_receipt_filename": inquiry.payment_receipt_filename,
            }
            await EmailService.send_subscription_inquiry_approved(
                recipient_email=inquiry.email,
                recipient_name=inquiry.learner_name,
                inquiry_data=inquiry_data,
            )
        except Exception as exc:
            logger.error(f"Failed to send subscription inquiry confirmation email: {exc}")
            # Don't fail the request if email fails; just log it
    
    return inquiry


@router.delete(
    "/admin/subscription-inquiries/{inquiry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Admin - Subscription Inquiries"],
)
async def delete_subscription_inquiry(
    inquiry_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin: delete a subscription inquiry from the database."""
    inquiry = await subscription_crud.get_inquiry_by_id(db, inquiry_id)
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found.")
    
    # Delete the inquiry
    await subscription_crud.delete_inquiry(db, inquiry_id)
    logger.info(f"Admin {current_admin.name} deleted subscription inquiry {inquiry_id}")
    return None


@router.get(
    "/admin/subscription-inquiries/export",
    responses={200: {"content": {"text/csv": {}}, "description": "CSV file download"}},
    tags=["Admin - Subscription Inquiries"],
)
async def export_subscription_inquiries_csv(
    review_status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Admin: export all public subscription inquiries as a downloadable CSV file.
    The CSV contains all available fields for each inquiry record.
    """
    inquiries = await subscription_crud.get_all_inquiries(
        db, review_status=review_status, skip=0, limit=10000
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "ID",
        "Learner Name",
        "Email",
        "Contact Number",
        "Age",
        "Date of Birth",
        "Date of Assessment",
        "Package ID",
        "Package Name",
        "Package Price (₹)",
        "Payment Method",
        "Payment Receipt Filename",
        "Payment Receipt URL",
        "Review Status",
        "Admin Notes",
        "Submitted At",
        "Updated At",
    ])

    for inq in inquiries:
        writer.writerow([
            inq.id,
            inq.learner_name,
            inq.email,
            inq.contact_number,
            inq.age if inq.age is not None else "",
            inq.date_of_birth.isoformat() if inq.date_of_birth else "",
            inq.date_of_assessment.isoformat() if inq.date_of_assessment else "",
            inq.package_id if inq.package_id is not None else "",
            inq.package_name or "",
            str(inq.package_price) if inq.package_price is not None else "",
            inq.payment_method or "",
            inq.payment_receipt_filename or "",
            inq.payment_receipt_url or "",
            inq.review_status,
            inq.admin_notes or "",
            inq.submitted_at.isoformat() if inq.submitted_at else "",
            inq.updated_at.isoformat() if inq.updated_at else "",
        ])

    output.seek(0)
    filename = f"subscription_inquiries_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
