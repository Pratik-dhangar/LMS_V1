"""
Assigned Training endpoints - Admin CRUD and user viewing
"""

from typing import List, Optional
import logging
import mimetypes
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_user
from app.db.session import get_db
from app.models.user_model import User
from app.crud.assigned_training_crud import assigned_training_crud, assigned_training_user_crud
from app.schemas.assigned_training import (
    AssignedTrainingCreate,
    AssignedTrainingUpdate,
    AssignedTrainingResponse,
    AssignedTrainingListResponse,
    AssignedTrainingUserResponse,
    TrainingFileInfo,
)
from app.core.config import settings
from app.utils.s3_utils import S3Manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Assigned Trainings"])

# Initialize S3 manager if S3 is enabled
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
        s3_manager.create_s3_folders()
        logger.info("S3 manager initialized successfully for trainings")
    except Exception as e:
        logger.error(f"Failed to initialize S3 manager: {str(e)}")
else:
    # Local storage
    LOCAL_UPLOAD_DIR = Path("uploads/trainings")
    LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Training files will be stored locally in: {LOCAL_UPLOAD_DIR}")

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
MAX_IMAGE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_DOCUMENT_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
                          "text/plain", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                          "video/mp4", "video/avi", "video/quicktime", "video/x-matroska", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg"]
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB


# ========== HELPER FUNCTIONS ==========

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


def get_file_category(filename: str) -> str:
    """Categorize file type"""
    file_extension = Path(filename).suffix.lower()
    file_type_map = {
        ".jpg": "image", ".jpeg": "image", ".jfif": "image", ".png": "image", 
        ".gif": "image", ".webp": "image",
        ".pdf": "pdf",
        ".mp4": "video", ".avi": "video", ".mov": "video", ".mkv": "video", ".webm": "video",
        ".mp3": "audio", ".wav": "audio", ".ogg": "audio", ".m4a": "audio",
        ".doc": "document", ".docx": "document", ".txt": "document", 
        ".ppt": "document", ".pptx": "document",
    }
    return file_type_map.get(file_extension, "document")


def validate_image_file(file: UploadFile):
    """Validate uploaded image file"""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )


def validate_training_file(file: UploadFile):
    """Validate uploaded training file"""
    # Simplified check - just validate file extension
    file_ext = Path(file.filename).suffix.lower()
    allowed_extensions = ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx',
                         '.mp4', '.avi', '.mov', '.mkv', '.webm',
                         '.mp3', '.wav', '.ogg', '.m4a',
                         '.jpg', '.jpeg', '.png', '.gif', '.webp']
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed: {file_ext}",
        )


async def save_featured_image(image_file: UploadFile) -> str:
    """Save featured image to S3 or local storage"""
    try:
        image_content = await image_file.read()
        validate_image_file(image_file)

        if len(image_content) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Image too large. Maximum: 50MB",
            )

        if settings.USE_S3:
            # Upload to S3
            s3_key = s3_manager.upload_file(
                image_content,
                folder="trainings/featured-images",
                filename=f"{uuid.uuid4()}{Path(image_file.filename).suffix}",
                content_type=image_file.content_type,
            )
            return f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
        else:
            # Save locally
            filename = f"{uuid.uuid4()}{Path(image_file.filename).suffix}"
            file_path = LOCAL_UPLOAD_DIR / "featured-images" / filename
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(image_content)
            return f"/uploads/trainings/featured-images/{filename}"
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving featured image: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save featured image"
        )


async def save_training_file(upload_file: UploadFile, training_id: Optional[int] = None) -> dict:
    """Save training file to S3 or local storage"""
    try:
        file_content = await upload_file.read()
        validate_training_file(upload_file)

        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum: 500MB",
            )

        file_category = get_file_category(upload_file.filename)
        filename = f"{uuid.uuid4()}{Path(upload_file.filename).suffix}"
        
        if settings.USE_S3:
            # Upload to S3
            folder = f"trainings/content/{training_id}" if training_id else "trainings/content/temp"
            s3_key = s3_manager.upload_file(
                file_content,
                folder=folder,
                filename=filename,
                content_type=upload_file.content_type,
            )
            file_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
        else:
            # Save locally
            if training_id:
                folder_path = LOCAL_UPLOAD_DIR / "content" / str(training_id)
            else:
                folder_path = LOCAL_UPLOAD_DIR / "content" / "temp"
            folder_path.mkdir(parents=True, exist_ok=True)
            file_path = folder_path / filename
            with open(file_path, "wb") as f:
                f.write(file_content)
            file_url = f"/uploads/trainings/content/{training_id or 'temp'}/{filename}"
        
        return {
            "name": upload_file.filename,
            "url": file_url,
            "size": len(file_content),
            "type": file_category,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving training file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save training file"
        )


def delete_file_from_storage(file_url: str) -> bool:
    """Delete file from S3 or local storage"""
    if not file_url:
        return False
    
    try:
        if settings.USE_S3 and file_url.startswith("s3://"):
            # Extract S3 key
            s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
            s3_manager.delete_file(s3_key)
            logger.info(f"Deleted file from S3: {s3_key}")
            return True
        elif not file_url.startswith("s3://"):
            # Local file deletion
            if file_url.startswith("/uploads/"):
                file_url = file_url[1:]  # Remove leading /
            
            file_path = Path(file_url)
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted local file: {file_path}")
                return True
        return False
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return False


# ========== FILE UPLOAD ENDPOINTS ==========

@router.post("/admin/trainings/upload-featured-image")
async def upload_featured_image(
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin),
):
    """Upload featured image for training (Admin only) - stores in S3 in production"""
    
    try:
        if not file or not file.filename:
            logger.error("No file provided in upload request")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided",
            )
        
        logger.info(f"Uploading featured image: {file.filename}")
        
        # Upload featured image
        file_url = await save_featured_image(file)
        
        logger.info(f"Featured image uploaded successfully: {file_url}")
        
        return {
            "success": True,
            "file_url": file_url,
            "original_filename": file.filename,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading featured image: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload featured image: {str(e)}",
        )


@router.post("/admin/trainings/upload-files")
async def upload_training_files(
    files: List[UploadFile] = File(...),
    current_admin: User = Depends(get_current_admin),
):
    """Upload training content files (Admin only) - stores in S3 in production"""
    
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided",
        )
    
    uploaded_files = []
    errors = []
    
    for file in files:
        try:
            if not file.filename:
                errors.append({"file": "unknown", "error": "No filename"})
                continue
            
            # Upload file (training_id is None for temp uploads)
            file_info = await save_training_file(file, training_id=None)
            uploaded_files.append(file_info)
            
        except HTTPException as e:
            errors.append({"file": file.filename, "error": e.detail})
        except Exception as e:
            logger.error(f"Error uploading file {file.filename}: {str(e)}")
            errors.append({"file": file.filename, "error": str(e)})
    
    return {
        "success": len(uploaded_files) > 0,
        "uploaded_files": uploaded_files,
        "errors": errors,
    }




# ========== ADMIN ENDPOINTS (CRUD) ==========

@router.post("/admin/assigned-trainings", response_model=AssignedTrainingResponse, status_code=status.HTTP_201_CREATED)
async def create_assigned_training(
    payload: AssignedTrainingCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create a new assigned training with files (Admin only) - files stored in S3 in production"""
    
    # Normalize target_roles to lowercase
    normalized_roles = [role.lower() for role in payload.target_roles]
    
    # Convert TrainingFileInfo objects to dictionaries for JSON storage
    training_files_list = None
    if payload.training_files:
        training_files_list = [
            file.dict() if hasattr(file, 'dict') else file
            for file in payload.training_files
        ]
    
    try:
        # Create the training with provided files
        training = await assigned_training_crud.create_assigned_training(
            db,
            title=payload.title,
            description=payload.description,
            custom_content=payload.custom_content,
            training_ref_ids=payload.training_ref_ids,
            target_roles=normalized_roles,
            assigned_by_admin=current_admin.id,
            featured_image_url=payload.featured_image_url,
            training_files=training_files_list,
            training_folder=None,
            active=payload.active,
            custom_metadata=payload.custom_metadata,
        )
        
        logger.info(f"Created training {training.id} with S3/local files stored")
        return AssignedTrainingResponse.from_orm(training)
        
    except Exception as e:
        logger.error(f"Error creating training: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create training: {str(e)}",
        )


@router.get("/admin/assigned-trainings", response_model=AssignedTrainingListResponse)
async def list_assigned_trainings(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    active_only: bool = Query(False),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get all assigned trainings with pagination (Admin only)"""
    
    trainings, total = await assigned_training_crud.get_assigned_trainings(
        db,
        skip=skip,
        limit=limit,
        active_only=active_only,
        search=search,
    )
    
    return AssignedTrainingListResponse(
        items=[AssignedTrainingResponse.from_orm(t) for t in trainings],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/admin/assigned-trainings/{training_id}", response_model=AssignedTrainingResponse)
async def get_assigned_training_detail(
    training_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get a single assigned training (Admin only)"""
    
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    return AssignedTrainingResponse.from_orm(training)


@router.patch("/admin/assigned-trainings/{training_id}", response_model=AssignedTrainingResponse)
async def update_assigned_training(
    training_id: int,
    payload: AssignedTrainingUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update an assigned training (Admin only)"""
    
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    # Prepare update data, normalizing roles if provided
    update_data = payload.dict(exclude_unset=True)
    if "target_roles" in update_data and update_data["target_roles"]:
        update_data["target_roles"] = [role.lower() for role in update_data["target_roles"]]
    
    updated_training = await assigned_training_crud.update_assigned_training(db, training_id, **update_data)
    
    return AssignedTrainingResponse.from_orm(updated_training)


@router.delete("/admin/assigned-trainings/{training_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assigned_training(
    training_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete an assigned training and its files from S3 or local storage (Admin only)"""
    
    # Get training to access file URLs
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    # Delete featured image if exists
    if training.featured_image_url:
        delete_file_from_storage(training.featured_image_url)
    
    # Delete training files if exist
    if training.training_files:
        for file_info in training.training_files:
            if isinstance(file_info, dict) and 'url' in file_info:
                delete_file_from_storage(file_info['url'])
    
    # Delete from database
    success = await assigned_training_crud.delete_assigned_training(db, training_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )


# ========== USER ENDPOINTS (Read and Mark Complete) ==========

@router.get("/assigned-trainings/me", response_model=AssignedTrainingListResponse)
async def get_my_assigned_trainings(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get trainings assigned to the current user based on their role"""
    
    # Determine user role (ensure it's a string)
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    
    trainings, total = await assigned_training_crud.get_trainings_for_user(
        db,
        user_role=user_role,
        skip=skip,
        limit=limit,
        active_only=True,
    )
    
    # Enrich trainings with user-specific progress data
    enriched_trainings = []
    for training in trainings:
        training_response = AssignedTrainingResponse.from_orm(training)
        
        # Get user's specific assignment status
        user_assignment = await assigned_training_user_crud.get_user_assignment(
            db,
            training.id,
            current_user.id,
        )
        
        if user_assignment:
            training_response.user_status = user_assignment.status
            training_response.user_progress = user_assignment.progress
            training_response.user_started_at = user_assignment.started_at
            training_response.user_completed_at = user_assignment.completed_at
        
        enriched_trainings.append(training_response)
    
    return AssignedTrainingListResponse(
        items=enriched_trainings,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/assigned-trainings/{training_id}", response_model=AssignedTrainingResponse)
async def get_assigned_training_for_user(
    training_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single assigned training with user-specific progress (if user has access)"""
    
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    # Check if user has access to this training
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    normalized_role = user_role.lower()
    
    has_access = "all" in training.target_roles or normalized_role in training.target_roles
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this training",
        )
    
    training_response = AssignedTrainingResponse.from_orm(training)
    
    # Get or create user assignment and enrich response
    user_assignment = await assigned_training_user_crud.create_or_get_user_assignment(
        db,
        training.id,
        current_user.id,
    )
    
    training_response.user_status = user_assignment.status
    training_response.user_progress = user_assignment.progress
    training_response.user_started_at = user_assignment.started_at
    training_response.user_completed_at = user_assignment.completed_at
    
    return training_response


@router.get("/admin/assigned-trainings/{training_id}/users")
async def get_assigned_training_users(
    training_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get all users assigned to a training with their progress (Admin only)"""
    
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    # Get user assignments for this training
    assignments, total = await assigned_training_user_crud.get_user_assignments_for_training(
        db,
        training_id,
        skip=skip,
        limit=limit,
    )
    
    # Enrich with user details
    enriched_assignments = []
    for assignment in assignments:
        # Get user details
        user_result = await db.execute(
            select(User).filter(User.id == assignment.user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if user:
            enriched_assignments.append({
                "user_id": user.id,
                "user_name": user.name,
                "user_email": user.email,
                "user_role": user.role.value if hasattr(user.role, 'value') else str(user.role),
                "status": assignment.status,
                "progress": assignment.progress,
                "started_at": assignment.started_at,
                "completed_at": assignment.completed_at,
                "created_at": assignment.created_at,
                "updated_at": assignment.updated_at,
            })
    
    return {
        "items": enriched_assignments,
        "total": total,
        "skip": skip,
        "limit": limit,
    }
