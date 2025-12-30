"""API endpoints for E-Commerce Products (Admin)
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_db
from app.core.config import settings
from app.crud import product_crud
from app.models.user_model import User
from app.schemas.product import (
    ProductCreate, ProductUpdate, ProductResponse,
    ProductCategoryCreate, ProductCategoryUpdate, ProductCategoryResponse,
    AgeGroupCreate, AgeGroupUpdate, AgeGroupResponse,
    SkillFocusCreate, SkillFocusUpdate, SkillFocusResponse
)
from app.utils.file_handler import upload_file

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
        return category
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create category: {str(e)}"
        )


@router.get("/categories", response_model=List[ProductCategoryResponse])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Get all product categories (Public)"""
    categories = await product_crud.get_all_categories(db)
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
        return age_group
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create age group: {str(e)}"
        )


@router.get("/age-groups", response_model=List[AgeGroupResponse])
async def get_age_groups(db: AsyncSession = Depends(get_db)):
    """Get all age groups (Public)"""
    age_groups = await product_crud.get_all_age_groups(db)
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
        return skill
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create skill: {str(e)}"
        )


@router.get("/skills", response_model=List[SkillFocusResponse])
async def get_skills(db: AsyncSession = Depends(get_db)):
    """Get all skills (Public)"""
    skills = await product_crud.get_all_skills(db)
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
        
        # Upload image if provided
        if image:
            # Validate file type
            allowed_types = ["image/jpeg", "image/png", "image/jpg"]
            if image.content_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid image type. Only JPG and PNG are allowed."
                )
            
            # Validate file size (max 5MB)
            contents = await image.read()
            if len(contents) > 5 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Image size exceeds 5MB limit."
                )
            
            logger.info(f"Uploading image: {image.filename}, size: {len(contents)} bytes")
            
            # Upload to S3 (production) or local storage (development)
            try:
                image_url = await upload_file(
                    file_content=contents,
                    folder="products",
                    filename=image.filename,
                    content_type=image.content_type
                )
                logger.info(f"Image uploaded successfully: {image_url}")
            except Exception as e:
                logger.error(f"Failed to upload image: {str(e)}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to upload image: {str(e)}"
                )
        
        logger.info(f"Creating product in database with admin_id: {current_admin.id}")
        
        product = await product_crud.create_product(
            db, product_data, current_admin.id, image_url
        )
        logger.info(f"Product created successfully: {product.id}")
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
    
    # Upload new image if provided
    if image:
        allowed_types = ["image/jpeg", "image/png", "image/jpg"]
        if image.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid image type. Only JPG and PNG are allowed."
            )
        
        contents = await image.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image size exceeds 5MB limit."
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
                detail=f"Failed to upload image: {str(e)}"
            )
    
    product = await product_crud.update_product(db, product_id, product_data, image_url)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
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
