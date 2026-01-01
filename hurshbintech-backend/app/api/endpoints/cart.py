"""API endpoints for E-Commerce Cart
"""
from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.crud import ecommerce_crud, product_crud
from app.models.user_model import User
from app.schemas.ecommerce import (
    CartItemCreate, CartItemUpdate, CartItemResponse, CartResponse
)

router = APIRouter(prefix="/cart", tags=["Cart"])


def calculate_cart_totals(items):
    """Calculate cart totals"""
    subtotal = Decimal('0.00')
    discount_total = Decimal('0.00')
    
    for item in items:
        line_subtotal = Decimal(str(item.unit_price)) * item.quantity
        subtotal += line_subtotal
        
        if item.discount_percentage > 0:
            discount = line_subtotal * (Decimal(str(item.discount_percentage)) / 100)
            discount_total += discount
    
    total = subtotal - discount_total
    return float(subtotal), float(discount_total), float(total)


@router.get("", response_model=CartResponse)
async def get_cart(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's cart with all items"""
    cart = await ecommerce_crud.get_cart_with_items(db, current_user.id)
    
    if not cart:
        # Create empty cart
        cart = await ecommerce_crud.get_or_create_cart(db, current_user.id)
        return {
            "cart_id": cart.id,
            "items": [],
            "subtotal": 0.0,
            "discount_total": 0.0,
            "total": 0.0
        }
    
    # Build cart items response
    items_response = []
    for item in cart.items:
        product = item.product
        items_response.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": product.name if product else "Unknown Product",
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "discount_percentage": item.discount_percentage,
            "line_total": item.line_total,
            "image_url": product.image_url if product else None
        })
    
    subtotal, discount_total, total = calculate_cart_totals(cart.items)
    
    return {
        "cart_id": cart.id,
        "items": items_response,
        "subtotal": subtotal,
        "discount_total": discount_total,
        "total": total
    }


@router.post("/items", status_code=status.HTTP_201_CREATED)
async def add_to_cart(
    item_data: CartItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add item to cart"""
    # Verify product exists and is available
    product = await product_crud.get_product_by_id(db, item_data.product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    if not product.stock_available:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product out of stock")
    
    if product.stock_quantity < item_data.quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Insufficient stock. Only {product.stock_quantity} available."
        )
    
    # Get or create cart
    cart = await ecommerce_crud.get_or_create_cart(db, current_user.id)
    
    try:
        await ecommerce_crud.add_to_cart(db, cart.id, item_data)
        
        # Return updated cart
        updated_cart = await get_cart(db, current_user)
        return {"message": "Added to cart", "cart": updated_cart}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/items/{item_id}")
async def update_cart_item(
    item_id: UUID,
    update_data: CartItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update cart item quantity"""
    updated_item = await ecommerce_crud.update_cart_item(db, item_id, update_data)
    
    if not updated_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    
    # Verify item belongs to user's cart
    cart = await ecommerce_crud.get_cart_with_items(db, current_user.id)
    if not cart or item_id not in [item.id for item in cart.items]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
    
    # Return updated cart
    updated_cart = await get_cart(db, current_user)
    return {"message": "Cart updated", "cart": updated_cart}


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_cart(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove item from cart"""
    # Verify item belongs to user's cart
    cart = await ecommerce_crud.get_cart_with_items(db, current_user.id)
    if not cart or item_id not in [item.id for item in cart.items]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
    
    success = await ecommerce_crud.remove_from_cart(db, item_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_cart(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear all items from cart"""
    cart = await ecommerce_crud.get_or_create_cart(db, current_user.id)
    await ecommerce_crud.clear_cart(db, cart.id)
