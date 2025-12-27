"""
About Us API endpoints - Admin and Public routes
"""
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_admin, get_db
from app.crud.about_us_crud import about_us_crud
from app.models.user_model import User
from app.schemas.about_us import AboutUsCreate, AboutUsUpdate, AboutUsResponse
from app.utils.s3_utils import S3Manager

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize S3 manager if S3 is enabled
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
        s3_manager.create_s3_folders()
        logger.info("S3 manager initialized successfully for about us")
    except Exception as e:
        logger.error(f"Failed to initialize S3 manager: {str(e)}")
else:
    # Local storage
    UPLOAD_DIR = "uploads/about-us"
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    logger.info(f"About Us images will be stored locally in: {UPLOAD_DIR}")

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


def get_public_url(file_url: str) -> str:
    """Convert S3 URL to public HTTPS URL via Nginx proxy"""
    try:
        if settings.USE_S3 and file_url and file_url.startswith("s3://"):
            s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
            public_url = s3_manager.get_public_url(s3_key)
            return public_url
        else:
            return file_url
    except Exception as e:
        logger.error(f"Error generating public URL: {str(e)}")
        return file_url


def convert_about_us_response(about_us) -> AboutUsResponse:
    """Convert S3 URLs in About Us response to public HTTPS URLs"""
    about_us_dict = {
        "id": about_us.id,
        "version_number": about_us.version_number,
        "language_code": about_us.language_code,
        "is_active": about_us.is_active,
        "featured_image_url": get_public_url(about_us.featured_image_url) if about_us.featured_image_url else None,
        "hero_title": about_us.hero_title,
        "hero_subtitle": about_us.hero_subtitle,
        "intro_title": about_us.intro_title,
        "intro_content": about_us.intro_content,
        "mission_title": about_us.mission_title,
        "mission_content": about_us.mission_content,
        "vision_title": about_us.vision_title,
        "vision_content": about_us.vision_content,
        "programs_title": about_us.programs_title,
        "programs_content": about_us.programs_content,
        "methodology_title": about_us.methodology_title,
        "methodology_content": about_us.methodology_content,
        "why_us_title": about_us.why_us_title,
        "why_us_content": about_us.why_us_content,
        "team_title": about_us.team_title,
        "team_content": about_us.team_content,
        "learner_focus_title": about_us.learner_focus_title,
        "learner_focus_content": about_us.learner_focus_content,
        "values_title": about_us.values_title,
        "values_content": about_us.values_content,
        "commitment_title": about_us.commitment_title,
        "commitment_content": about_us.commitment_content,
        "status": about_us.status.value,
        "author_id": about_us.author_id,
        "author": {
            "id": about_us.author.id,
            "name": about_us.author.name,
            "email": about_us.author.email,
        },
        "created_at": about_us.created_at,
        "updated_at": about_us.updated_at,
    }
    return AboutUsResponse(**about_us_dict)


def validate_image_file(file: UploadFile):
    """Validate uploaded image file"""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )

    file_size = 0
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size too large. Maximum size: {MAX_IMAGE_SIZE/1024/1024}MB",
        )


async def save_featured_image(image_file: UploadFile) -> str:
    """Save featured image to S3 or local storage"""
    try:
        image_content = await image_file.read()

        if settings.USE_S3:
            # Upload to S3
            s3_key = s3_manager.upload_file(
                image_content,
                folder="about-us",
                filename=f"{uuid.uuid4()}{Path(image_file.filename).suffix}",
                content_type=image_file.content_type,
            )
            return f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
        else:
            # Save locally
            filename = f"{uuid.uuid4()}{Path(image_file.filename).suffix}"
            file_path = Path(UPLOAD_DIR) / filename
            with open(file_path, "wb") as f:
                f.write(image_content)
            return f"/uploads/about-us/{filename}"
    except Exception as e:
        logger.error(f"Error saving featured image: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save featured image"
        )


def delete_featured_image(image_url: str) -> bool:
    """Delete featured image from S3 or local storage"""
    if not image_url:
        return True
    
    try:
        if image_url.startswith("s3://"):
            # Delete from S3
            s3_key = image_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
            return s3_manager.delete_file(s3_key)
        elif image_url.startswith("/uploads/about-us/"):
            # Delete local file
            file_path = Path(image_url.lstrip("/"))
            if file_path.exists():
                os.remove(file_path)
                logger.info(f"Deleted local featured image: {file_path}")
                return True
            else:
                logger.warning(f"Featured image file not found: {file_path}")
                return True
        else:
            logger.warning(f"Unknown image URL format: {image_url}")
            return True
    except Exception as e:
        logger.error(f"Error deleting featured image {image_url}: {str(e)}")
        # Don't raise exception, log and continue
        return False


# ============================================================================
# ADMIN ENDPOINTS - Require admin authentication
# ============================================================================

@router.post("/admin/about-us", response_model=AboutUsResponse, status_code=status.HTTP_201_CREATED)
async def create_about_us(
    language_code: str = Form("en"),
    is_active: bool = Form(True),
    hero_title: Optional[str] = Form(None),
    hero_subtitle: Optional[str] = Form(None),
    intro_title: Optional[str] = Form("Who We Are"),
    intro_content: Optional[str] = Form(None),
    mission_title: Optional[str] = Form("Our Mission"),
    mission_content: Optional[str] = Form(None),
    vision_title: Optional[str] = Form("Our Vision"),
    vision_content: Optional[str] = Form(None),
    programs_title: Optional[str] = Form("What We Teach"),
    programs_content: Optional[str] = Form(None),
    methodology_title: Optional[str] = Form("How We Teach"),
    methodology_content: Optional[str] = Form(None),
    why_us_title: Optional[str] = Form("Why Choose Us"),
    why_us_content: Optional[str] = Form(None),
    team_title: Optional[str] = Form("Our Educators"),
    team_content: Optional[str] = Form(None),
    learner_focus_title: Optional[str] = Form("Learner & Parent Focus"),
    learner_focus_content: Optional[str] = Form(None),
    values_title: Optional[str] = Form("Our Values"),
    values_content: Optional[str] = Form(None),
    commitment_title: Optional[str] = Form("Our Commitment"),
    commitment_content: Optional[str] = Form(None),
    status: str = Form("draft"),
    featured_image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create a new About Us record (Admin only)"""
    try:
        # Validate and save featured image if provided
        featured_image_url = None
        if featured_image and featured_image.filename:
            validate_image_file(featured_image)
            featured_image_url = await save_featured_image(featured_image)

        # Create About Us
        about_us_data = AboutUsCreate(
            language_code=language_code,
            is_active=is_active,
            featured_image_url=featured_image_url,
            hero_title=hero_title,
            hero_subtitle=hero_subtitle,
            intro_title=intro_title,
            intro_content=intro_content,
            mission_title=mission_title,
            mission_content=mission_content,
            vision_title=vision_title,
            vision_content=vision_content,
            programs_title=programs_title,
            programs_content=programs_content,
            methodology_title=methodology_title,
            methodology_content=methodology_content,
            why_us_title=why_us_title,
            why_us_content=why_us_content,
            team_title=team_title,
            team_content=team_content,
            learner_focus_title=learner_focus_title,
            learner_focus_content=learner_focus_content,
            values_title=values_title,
            values_content=values_content,
            commitment_title=commitment_title,
            commitment_content=commitment_content,
            status=status,
        )

        about_us = await about_us_crud.create_about_us(db, about_us_data, current_admin.id)
        return convert_about_us_response(about_us)

    except Exception as e:
        logger.error(f"Error creating About Us: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/about-us", response_model=AboutUsResponse)
async def get_admin_about_us(
    language_code: str = "en",
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get latest About Us record for editing (Admin only) - regardless of active status"""
    about_us = await about_us_crud.get_latest_about_us(db, language_code)
    if not about_us:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="About Us page not found"
        )
    return convert_about_us_response(about_us)


@router.put("/admin/about-us/{about_us_id}", response_model=AboutUsResponse)
async def update_about_us(
    about_us_id: int,
    language_code: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    hero_title: Optional[str] = Form(None),
    hero_subtitle: Optional[str] = Form(None),
    intro_title: Optional[str] = Form(None),
    intro_content: Optional[str] = Form(None),
    mission_title: Optional[str] = Form(None),
    mission_content: Optional[str] = Form(None),
    vision_title: Optional[str] = Form(None),
    vision_content: Optional[str] = Form(None),
    programs_title: Optional[str] = Form(None),
    programs_content: Optional[str] = Form(None),
    methodology_title: Optional[str] = Form(None),
    methodology_content: Optional[str] = Form(None),
    why_us_title: Optional[str] = Form(None),
    why_us_content: Optional[str] = Form(None),
    team_title: Optional[str] = Form(None),
    team_content: Optional[str] = Form(None),
    learner_focus_title: Optional[str] = Form(None),
    learner_focus_content: Optional[str] = Form(None),
    values_title: Optional[str] = Form(None),
    values_content: Optional[str] = Form(None),
    commitment_title: Optional[str] = Form(None),
    commitment_content: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    featured_image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update About Us record (Admin only)"""
    try:
        # Get existing about_us record to access current featured image
        existing_about_us = await about_us_crud.get_about_us_by_id(db, about_us_id)
        if not existing_about_us:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="About Us page not found"
            )

        # Validate and save featured image if provided
        featured_image_url = None
        if featured_image and featured_image.filename:
            validate_image_file(featured_image)
            featured_image_url = await save_featured_image(featured_image)
            
            # Delete old featured image if it exists
            if existing_about_us.featured_image_url:
                success = delete_featured_image(existing_about_us.featured_image_url)
                if not success:
                    logger.warning(f"Failed to delete old featured image: {existing_about_us.featured_image_url}")

        # Create update data
        update_data = {}
        if language_code is not None:
            update_data["language_code"] = language_code
        if is_active is not None:
            update_data["is_active"] = is_active
        if featured_image_url is not None:
            update_data["featured_image_url"] = featured_image_url
        if hero_title is not None:
            update_data["hero_title"] = hero_title
        if hero_subtitle is not None:
            update_data["hero_subtitle"] = hero_subtitle
        if intro_title is not None:
            update_data["intro_title"] = intro_title
        if intro_content is not None:
            update_data["intro_content"] = intro_content
        if mission_title is not None:
            update_data["mission_title"] = mission_title
        if mission_content is not None:
            update_data["mission_content"] = mission_content
        if vision_title is not None:
            update_data["vision_title"] = vision_title
        if vision_content is not None:
            update_data["vision_content"] = vision_content
        if programs_title is not None:
            update_data["programs_title"] = programs_title
        if programs_content is not None:
            update_data["programs_content"] = programs_content
        if methodology_title is not None:
            update_data["methodology_title"] = methodology_title
        if methodology_content is not None:
            update_data["methodology_content"] = methodology_content
        if why_us_title is not None:
            update_data["why_us_title"] = why_us_title
        if why_us_content is not None:
            update_data["why_us_content"] = why_us_content
        if team_title is not None:
            update_data["team_title"] = team_title
        if team_content is not None:
            update_data["team_content"] = team_content
        if learner_focus_title is not None:
            update_data["learner_focus_title"] = learner_focus_title
        if learner_focus_content is not None:
            update_data["learner_focus_content"] = learner_focus_content
        if values_title is not None:
            update_data["values_title"] = values_title
        if values_content is not None:
            update_data["values_content"] = values_content
        if commitment_title is not None:
            update_data["commitment_title"] = commitment_title
        if commitment_content is not None:
            update_data["commitment_content"] = commitment_content
        if status is not None:
            update_data["status"] = status

        about_us_update = AboutUsUpdate(**update_data)
        about_us = await about_us_crud.update_about_us(db, about_us_id, about_us_update)

        if not about_us:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="About Us page not found"
            )

        return convert_about_us_response(about_us)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating About Us: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/about-us/{about_us_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_about_us(
    about_us_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete (deactivate) About Us record (Admin only)"""
    success = await about_us_crud.delete_about_us(db, about_us_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="About Us page not found"
        )
    return None


@router.delete("/admin/about-us/{about_us_id}/featured-image", status_code=status.HTTP_204_NO_CONTENT)
async def delete_featured_image_endpoint(
    about_us_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete featured image from About Us page (Admin only)"""
    try:
        # Get the about_us record
        about_us = await about_us_crud.get_about_us_by_id(db, about_us_id)
        if not about_us:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="About Us page not found"
            )
        
        # Check if featured image exists
        if not about_us.featured_image_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No featured image to delete"
            )
        
        # Delete the image file
        image_url = about_us.featured_image_url
        success = delete_featured_image(image_url)
        
        if not success:
            logger.warning(f"Failed to delete featured image file: {image_url}")
            # Continue with database update even if file deletion fails
        
        # Update database to remove image reference
        update_data = AboutUsUpdate(featured_image_url=None)
        await about_us_crud.update_about_us(db, about_us_id, update_data)
        
        logger.info(f"Deleted featured image for About Us ID {about_us_id}: {image_url}")
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting featured image: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete featured image"
        )


# ============================================================================
# PUBLIC ENDPOINTS - No authentication required
# ============================================================================

@router.get("/about-us/public", response_model=AboutUsResponse)
async def get_public_about_us(
    language_code: str = "en",
    db: AsyncSession = Depends(get_db),
):
    """Get published About Us page (Public)"""
    logger.info(f"Fetching published About Us for language: {language_code}")
    about_us = await about_us_crud.get_published_about_us(db, language_code)
    
    if not about_us:
        logger.warning(f"No published About Us found for language: {language_code}")
        # Check if any records exist for debugging
        all_records = await about_us_crud.get_latest_about_us(db, language_code)
        if all_records:
            logger.warning(f"Latest record found: status={all_records.status}, is_active={all_records.is_active}")
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="About Us page not found or not published"
        )
    
    logger.info(f"Returning published About Us for language: {language_code}")
    return convert_about_us_response(about_us)
