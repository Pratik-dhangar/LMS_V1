"""CRUD operations for E-Commerce Products
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, or_, and_, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.ecommerce_model import (
    Product, ProductCategory, AgeGroup, SkillFocus, ProductVisibility,
    ProductAgeGroup, ProductSkillFocus
)
from app.schemas.product import (
    ProductCreate, ProductUpdate, ProductFilters,
    ProductCategoryCreate, ProductCategoryUpdate,
    AgeGroupCreate, AgeGroupUpdate,
    SkillFocusCreate, SkillFocusUpdate
)


# Category CRUD
async def create_category(
    db: AsyncSession, category_data: ProductCategoryCreate
) -> ProductCategory:
    """Create a new product category"""
    new_category = ProductCategory(**category_data.model_dump())
    db.add(new_category)
    await db.commit()
    await db.refresh(new_category)
    return new_category


async def get_all_categories(db: AsyncSession) -> List[ProductCategory]:
    """Get all product categories ordered by display_order"""
    result = await db.execute(
        select(ProductCategory).order_by(ProductCategory.display_order)
    )
    return result.scalars().all()


async def get_category_by_id(db: AsyncSession, category_id: UUID) -> Optional[ProductCategory]:
    """Get category by ID"""
    result = await db.execute(
        select(ProductCategory).where(ProductCategory.id == category_id)
    )
    return result.scalar_one_or_none()


async def update_category(
    db: AsyncSession, category_id: UUID, category_data: ProductCategoryUpdate
) -> Optional[ProductCategory]:
    """Update a product category"""
    category = await get_category_by_id(db, category_id)
    if not category:
        return None
    
    update_data = category_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    await db.commit()
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, category_id: UUID) -> bool:
    """Delete a product category"""
    category = await get_category_by_id(db, category_id)
    if not category:
        return False
    
    await db.delete(category)
    await db.commit()
    return True


# Age Group CRUD
async def create_age_group(
    db: AsyncSession, age_group_data: AgeGroupCreate
) -> AgeGroup:
    """Create a new age group"""
    new_age_group = AgeGroup(**age_group_data.model_dump())
    db.add(new_age_group)
    await db.commit()
    await db.refresh(new_age_group)
    return new_age_group


async def get_all_age_groups(db: AsyncSession) -> List[AgeGroup]:
    """Get all age groups ordered by min_age"""
    result = await db.execute(
        select(AgeGroup).order_by(AgeGroup.min_age.asc())
    )
    return result.scalars().all()


async def get_age_group_by_id(db: AsyncSession, age_group_id: UUID) -> Optional[AgeGroup]:
    """Get age group by ID"""
    result = await db.execute(
        select(AgeGroup).where(AgeGroup.id == age_group_id)
    )
    return result.scalar_one_or_none()


# Skill Focus CRUD
async def create_skill(
    db: AsyncSession, skill_data: SkillFocusCreate
) -> SkillFocus:
    """Create a new skill focus"""
    new_skill = SkillFocus(**skill_data.model_dump())
    db.add(new_skill)
    await db.commit()
    await db.refresh(new_skill)
    return new_skill


async def get_all_skills(db: AsyncSession) -> List[SkillFocus]:
    """Get all skills ordered by name"""
    result = await db.execute(
        select(SkillFocus).order_by(SkillFocus.name)
    )
    return result.scalars().all()


async def get_skill_by_id(db: AsyncSession, skill_id: UUID) -> Optional[SkillFocus]:
    """Get skill by ID"""
    result = await db.execute(
        select(SkillFocus).where(SkillFocus.id == skill_id)
    )
    return result.scalar_one_or_none()


# Product CRUD
async def create_product(
    db: AsyncSession, product_data: ProductCreate, admin_id: int, image_url: Optional[str] = None, thumbnail_url: Optional[str] = None
) -> Product:
    """Create a new product"""
    # Extract many-to-many relationship data
    age_group_ids = product_data.age_group_ids or []
    skill_ids = product_data.skill_ids or []
    
    # Create product without relationships first
    product_dict = product_data.model_dump(exclude={"age_group_ids", "skill_ids"})
    product_dict["created_by_id"] = admin_id
    if image_url:
        product_dict["image_url"] = image_url
    if thumbnail_url:
        product_dict["thumbnail_url"] = thumbnail_url
    
    new_product = Product(**product_dict)
    db.add(new_product)
    await db.flush()  # Get the product ID before adding relationships
    
    # Add age groups directly to association table (avoids lazy loading issues)
    if age_group_ids:
        for age_group_id in age_group_ids:
            assoc = ProductAgeGroup(
                product_id=new_product.id,
                age_group_id=age_group_id
            )
            db.add(assoc)
    
    # Add skills directly to association table (avoids lazy loading issues)
    if skill_ids:
        for skill_id in skill_ids:
            assoc = ProductSkillFocus(
                product_id=new_product.id,
                skill_id=skill_id
            )
            db.add(assoc)
    
    await db.commit()
    
    # Load relationships
    result = await db.execute(
        select(Product)
        .options(
            joinedload(Product.category),
            selectinload(Product.age_groups),
            selectinload(Product.skills)
        )
        .where(Product.id == new_product.id)
    )
    return result.scalar_one()


async def get_product_by_id(db: AsyncSession, product_id: UUID) -> Optional[Product]:
    """Get product by ID with all relationships"""
    result = await db.execute(
        select(Product)
        .options(
            joinedload(Product.category),
            selectinload(Product.age_groups),
            selectinload(Product.skills)
        )
        .where(Product.id == product_id)
        .where(Product.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_all_products(
    db: AsyncSession, include_drafts: bool = False
) -> List[Product]:
    """Get all products (admin view)"""
    query = select(Product).options(
        joinedload(Product.category),
        selectinload(Product.age_groups),
        selectinload(Product.skills)
    ).where(Product.deleted_at.is_(None))
    
    if not include_drafts:
        query = query.where(Product.visibility == ProductVisibility.PUBLISHED)
    
    result = await db.execute(query.order_by(Product.created_at.desc()))
    return result.scalars().all()


async def get_catalog_products(
    db: AsyncSession, filters: ProductFilters
) -> tuple[List[Product], int]:
    """Get products for catalog with filters and pagination"""
    query = select(Product).options(
        joinedload(Product.category),
        selectinload(Product.age_groups),
        selectinload(Product.skills)
    ).where(
        Product.visibility == ProductVisibility.PUBLISHED,
        Product.deleted_at.is_(None)
    )
    
    # Apply search filter
    if filters.search:
        search_term = f"%{filters.search}%"
        query = query.where(
            or_(
                Product.name.ilike(search_term),
                Product.description.ilike(search_term)
            )
        )
    
    # Apply category filter
    if filters.category_id:
        query = query.where(Product.category_id == filters.category_id)
    
    # Apply age group filter
    if filters.age_group_ids and filters.age_group_ids.strip():
        try:
            age_group_list = [UUID(id.strip()) for id in filters.age_group_ids.split(",") if id.strip()]
            if age_group_list:
                query = query.join(Product.age_groups).where(AgeGroup.id.in_(age_group_list))
        except ValueError:
            # Invalid UUID format, skip this filter
            pass
    
    # Apply skill filter
    if filters.skill_ids and filters.skill_ids.strip():
        try:
            skill_list = [UUID(id.strip()) for id in filters.skill_ids.split(",") if id.strip()]
            if skill_list:
                query = query.join(Product.skills).where(SkillFocus.id.in_(skill_list))
        except ValueError:
            # Invalid UUID format, skip this filter
            pass
    
    # Apply price filter
    if filters.price_min is not None:
        query = query.where(Product.price >= filters.price_min)
    if filters.price_max is not None:
        query = query.where(Product.price <= filters.price_max)
    
    # Count total results (before pagination)
    count_query = select(func.count(Product.id)).where(
        Product.visibility == ProductVisibility.PUBLISHED,
        Product.deleted_at.is_(None)
    )
    
    # Apply same filters to count query
    if filters.search:
        search_term = f"%{filters.search}%"
        count_query = count_query.where(
            or_(
                Product.name.ilike(search_term),
                Product.description.ilike(search_term)
            )
        )
    
    if filters.category_id:
        count_query = count_query.where(Product.category_id == filters.category_id)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply sorting
    if filters.sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif filters.sort == "price_desc":
        query = query.order_by(Product.price.desc())
    elif filters.sort == "newest":
        query = query.order_by(Product.created_at.desc())
    elif filters.sort == "bestseller":
        # TODO: Implement bestseller logic based on order count
        query = query.order_by(Product.created_at.desc())
    else:  # featured (default)
        # Featured: show "Recommended" tag first, then newest
        query = query.order_by(Product.created_at.desc())
    
    # Apply pagination
    offset = (filters.page - 1) * filters.limit
    query = query.offset(offset).limit(filters.limit)
    
    result = await db.execute(query)
    products = result.scalars().all()
    
    return products, total


async def update_product(
    db: AsyncSession, product_id: UUID, product_data: ProductUpdate, image_url: Optional[str] = None, thumbnail_url: Optional[str] = None
) -> Optional[Product]:
    """Update a product"""
    product = await get_product_by_id(db, product_id)
    if not product:
        return None
    
    # Extract many-to-many data
    update_dict = product_data.model_dump(exclude_unset=True, exclude={"age_group_ids", "skill_ids"})
    
    # Update simple fields
    for field, value in update_dict.items():
        setattr(product, field, value)
    
    if image_url:
        product.image_url = image_url
    if thumbnail_url:
        product.thumbnail_url = thumbnail_url
    
    # Update age groups if provided
    if product_data.age_group_ids is not None:
        # Delete old associations
        await db.execute(
            delete(ProductAgeGroup)
            .where(ProductAgeGroup.product_id == product_id)
        )
        # Add new associations
        for age_group_id in product_data.age_group_ids:
            assoc = ProductAgeGroup(
                product_id=product_id,
                age_group_id=age_group_id
            )
            db.add(assoc)
    
    # Update skills if provided
    if product_data.skill_ids is not None:
        # Delete old associations
        await db.execute(
            delete(ProductSkillFocus)
            .where(ProductSkillFocus.product_id == product_id)
        )
        # Add new associations
        for skill_id in product_data.skill_ids:
            assoc = ProductSkillFocus(
                product_id=product_id,
                skill_id=skill_id
            )
            db.add(assoc)
    
    await db.commit()
    
    # Reload with relationships
    return await get_product_by_id(db, product_id)


async def delete_product(db: AsyncSession, product_id: UUID) -> bool:
    """Soft delete a product"""
    product = await get_product_by_id(db, product_id)
    if not product:
        return False
    
    from datetime import datetime
    product.deleted_at = datetime.utcnow()
    await db.commit()
    return True


# Stock Management
async def adjust_stock(
    db: AsyncSession, product_id: UUID, quantity_change: int, reason: str = "Manual adjustment"
) -> Optional[Product]:
    """Adjust product stock by quantity (positive to add, negative to subtract)
    
    Args:
        db: Database session
        product_id: Product ID
        quantity_change: Quantity to add/subtract (positive = add, negative = subtract)
        reason: Reason for adjustment (e.g., "Order placed", "Stock added", "Damage")
    
    Returns:
        Updated Product object or None if not found
    """
    product = await get_product_by_id(db, product_id)
    if not product:
        return None
    
    # Update stock
    old_quantity = product.stock_quantity
    product.stock_quantity += quantity_change
    
    # Ensure stock doesn't go below 0
    if product.stock_quantity < 0:
        product.stock_quantity = 0
    
    await db.commit()
    await db.refresh(product)
    
    # Log the adjustment
    import logging
    logger = logging.getLogger(__name__)
    logger.info(
        f"Stock adjusted for product {product_id}: {old_quantity} → {product.stock_quantity} "
        f"(change: {quantity_change}) | Reason: {reason}"
    )
    
    return product


async def update_stock_quantity(
    db: AsyncSession, product_id: UUID, new_quantity: int
) -> Optional[Product]:
    """Update product stock to a specific quantity
    
    Args:
        db: Database session
        product_id: Product ID
        new_quantity: New stock quantity
    
    Returns:
        Updated Product object or None if not found
    """
    product = await get_product_by_id(db, product_id)
    if not product:
        return None
    
    old_quantity = product.stock_quantity
    product.stock_quantity = max(0, new_quantity)  # Ensure non-negative
    
    await db.commit()
    await db.refresh(product)
    
    # Log the update
    import logging
    logger = logging.getLogger(__name__)
    logger.info(
        f"Stock updated for product {product_id}: {old_quantity} → {product.stock_quantity}"
    )
    
    return product


async def get_low_stock_products(
    db: AsyncSession, threshold: int = 5
) -> List[Product]:
    """Get products with stock below threshold
    
    Args:
        db: Database session
        threshold: Stock level threshold (default 5)
    
    Returns:
        List of products with low stock
    """
    result = await db.execute(
        select(Product)
        .where(
            and_(
                Product.stock_quantity <= threshold,
                Product.stock_quantity >= 0,
                Product.deleted_at.is_(None)
            )
        )
        .order_by(Product.stock_quantity.asc())
    )
    return result.scalars().all()
