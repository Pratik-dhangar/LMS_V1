#!/usr/bin/env python3
"""Test script to verify receipt data in admin orders API"""
import asyncio
import sys
import json
sys.path.insert(0, 'd:\\Hurshbintech-PWA-Deploy\\hurshbintech\\hurshbintech-backend')

from app.db.session import AsyncSessionLocal
from app.crud import ecommerce_crud

async def test_admin_orders():
    """Test the admin orders endpoint logic"""
    async with AsyncSessionLocal() as db:
        orders, total = await ecommerce_crud.get_orders_for_admin(db, status="PAYMENT_UPLOADED", page=1, limit=20)
        
        print(f"\nTotal orders: {total}")
        print(f"Orders returned: {len(orders)}\n")
        
        for order in orders:
            print(f"Order: {order.order_number}")
            print(f"  - Status: {order.status}")
            print(f"  - Payment Receipt object: {order.payment_receipt}")
            print(f"  - Has payment_receipt attr: {hasattr(order, 'payment_receipt')}")
            
            if order.payment_receipt:
                print(f"  ✓ Receipt found!")
                print(f"    - File Name: {order.payment_receipt.file_name}")
                print(f"    - File Type: {order.payment_receipt.file_type}")
                print(f"    - S3 Path: {order.payment_receipt.s3_path}")
            else:
                print(f"  ✗ No receipt found")
            print()

if __name__ == "__main__":
    asyncio.run(test_admin_orders())
