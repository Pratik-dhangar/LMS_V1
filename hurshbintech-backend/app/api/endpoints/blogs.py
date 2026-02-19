"""
Blog API endpoints - Admin and Public routes
"""
import hashlib
import json
import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional
from math import ceil

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_admin, get_db
from app.crud.blog_crud import blog_crud
from app.models.user_model import User
from app.schemas.blog import BlogCreate, BlogUpdate, BlogResponse, BlogListResponse
from app.services.cache_service import cache_service
from app.utils.s3_utils import convert_s3_url_to_proxy
from app.utils.s3_utils import S3Manager

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize S3 manager if S3 is enabled
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
        s3_manager.create_s3_folders()
        logger.info("S3 manager initialized successfully for blogs")
    except Exception as e:
        logger.error(f"Failed to initialize S3 manager: {str(e)}")
else:
    # Local storage
    UPLOAD_DIR = "uploads/blogs"
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    logger.info(f"Blog images will be stored locally in: {UPLOAD_DIR}")

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


def get_public_url(file_url: str) -> str:
    """Convert S3 URL to permanent backend proxy URL (no expiration)"""
    try:
        if settings.USE_S3 and file_url and file_url.startswith("s3://"):
            return convert_s3_url_to_proxy(file_url)
        return file_url
    except Exception as e:
        logger.error(f"Error generating public URL: {str(e)}")
        return file_url


def convert_blog_response(blog) -> BlogResponse:
    """Convert S3 URLs in blog response to public HTTPS URLs"""
    blog_dict = {
        "id": blog.id,
        "title": blog.title,
        "slug": blog.slug,
        "excerpt": blog.excerpt,
        "content": blog.content,
        "featured_image_url": get_public_url(blog.featured_image_url) if blog.featured_image_url else None,
        "status": blog.status.value,
        "author_id": blog.author_id,
        "author": {
            "id": blog.author.id,
            "name": blog.author.name,
            "email": blog.author.email,
        },
        "created_at": blog.created_at,
        "updated_at": blog.updated_at,
    }
    return BlogResponse(**blog_dict)


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
                folder="blogs",
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
            return f"/uploads/blogs/{filename}"
    except Exception as e:
        logger.error(f"Error saving featured image: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save featured image"
        )


# ============================================================================
# ADMIN ENDPOINTS - Require admin authentication
# ============================================================================

@router.post("/admin/blogs", response_model=BlogResponse, status_code=status.HTTP_201_CREATED)
async def create_blog(
    title: str = Form(...),
    content: str = Form(...),
    excerpt: Optional[str] = Form(None),
    status: str = Form("draft"),
    featured_image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create a new blog post (Admin only)"""
    try:
        # Validate and save featured image if provided
        featured_image_url = None
        if featured_image and featured_image.filename:
            validate_image_file(featured_image)
            featured_image_url = await save_featured_image(featured_image)

        # Create blog
        blog_data = BlogCreate(
            title=title,
            excerpt=excerpt,
            content=content,
            featured_image_url=featured_image_url,
            status=status,
        )
        db_blog = await blog_crud.create_blog(db, blog_data, current_admin.id)
        
        # Invalidate blog caches
        await cache_service.invalidate_blogs()
        
        return convert_blog_response(db_blog)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating blog: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create blog post"
        )


@router.get("/admin/blogs", response_model=BlogListResponse)
async def get_admin_blogs(
    page: int = 1,
    per_page: int = 10,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get all blogs with pagination and filtering (Admin only)"""
    try:
        skip = (page - 1) * per_page
        blogs, total = await blog_crud.get_blogs(
            db,
            skip=skip,
            limit=per_page,
            status_filter=status_filter,
            search=search
        )
        
        total_pages = ceil(total / per_page) if per_page > 0 else 0
        
        return BlogListResponse(
            blogs=[convert_blog_response(blog) for blog in blogs],
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages
        )
    except Exception as e:
        logger.error(f"Error fetching admin blogs: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch blogs"
        )


@router.get("/admin/blogs/{blog_id}", response_model=BlogResponse)
async def get_admin_blog(
    blog_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get a single blog by ID (Admin only)"""
    db_blog = await blog_crud.get_blog(db, blog_id)
    if not db_blog:
        raise HTTPException(
            status_code=404,
            detail="Blog not found"
        )
    return convert_blog_response(db_blog)


@router.put("/admin/blogs/{blog_id}", response_model=BlogResponse)
async def update_blog(
    blog_id: int,
    title: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    excerpt: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    featured_image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update a blog post (Admin only)"""
    try:
        # Check if blog exists
        db_blog = await blog_crud.get_blog(db, blog_id)
        if not db_blog:
            raise HTTPException(
                status_code=404,
                detail="Blog not found"
            )

        # Handle featured image update
        featured_image_url = None
        if featured_image and featured_image.filename:
            validate_image_file(featured_image)
            featured_image_url = await save_featured_image(featured_image)

        # Prepare update data
        update_data = {}
        if title is not None:
            update_data["title"] = title
        if content is not None:
            update_data["content"] = content
        if excerpt is not None:
            update_data["excerpt"] = excerpt
        if status is not None:
            update_data["status"] = status
        if featured_image_url is not None:
            update_data["featured_image_url"] = featured_image_url

        blog_update = BlogUpdate(**update_data)
        updated_blog = await blog_crud.update_blog(db, blog_id, blog_update)
        
        # Invalidate blog caches (detail and lists)
        await cache_service.invalidate_blog(updated_blog.slug)
        
        return convert_blog_response(updated_blog)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating blog: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update blog post"
        )


@router.delete("/admin/blogs/{blog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blog(
    blog_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete a blog post (Admin only)"""
    try:
        logger.info(f"Attempting to delete blog ID: {blog_id}")
        
        # Get blog slug before deletion for cache invalidation
        db_blog = await blog_crud.get_blog(db, blog_id)
        if not db_blog:
            logger.warning(f"Blog ID {blog_id} not found")
            raise HTTPException(
                status_code=404,
                detail="Blog not found"
            )
        
        blog_slug = db_blog.slug
        success = await blog_crud.delete_blog(db, blog_id)
        
        # Invalidate blog caches
        await cache_service.invalidate_blog(blog_slug)
        
        logger.info(f"Successfully deleted blog ID: {blog_id}")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting blog ID {blog_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete blog post"
        )


# ============================================================================
# PUBLIC ENDPOINTS - No authentication required
# ============================================================================

@router.get("/blogs", response_model=BlogListResponse)
async def get_public_blogs(
    page: int = 1,
    per_page: int = 10,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get published blogs (Public endpoint) - Cached for 15 minutes"""
    try:
        # Generate cache key from filters
        filters = {"page": page, "per_page": per_page, "search": search, "status": "published"}
        filters_str = json.dumps(filters, sort_keys=True)
        filters_hash = hashlib.md5(filters_str.encode()).hexdigest()
        cache_key = cache_service.key_blogs_list(filters_hash)
        
        # Try cache first
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            logger.debug(f"Cache HIT: {cache_key}")
            return BlogListResponse(**cached_data)
        
        logger.debug(f"Cache MISS: {cache_key}")
        skip = (page - 1) * per_page
        blogs, total = await blog_crud.get_blogs(
            db,
            skip=skip,
            limit=per_page,
            status_filter="published",  # Only show published blogs
            search=search
        )
        
        total_pages = ceil(total / per_page) if per_page > 0 else 0
        
        response = BlogListResponse(
            blogs=[convert_blog_response(blog) for blog in blogs],
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages
        )
        
        # Cache response for 15 minutes
        await cache_service.set(cache_key, response.model_dump(), ttl=cache_service.TTL_BLOGS_LIST)
        
        return response
    except Exception as e:
        logger.error(f"Error fetching public blogs: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch blogs"
        )


@router.get("/blogs/{slug}", response_model=BlogResponse)
async def get_public_blog_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a published blog by slug (Public endpoint) - Cached for 30 minutes"""
    cache_key = cache_service.key_blog_detail(slug)
    
    # Try cache first
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return BlogResponse(**cached_data)
    
    logger.debug(f"Cache MISS: {cache_key}")
    db_blog = await blog_crud.get_blog_by_slug(db, slug)
    if not db_blog:
        raise HTTPException(
            status_code=404,
            detail="Blog not found"
        )
    
    # Only allow access to published blogs
    if db_blog.status.value != "published":
        raise HTTPException(
            status_code=404,
            detail="Blog not found"
        )
    
    response = convert_blog_response(db_blog)
    
    # Cache response for 30 minutes
    await cache_service.set(cache_key, response.model_dump(), ttl=cache_service.TTL_BLOG_DETAIL)
    
    return response
