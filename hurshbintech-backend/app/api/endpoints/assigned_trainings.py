"""
Assigned Training endpoints - Admin CRUD and user viewing
"""

import hashlib
from typing import List, Optional
import logging
import mimetypes
import uuid
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
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
from app.services.cache_service import cache_service

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


def convert_training_urls(training: AssignedTrainingResponse) -> AssignedTrainingResponse:
    """Convert all S3 URLs in training response to public HTTP URLs"""
    try:
        # Convert featured image URL
        if training.featured_image_url:
            training.featured_image_url = get_public_url(training.featured_image_url)
        
        # Convert training file URLs
        if training.training_files:
            for file_info in training.training_files:
                if isinstance(file_info, dict) and 'url' in file_info:
                    file_info['url'] = get_public_url(file_info['url'])
                elif hasattr(file_info, 'url'):
                    file_info.url = get_public_url(file_info.url)
        
        return training
    except Exception as e:
        logger.error(f"Error converting training URLs: {str(e)}")
        return training


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



async def save_thumbnail(image_file: UploadFile, training_id: int) -> str:
    """Save thumbnail image to S3 or local storage - stores in training_id folder"""
    try:
        image_content = await image_file.read()
        validate_image_file(image_file)

        if len(image_content) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Image too large. Maximum: 50MB",
            )

        filename = f"{uuid.uuid4()}{Path(image_file.filename).suffix}"
        
        if settings.USE_S3:
            # Upload to S3 - uploads/trainings/thumbnails/{training_id}/
            folder = f"trainings/thumbnails/{training_id}"
            s3_key = s3_manager.upload_file(
                image_content,
                folder=folder,
                filename=filename,
                content_type=image_file.content_type,
            )
            return f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
        else:
            # Save locally - matches S3 structure
            folder_path = LOCAL_UPLOAD_DIR / "thumbnails" / str(training_id)
            folder_path.mkdir(parents=True, exist_ok=True)
            file_path = folder_path / filename
            with open(file_path, "wb") as f:
                f.write(image_content)
            return f"/uploads/trainings/thumbnails/{training_id}/{filename}"
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving thumbnail: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save thumbnail"
        )


async def save_training_file(upload_file: UploadFile, training_id: int) -> dict:
    """Save training file to S3 or local storage - requires existing training_id"""
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
            # Upload to S3 - uploads/trainings/learning-materials/{training_id}/
            folder = f"trainings/learning-materials/{training_id}"
            s3_key = s3_manager.upload_file(
                file_content,
                folder=folder,
                filename=filename,
                content_type=upload_file.content_type,
            )
            file_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
        else:
            # Save locally - matches S3 structure
            folder_path = LOCAL_UPLOAD_DIR / "learning-materials" / str(training_id)
            folder_path.mkdir(parents=True, exist_ok=True)
            file_path = folder_path / filename
            with open(file_path, "wb") as f:
                f.write(file_content)
            file_url = f"/uploads/trainings/learning-materials/{training_id}/{filename}"
        
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

@router.post("/admin/trainings/upload-thumbnail")
async def upload_thumbnail(
    training_id: int = Query(..., description="ID of the training to upload thumbnail for"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Upload thumbnail for training (Admin only) - stores in training_id folder"""
    
    try:
        # Verify training exists
        training = await assigned_training_crud.get_assigned_training(db, training_id)
        if not training:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Training with ID {training_id} not found",
            )
        
        if not file or not file.filename:
            logger.error("No file provided in upload request")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided",
            )
        
        logger.info(f"Uploading thumbnail for training {training_id}: {file.filename}")
        
        # Upload thumbnail
        file_url = await save_thumbnail(file, training_id)
        
        logger.info(f"Thumbnail uploaded successfully: {file_url}")
        
        return {
            "success": True,
            "file_url": file_url,
            "original_filename": file.filename,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading thumbnail: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload thumbnail: {str(e)}",
        )


@router.post("/admin/trainings/upload-files")
async def upload_training_files(
    training_id: int = Query(..., description="ID of the training to upload files for"),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Upload training content files (Admin only) - requires existing training ID"""
    
    # Verify training exists
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training with ID {training_id} not found",
        )
    
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
            
            # Upload file with training_id
            file_info = await save_training_file(file, training_id=training_id)
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


@router.post("/admin/assigned-trainings/{training_id}/add-files", response_model=AssignedTrainingResponse)
async def add_files_to_training(
    training_id: int,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Upload files and automatically add them to training - combines upload + update in one call"""
    
    # Verify training exists
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training with ID {training_id} not found",
        )
    
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided",
        )
    
    uploaded_files = []
    errors = []
    
    # Upload all files
    for file in files:
        try:
            if not file.filename:
                errors.append({"file": "unknown", "error": "No filename"})
                continue
            
            # Upload file with training_id
            file_info = await save_training_file(file, training_id=training_id)
            uploaded_files.append(file_info)
            
        except HTTPException as e:
            errors.append({"file": file.filename, "error": e.detail})
        except Exception as e:
            logger.error(f"Error uploading file {file.filename}: {str(e)}")
            errors.append({"file": file.filename, "error": str(e)})
    
    if not uploaded_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files were uploaded successfully",
        )
    
    # Get existing training_files and append new ones
    existing_files = training.training_files or []
    updated_files = existing_files + uploaded_files
    
    # Update training with new files
    updated_training = await assigned_training_crud.update_assigned_training(
        db, 
        training_id, 
        training_files=updated_files
    )
    
    logger.info(f"Added {len(uploaded_files)} files to training {training_id}")
    
    return AssignedTrainingResponse.from_orm(updated_training)


# ========== ADMIN ENDPOINTS (CRUD) ==========

@router.post("/admin/assigned-trainings/with-files", response_model=AssignedTrainingResponse, status_code=status.HTTP_201_CREATED)
async def create_training_with_files(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    custom_content: Optional[str] = Form(None),
    target_roles: str = Form(..., description="JSON array of roles, e.g. ['all'] or ['admin','coach']"),
    active: bool = Form(True),
    training_ref_ids: Optional[str] = Form(None, description="JSON array of training reference IDs"),
    custom_metadata: Optional[str] = Form(None, description="JSON object of custom metadata"),
    featured_image: Optional[UploadFile] = File(None),
    learning_files: Optional[List[UploadFile]] = File(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create training with featured image and learning materials in one call - handles all uploads automatically"""
    
    try:
        # Parse JSON fields
        parsed_roles = json.loads(target_roles) if target_roles else []
        normalized_roles = [role.lower() for role in parsed_roles]
        
        parsed_ref_ids = json.loads(training_ref_ids) if training_ref_ids else []
        parsed_metadata = json.loads(custom_metadata) if custom_metadata else {}
        
        # Step 1: Create training first (without files)
        training = await assigned_training_crud.create_assigned_training(
            db,
            title=title,
            description=description,
            custom_content=custom_content,
            training_ref_ids=parsed_ref_ids,
            target_roles=normalized_roles,
            assigned_by_admin=current_admin.id,
            featured_image_url=None,  # Will update after upload
            training_files=[],  # Will update after upload
            training_folder=None,
            active=active,
            custom_metadata=parsed_metadata,
        )
        
        logger.info(f"Created training {training.id}, now uploading files...")
        
        # Step 2: Upload thumbnail if provided
        featured_image_url = None
        if featured_image and featured_image.filename:
            try:
                featured_image_url = await save_thumbnail(featured_image, training.id)
                logger.info(f"Thumbnail uploaded: {featured_image_url}")
            except Exception as e:
                logger.error(f"Failed to upload thumbnail: {str(e)}")
                # Continue without thumbnail
        
        # Step 3: Upload learning materials if provided
        uploaded_files = []
        if learning_files:
            for file in learning_files:
                try:
                    if file and file.filename:
                        file_info = await save_training_file(file, training_id=training.id)
                        uploaded_files.append(file_info)
                        logger.info(f"Uploaded learning file: {file.filename}")
                except Exception as e:
                    logger.error(f"Failed to upload file {file.filename}: {str(e)}")
                    # Continue with other files
        
        # Step 4: Update training with file URLs
        update_data = {}
        if featured_image_url:
            update_data["featured_image_url"] = featured_image_url
        if uploaded_files:
            update_data["training_files"] = uploaded_files
        
        if update_data:
            training = await assigned_training_crud.update_assigned_training(
                db, 
                training.id, 
                **update_data
            )
            logger.info(f"Training {training.id} updated with {len(uploaded_files)} files")
        
        return AssignedTrainingResponse.from_orm(training)
        
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON in form fields: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Error creating training with files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create training: {str(e)}",
        )


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
    # Try cache first
    filters_data = {"skip": skip, "limit": limit, "active_only": active_only, "search": search}
    filters_hash = hashlib.md5(json.dumps(filters_data, sort_keys=True).encode()).hexdigest()
    cache_key = f"assigned_trainings:admin:{filters_hash}"

    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return AssignedTrainingListResponse(**cached_data)

    logger.debug(f"Cache MISS: {cache_key}")

    trainings, total = await assigned_training_crud.get_assigned_trainings(
        db,
        skip=skip,
        limit=limit,
        active_only=active_only,
        search=search,
    )

    # Convert S3 URLs to public URLs
    converted_trainings = [
        convert_training_urls(AssignedTrainingResponse.from_orm(t))
        for t in trainings
    ]

    response = AssignedTrainingListResponse(
        items=converted_trainings,
        total=total,
        skip=skip,
        limit=limit,
    )

    # Cache for 10 minutes
    await cache_service.set(cache_key, response.model_dump(), ttl=cache_service.TTL_ASSIGNED_TRAININGS)

    return response


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
    
    # Convert S3 URLs to public URLs
    training_response = AssignedTrainingResponse.from_orm(training)
    return convert_training_urls(training_response)


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
    # Try cache first
    filters_data = {"user_id": current_user.id, "skip": skip, "limit": limit}
    filters_hash = hashlib.md5(json.dumps(filters_data, sort_keys=True).encode()).hexdigest()
    cache_key = f"assigned_trainings:user:{filters_hash}"

    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return AssignedTrainingListResponse(**cached_data)

    logger.debug(f"Cache MISS: {cache_key}")

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

        # Convert S3 URLs to public URLs
        training_response = convert_training_urls(training_response)
        enriched_trainings.append(training_response)

    response = AssignedTrainingListResponse(
        items=enriched_trainings,
        total=total,
        skip=skip,
        limit=limit,
    )

    # Cache for 10 minutes
    await cache_service.set(cache_key, response.model_dump(), ttl=cache_service.TTL_ASSIGNED_TRAININGS)

    return response


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
    # Convert S3 URLs to public URLs
    training_response = convert_training_urls(training_response)
    
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
