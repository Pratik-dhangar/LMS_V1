#!/usr/bin/env python
"""
Seed script to add categories, age groups, and skills directly to the database
Run this from the backend directory: python scripts/add_product_metadata.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.ecommerce_model import ProductCategory, AgeGroup, SkillFocus
from app.db.session import engine


# Data to insert
CATEGORIES = [
    {'name': 'Books & E-books', 'description': 'Digital and physical books for learning'},
    {'name': 'Video Courses', 'description': 'Complete video course materials'},
    {'name': 'Worksheets & Guides', 'description': 'Practice worksheets and study guides'},
    {'name': 'Training Programs', 'description': 'Complete training and certification programs'},
    {'name': 'Assessment Tools', 'description': 'Quizzes, tests, and assessment materials'},
    {'name': 'Templates & Resources', 'description': 'Ready-to-use templates and resources'},
    {'name': 'Coaching Materials', 'description': 'Coaching and mentoring resources'},
    {'name': 'Certifications', 'description': 'Certification exam preparation materials'},
]

AGE_GROUPS = [
    {'name': 'Kids (5-8)', 'min_age': 5, 'max_age': 8},
    {'name': 'Tweens (9-12)', 'min_age': 9, 'max_age': 12},
    {'name': 'Teens (13-17)', 'min_age': 13, 'max_age': 17},
    {'name': 'Young Adults (18-25)', 'min_age': 18, 'max_age': 25},
    {'name': 'Adults (26-40)', 'min_age': 26, 'max_age': 40},
    {'name': 'Senior Adults (40+)', 'min_age': 40, 'max_age': None},
]

SKILLS = [
    {'name': 'Communication', 'description': 'Enhance communication and presentation skills'},
    {'name': 'Leadership', 'description': 'Develop leadership and management capabilities'},
    {'name': 'Technical Skills', 'description': 'Build technical and programming expertise'},
    {'name': 'Personality Development', 'description': 'Personal growth and development'},
    {'name': 'Problem Solving', 'description': 'Analytical and problem-solving abilities'},
    {'name': 'Time Management', 'description': 'Effective time and project management'},
    {'name': 'Creativity', 'description': 'Creative thinking and innovation'},
    {'name': 'Financial Literacy', 'description': 'Understanding finance and investments'},
    {'name': 'Digital Marketing', 'description': 'Modern digital marketing skills'},
    {'name': 'Soft Skills', 'description': 'Essential workplace soft skills'},
]


async def main():
    """Main function to seed the database"""
    
    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        future=True
    )
    
    try:
        async with async_session() as session:
            print("🔄 Checking existing data...")
            
            # Check categories
            from sqlalchemy import select
            
            existing_cats = await session.execute(select(ProductCategory))
            existing_cats_count = len(existing_cats.scalars().all())
            
            existing_ages = await session.execute(select(AgeGroup))
            existing_ages_count = len(existing_ages.scalars().all())
            
            existing_skills = await session.execute(select(SkillFocus))
            existing_skills_count = len(existing_skills.scalars().all())
            
            print(f"Found: {existing_cats_count} categories, {existing_ages_count} age groups, {existing_skills_count} skills")
            
            # Add categories
            if existing_cats_count == 0:
                print("\n📦 Adding categories...")
                for cat_data in CATEGORIES:
                    category = ProductCategory(**cat_data)
                    session.add(category)
                    print(f"  ✓ {cat_data['name']}")
                await session.commit()
                print(f"✅ Added {len(CATEGORIES)} categories")
            else:
                print("✓ Categories already exist, skipping...")
            
            # Add age groups
            if existing_ages_count == 0:
                print("\n👥 Adding age groups...")
                for age_data in AGE_GROUPS:
                    age_group = AgeGroup(**age_data)
                    session.add(age_group)
                    print(f"  ✓ {age_data['name']}")
                await session.commit()
                print(f"✅ Added {len(AGE_GROUPS)} age groups")
            else:
                print("✓ Age groups already exist, skipping...")
            
            # Add skills
            if existing_skills_count == 0:
                print("\n🎯 Adding skills...")
                for skill_data in SKILLS:
                    skill = SkillFocus(**skill_data)
                    session.add(skill)
                    print(f"  ✓ {skill_data['name']}")
                await session.commit()
                print(f"✅ Added {len(SKILLS)} skills")
            else:
                print("✓ Skills already exist, skipping...")
            
            print("\n✅ Database seeding completed successfully!")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await engine.dispose()


if __name__ == '__main__':
    print("🚀 Starting database seeding...\n")
    asyncio.run(main())
