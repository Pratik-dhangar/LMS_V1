"""API endpoints for E-Commerce Products (Admin)
"""
import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_db
from app.core.config import settings
from app.crud import product_crud
from app.models.user_model import User
from app.services.cache_service import cache_service
from app.schemas.product import (
    ProductCreate, ProductUpdate, ProductResponse,
    ProductCategoryCreate, ProductCategoryUpdate, ProductCategoryResponse,
    AgeGroupCreate, AgeGroupUpdate, AgeGroupResponse,
    SkillFocusCreate, SkillFocusUpdate, SkillFocusResponse
)
from app.utils.file_handler import upload_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/products", tags=["Products - Admin"])


# Category Endpoints
@router.post("/categories", response_model=ProductCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: ProductCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Create a new product category (Admin only)"""
    try:
        category = await product_crud.create_category(db, category_data)
        # Invalidate category cache
        await cache_service.invalidate_product_metadata()
        return category
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create category: {str(e)}"
        )


@router.get("/categories", response_model=List[ProductCategoryResponse])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Get all product categories (Public)"""
    try:
        # Try cache first
        cache_key = cache_service.key_product_categories()
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return cached
    except Exception as e:
        # Cache failed - log and continue to DB
        logger.warning(f"Cache retrieval failed for categories: {e}")
    
    # Cache miss - fetch from DB
    categories = await product_crud.get_all_categories(db)
    
    try:
        # Convert ORM objects to dicts before caching
        categories_data = [ProductCategoryResponse.model_validate(c).model_dump(mode="json") for c in categories]
        # Store in cache for 1 hour
        await cache_service.set(cache_key, categories_data, cache_service.TTL_PRODUCT_METADATA)
    except Exception as e:
        logger.warning(f"Cache storage failed for categories: {e}")
    
    return categories


@router.get("/categories/{category_id}", response_model=ProductCategoryResponse)
async def get_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get category by ID"""
    category = await product_crud.get_category_by_id(db, category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


@router.put("/categories/{category_id}", response_model=ProductCategoryResponse)
async def update_category(
    category_id: UUID,
    category_data: ProductCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Update a product category (Admin only)"""
    category = await product_crud.update_category(db, category_id, category_data)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    
    # Invalidate caches
    await cache_service.invalidate_product_metadata()
    await cache_service.invalidate_product_catalogs()
    
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Delete a product category (Admin only)"""
    success = await product_crud.delete_category(db, category_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    
    # Invalidate caches
    await cache_service.invalidate_product_metadata()
    await cache_service.invalidate_product_catalogs()


# Age Group Endpoints
@router.post("/age-groups", response_model=AgeGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_age_group(
    age_group_data: AgeGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Create a new age group (Admin only)"""
    try:
        age_group = await product_crud.create_age_group(db, age_group_data)
        # Invalidate age group cache
        await cache_service.invalidate_product_metadata()
        return age_group
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create age group: {str(e)}"
        )


@router.get("/age-groups", response_model=List[AgeGroupResponse])
async def get_age_groups(db: AsyncSession = Depends(get_db)):
    """Get all age groups (Public)"""
    try:
        # Try cache first
        cache_key = cache_service.key_age_groups()
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return cached
    except Exception as e:
        # Cache failed - log and continue to DB
        logger.warning(f"Cache retrieval failed for age groups: {e}")
    
    # Cache miss - fetch from DB
    age_groups = await product_crud.get_all_age_groups(db)
    
    try:
        # Convert ORM objects to dicts before caching
        age_groups_data = [AgeGroupResponse.model_validate(ag).model_dump(mode="json") for ag in age_groups]
        # Store in cache for 1 hour
        await cache_service.set(cache_key, age_groups_data, cache_service.TTL_PRODUCT_METADATA)
    except Exception as e:
        logger.warning(f"Cache storage failed for age groups: {e}")
    
    return age_groups


# Skill Focus Endpoints
@router.post("/skills", response_model=SkillFocusResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    skill_data: SkillFocusCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Create a new skill focus (Admin only)"""
    try:
        skill = await product_crud.create_skill(db, skill_data)
        # Invalidate skills cache
        await cache_service.invalidate_product_metadata()
        return skill
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create skill: {str(e)}"
        )


@router.get("/skills", response_model=List[SkillFocusResponse])
async def get_skills(db: AsyncSession = Depends(get_db)):
    """Get all skills (Public)"""
    # Try cache first
    cache_key = cache_service.key_skills()
    cached = await cache_service.get(cache_key)
    if cached is not None:
        return cached
    
    # Cache miss - fetch from DB
    skills = await product_crud.get_all_skills(db)
    
    # Convert ORM objects to dicts before caching
    try:
        skills_data = [SkillFocusResponse.model_validate(s).model_dump(mode="json") for s in skills]
        # Store in cache for 1 hour
        await cache_service.set(cache_key, skills_data, cache_service.TTL_PRODUCT_METADATA)
    except Exception as e:
        logger.warning(f"Cache storage failed for skills: {e}")
    
    return skills


# Product Endpoints
@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    name: str = Form(...),
    description: str = Form(""),
    category_id: str = Form(""),  # Accept as string, convert to UUID
    price: float = Form(...),
    discount_percentage: float = Form(0.0),
    stock_quantity: int = Form(0),
    visibility: str = Form("DRAFT"),
    age_group_ids: List[str] = Form([]),  # Accept as strings, convert to UUID
    skill_ids: List[str] = Form([]),  # Accept as strings, convert to UUID
    tags: List[str] = Form([]),
    image: UploadFile = File(None),
    thumbnail: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Create a new product (Admin only)"""
    from decimal import Decimal
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Product creation request - name: {name}, category_id: {category_id}, price: {price}")
        
        # Convert string IDs to UUID
        category_id_uuid = None
        if category_id and category_id.strip():
            try:
                category_id_uuid = UUID(category_id)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid category_id format: {str(e)}"
                )
        
        age_group_ids_uuid = []
        if age_group_ids:
            for id_str in age_group_ids:
                if id_str and id_str.strip():
                    try:
                        age_group_ids_uuid.append(UUID(id_str))
                    except ValueError as e:
                        logger.warning(f"Invalid age_group_id: {id_str}, error: {e}")
        
        skill_ids_uuid = []
        if skill_ids:
            for id_str in skill_ids:
                if id_str and id_str.strip():
                    try:
                        skill_ids_uuid.append(UUID(id_str))
                    except ValueError as e:
                        logger.warning(f"Invalid skill_id: {id_str}, error: {e}")
        
        logger.info(f"Converted UUIDs - category: {category_id_uuid}, age_groups: {age_group_ids_uuid}, skills: {skill_ids_uuid}")
        
        # Create ProductCreate instance from form fields
        product_data = ProductCreate(
            name=name,
            description=description or "",
            category_id=category_id_uuid,
            price=Decimal(str(price)),
            discount_percentage=Decimal(str(discount_percentage)) if discount_percentage else Decimal("0"),
            stock_quantity=stock_quantity or 0,
            visibility=visibility or "DRAFT",
            age_group_ids=age_group_ids_uuid,
            skill_ids=skill_ids_uuid,
            tags=tags if tags else []
        )
        
        logger.info(f"ProductCreate model created: {product_data}")
        
        image_url = None
        thumbnail_url = None
        
        # Upload thumbnail if provided (images only, small size)
        if thumbnail:
            allowed_thumb_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
            if thumbnail.content_type not in allowed_thumb_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid thumbnail type. Allowed: JPG, PNG, WEBP."
                )
            thumb_contents = await thumbnail.read()
            if len(thumb_contents) > 1 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Thumbnail size exceeds 1MB limit."
                )
            try:
                thumbnail_url = await upload_file(
                    file_content=thumb_contents,
                    folder="products/thumbnails",
                    filename=thumbnail.filename,
                    content_type=thumbnail.content_type
                )
            except Exception as e:
                logger.error(f"Failed to upload thumbnail: {str(e)}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to upload thumbnail: {str(e)}"
                )

        # Upload file if provided (images, PDFs, videos)
        if image:
            # Validate file type
            allowed_types = [
                "image/jpeg", "image/png", "image/jpg",
                "application/pdf",
                "video/mp4", "video/quicktime"
            ]
            if image.content_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid file type. Allowed types: JPG, PNG, PDF, MP4."
                )

            # Read contents and validate size per type
            contents = await image.read()
            # Determine max size (bytes) per content type
            if image.content_type.startswith("image/"):
                max_size = 5 * 1024 * 1024
                max_mb = 5
            elif image.content_type == "application/pdf":
                max_size = 10 * 1024 * 1024
                max_mb = 10
            elif image.content_type.startswith("video/"):
                max_size = 50 * 1024 * 1024
                max_mb = 50
            else:
                max_size = 5 * 1024 * 1024
                max_mb = 5

            if len(contents) > max_size:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File size exceeds {max_mb}MB limit."
                )

            logger.info(f"Uploading file: {image.filename}, type: {image.content_type}, size: {len(contents)} bytes")

            # Upload to S3 (production) or local storage (development)
            try:
                image_url = await upload_file(
                    file_content=contents,
                    folder="products",
                    filename=image.filename,
                    content_type=image.content_type
                )
                logger.info(f"File uploaded successfully: {image_url}")
            except Exception as e:
                logger.error(f"Failed to upload file: {str(e)}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to upload file: {str(e)}"
                )
        
        logger.info(f"Creating product in database with admin_id: {current_admin.id}")
        
        product = await product_crud.create_product(
            db, product_data, current_admin.id, image_url, thumbnail_url
        )
        logger.info(f"Product created successfully: {product.id}")
        # Log stored description for debugging whitespace/empty-description issues
        logger.info(f"Product description stored: {product.description!r}")
        
        # Invalidate product catalog caches
        await cache_service.invalidate_product_catalogs()
        
        return product
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in create_product: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create product: {str(e)}"
        )


@router.get("", response_model=List[ProductResponse])
async def get_all_products(
    include_drafts: bool = False,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get all products (Admin only)"""
    products = await product_crud.get_all_products(db, include_drafts)
    return products


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get product by ID"""
    product = await product_crud.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    name: str = Form(None),
    description: str = Form(None),
    category_id: str = Form(None),  # Accept as string, convert to UUID
    price: float = Form(None),
    discount_percentage: float = Form(None),
    stock_quantity: int = Form(None),
    visibility: str = Form(None),
    age_group_ids: List[str] = Form(default=[]),  # Accept as strings, convert to UUID
    skill_ids: List[str] = Form(default=[]),  # Accept as strings, convert to UUID
    tags: List[str] = Form(default=[]),
    image: UploadFile = File(None),
    thumbnail: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Update a product (Admin only)"""
    from decimal import Decimal
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Build ProductUpdate instance only with provided fields
    # Convert string IDs to UUID
    category_id_uuid = UUID(category_id) if category_id else None
    age_group_ids_uuid = [UUID(id) for id in age_group_ids if id] if age_group_ids else []
    skill_ids_uuid = [UUID(id) for id in skill_ids if id] if skill_ids else []
    
    update_data = {}
    if name is not None:
        update_data['name'] = name
    if description is not None:
        update_data['description'] = description
    if category_id_uuid is not None:
        update_data['category_id'] = category_id_uuid
    if price is not None:
        update_data['price'] = Decimal(str(price))
    if discount_percentage is not None:
        update_data['discount_percentage'] = Decimal(str(discount_percentage))
    if stock_quantity is not None:
        update_data['stock_quantity'] = stock_quantity
    if visibility is not None:
        update_data['visibility'] = visibility
    if tags:
        update_data['tags'] = tags
    if age_group_ids_uuid:
        update_data['age_group_ids'] = age_group_ids_uuid
    if skill_ids_uuid:
        update_data['skill_ids'] = skill_ids_uuid
    
    product_data = ProductUpdate(**update_data)
    image_url = None
    thumbnail_url = None
    
    # Upload new thumbnail if provided
    if thumbnail:
        allowed_thumb_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
        if thumbnail.content_type not in allowed_thumb_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid thumbnail type. Allowed: JPG, PNG, WEBP."
            )
        thumb_contents = await thumbnail.read()
        if len(thumb_contents) > 1 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Thumbnail size exceeds 1MB limit."
            )
        try:
            thumbnail_url = await upload_file(
                file_content=thumb_contents,
                folder="products/thumbnails",
                filename=thumbnail.filename,
                content_type=thumbnail.content_type
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to upload thumbnail: {str(e)}"
            )

    # Upload new file if provided (images, PDFs, videos)
    if image:
        allowed_types = [
            "image/jpeg", "image/png", "image/jpg",
            "application/pdf",
            "video/mp4", "video/quicktime"
        ]
        if image.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type. Allowed types: JPG, PNG, PDF, MP4."
            )

        contents = await image.read()
        if image.content_type.startswith("image/"):
            max_size = 5 * 1024 * 1024
            max_mb = 5
        elif image.content_type == "application/pdf":
            max_size = 10 * 1024 * 1024
            max_mb = 10
        elif image.content_type.startswith("video/"):
            max_size = 50 * 1024 * 1024
            max_mb = 50
        else:
            max_size = 5 * 1024 * 1024
            max_mb = 5

        if len(contents) > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds {max_mb}MB limit."
            )

        # Upload to S3 (production) or local storage (development)
        try:
            image_url = await upload_file(
                file_content=contents,
                folder="products",
                filename=image.filename,
                content_type=image.content_type
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to upload file: {str(e)}"
            )
    
    product = await product_crud.update_product(db, product_id, product_data, image_url, thumbnail_url)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    # Invalidate product caches (always clear catalogs when updating)
    logger.info(f"Product {product_id} updated. Visibility: {product.visibility}. Invalidating caches...")
    await cache_service.invalidate_product(str(product_id))
    logger.info(f"Product {product_id} cache invalidated successfully")
    
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Soft delete a product (Admin only)"""
    success = await product_crud.delete_product(db, product_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    # Invalidate product caches
    await cache_service.invalidate_product(str(product_id))
