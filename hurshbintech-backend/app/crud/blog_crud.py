"""CRUD operations for Blog
"""
from typing import List, Optional
import re
from sqlalchemy import select, func, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.blog_model import Blog, BlogStatus
from app.schemas.blog import BlogCreate, BlogUpdate


def generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title"""
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s-]+', '-', slug)
    slug = slug.strip('-')
    return slug


class BlogCRUD:
    async def create_blog(self, db: AsyncSession, blog: BlogCreate, author_id: int) -> Blog:
        """Create a new blog post"""
        slug = generate_slug(blog.title)
        
        # Ensure slug is unique
        base_slug = slug
        counter = 1
        while await self.get_blog_by_slug(db, slug):
            slug = f"{base_slug}-{counter}"
            counter += 1
        
        db_blog = Blog(
            title=blog.title,
            slug=slug,
            excerpt=blog.excerpt,
            content=blog.content,
            featured_image_url=blog.featured_image_url,
            author_id=author_id,
            status=BlogStatus(blog.status),
        )
        db.add(db_blog)
        await db.commit()
        await db.refresh(db_blog)
        
        # Load author relationship
        await db.refresh(db_blog, ["author"])
        return db_blog

    async def get_blog(self, db: AsyncSession, blog_id: int) -> Optional[Blog]:
        """Get blog by ID"""
        result = await db.execute(
            select(Blog)
            .options(selectinload(Blog.author))
            .filter(Blog.id == blog_id)
        )
        return result.scalar_one_or_none()

    async def get_blog_by_slug(self, db: AsyncSession, slug: str) -> Optional[Blog]:
        """Get blog by slug"""
        result = await db.execute(
            select(Blog)
            .options(selectinload(Blog.author))
            .filter(Blog.slug == slug)
        )
        return result.scalar_one_or_none()

    async def get_blogs(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 10,
        status_filter: Optional[str] = None,
        search: Optional[str] = None
    ) -> tuple[List[Blog], int]:
        """Get blogs with pagination, filtering, and search"""
        query = select(Blog).options(selectinload(Blog.author))
        
        # Apply status filter
        if status_filter:
            query = query.filter(Blog.status == BlogStatus(status_filter))
        
        # Apply search filter
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Blog.title.ilike(search_term),
                    Blog.excerpt.ilike(search_term),
                    Blog.content.ilike(search_term)
                )
            )
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination and ordering
        query = query.order_by(Blog.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        blogs = result.scalars().all()
        
        return list(blogs), total

    async def update_blog(
        self,
        db: AsyncSession,
        blog_id: int,
        blog: BlogUpdate
    ) -> Optional[Blog]:
        """Update a blog post"""
        db_blog = await self.get_blog(db, blog_id)
        if not db_blog:
            return None

        update_data = blog.dict(exclude_unset=True)
        
        # Update slug if title changed
        if "title" in update_data:
            new_slug = generate_slug(update_data["title"])
            # Check if slug needs to be unique
            if new_slug != db_blog.slug:
                base_slug = new_slug
                counter = 1
                while await self.get_blog_by_slug(db, new_slug):
                    new_slug = f"{base_slug}-{counter}"
                    counter += 1
                update_data["slug"] = new_slug
        
        # Convert status string to enum if present
        if "status" in update_data:
            update_data["status"] = BlogStatus(update_data["status"])
        
        for key, value in update_data.items():
            setattr(db_blog, key, value)

        await db.commit()
        await db.refresh(db_blog)
        await db.refresh(db_blog, ["author"])
        return db_blog

    async def delete_blog(self, db: AsyncSession, blog_id: int) -> bool:
        """Delete a blog post"""
        try:
            stmt = delete(Blog).where(Blog.id == blog_id)
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount > 0
        except Exception as e:
            await db.rollback()
            raise


# Singleton instance
blog_crud = BlogCRUD()
