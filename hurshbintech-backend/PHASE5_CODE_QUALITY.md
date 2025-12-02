# Phase 5: Code Quality Standards - Complete

## Overview
Phase 5 establishes code quality standards, automated formatting, type checking, and linting for maintainable, professional-grade code.

## Implemented Standards

### 1. Code Formatting with Black ✅
**Configuration**: `pyproject.toml`

Automatically formats Python code to a consistent style:
- **Line length**: 100 characters
- **Target version**: Python 3.10
- **Quote style**: Double quotes
- **Trailing commas**: Added automatically

#### Usage
```bash
# Check formatting
python -m black --check app/ main.py

# Auto-format code
python -m black app/ main.py

# Or use the formatter script
python format_code.py
```

#### Benefits
- Eliminates style debates
- Consistent code style across team
- Automatic formatting on save (with IDE integration)
- Reduces merge conflicts

### 2. Import Sorting with isort ✅
**Configuration**: `pyproject.toml`

Organizes imports automatically:
- **Profile**: Black-compatible
- **Line length**: 100 characters
- **Style**: Grouped and sorted

#### Import Order
1. Standard library imports
2. Third-party imports
3. Local application imports

#### Usage
```bash
# Check import order
python -m isort --check-only app/ main.py

# Fix import order
python -m isort app/ main.py

# Or use the formatter script
python format_code.py
```

### 3. Style Guide Enforcement with Flake8 ✅
**Configuration**: `.flake8`

Enforces PEP 8 style guide with customizations:
- **Max line length**: 100
- **Max complexity**: 10
- **Ignored rules**: E203, E266, E501, W503 (Black-compatible)

#### Checks
- Code style violations
- Unused imports
- Undefined names
- Complexity warnings
- Docstring presence

#### Usage
```bash
# Run style checks
python -m flake8 app/ main.py

# Or use the quality check script
python code_quality.py
```

### 4. Static Type Checking with MyPy ✅
**Configuration**: `pyproject.toml`

Performs static type analysis:
- **Python version**: 3.10
- **Check untyped defs**: Yes
- **Warn unused configs**: Yes
- **Strict optional**: Yes

#### Type Hint Examples
```python
from typing import Optional, List, Dict

def get_user(db: AsyncSession, user_id: int) -> Optional[User]:
    """Get user by ID"""
    pass

async def create_user(data: UserCreate) -> User:
    """Create new user"""
    pass

def get_metrics() -> Dict[str, any]:
    """Get application metrics"""
    pass
```

#### Usage
```bash
# Run type checks
python -m mypy app/ main.py --ignore-missing-imports

# Or use the quality check script
python code_quality.py
```

### 5. Pre-commit Hooks ✅
**Configuration**: `.pre-commit-config.yaml`

Automated checks before each commit:

#### Configured Hooks
1. **trailing-whitespace**: Remove trailing spaces
2. **end-of-file-fixer**: Ensure newline at EOF
3. **check-yaml**: Validate YAML files
4. **check-json**: Validate JSON files
5. **check-merge-conflict**: Detect merge markers
6. **detect-private-key**: Security check
7. **black**: Code formatting
8. **isort**: Import sorting
9. **flake8**: Style checking
10. **mypy**: Type checking

#### Setup
```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually on all files
pre-commit run --all-files
```

#### Workflow
```bash
git add .
git commit -m "Add new feature"
# Pre-commit hooks run automatically
# Commit fails if any check fails
# Fix issues and commit again
```

### 6. Automated Quality Checks ✅
**Script**: `code_quality.py`

Runs all quality checks in sequence:

#### Checks Performed
1. **Black**: Code formatting verification
2. **isort**: Import order verification
3. **Flake8**: Style guide compliance
4. **MyPy**: Type checking
5. **Pytest**: Unit test execution

#### Usage
```bash
# Run all quality checks
python code_quality.py

# Output shows pass/fail for each check
# Returns exit code 0 if all pass, 1 if any fail
```

### 7. Automated Code Formatting ✅
**Script**: `format_code.py`

Automatically formats code:

#### Operations
1. **isort**: Organizes imports
2. **black**: Formats code style

#### Usage
```bash
# Auto-format all code
python format_code.py

# Review changes
git diff

# Commit formatted code
git add .
git commit -m "Apply code formatting"
```

## Code Quality Standards

### Docstring Standards
**Style**: Google-style docstrings

#### Module Docstrings
```python
"""
Module Name and Purpose
Brief description of what this module does
"""
```

#### Function Docstrings
```python
def create_user(db: AsyncSession, user_data: UserCreate) -> User:
    """
    Create a new user in the database.
    
    Args:
        db: Database session
        user_data: User creation data
        
    Returns:
        Created user object
        
    Raises:
        HTTPException: If user already exists
    """
    pass
```

#### Class Docstrings
```python
class MetricsCollector:
    """
    Collects application metrics in memory.
    
    Thread-safe implementation for concurrent access.
    
    Attributes:
        start_time: Application start timestamp
        requests_total: Total request counter
    """
    pass
```

### Type Hint Standards

#### Always Use Type Hints
```python
# ✅ Good
def get_user(user_id: int) -> Optional[User]:
    pass

# ❌ Bad
def get_user(user_id):
    pass
```

#### Use Optional for Nullable
```python
# ✅ Good
def find_user(email: str) -> Optional[User]:
    pass

# ❌ Bad
def find_user(email: str) -> User:
    pass
```

#### Use List, Dict from typing
```python
from typing import List, Dict

# ✅ Good
def get_users() -> List[User]:
    pass

def get_metrics() -> Dict[str, int]:
    pass
```

### Naming Conventions

#### Variables and Functions
- **snake_case**: `user_name`, `get_user_by_id()`
- **Descriptive**: `auth_token` not `at`
- **Avoid abbreviations**: `database` not `db` in names

#### Classes
- **PascalCase**: `UserModel`, `MetricsCollector`
- **Descriptive**: `RequestLoggingMiddleware`

#### Constants
- **UPPER_SNAKE_CASE**: `MAX_RETRIES`, `DEFAULT_TIMEOUT`

#### Private Members
- **Leading underscore**: `_internal_method()`, `_cache`

### Code Organization

#### Import Order (enforced by isort)
```python
# 1. Standard library
import os
import sys
from datetime import datetime

# 2. Third-party packages
from fastapi import FastAPI
from sqlalchemy import select

# 3. Local application
from app.core.config import settings
from app.models.user_model import User
```

#### File Structure
```python
"""Module docstring"""

# Imports
import standard_library
import third_party
from app import local

# Constants
MAX_RETRIES = 3

# Classes
class MyClass:
    pass

# Functions
def my_function():
    pass

# Main execution
if __name__ == "__main__":
    pass
```

### Complexity Guidelines

#### Function Complexity
- **Max complexity**: 10 (enforced by Flake8)
- **Refactor** if complexity > 10
- **Split** complex functions into smaller ones

#### Function Length
- **Target**: < 50 lines
- **Max**: 100 lines
- **Refactor** longer functions

#### Class Size
- **Single responsibility**: One clear purpose
- **Refactor** if class has multiple responsibilities

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Code Quality

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run code quality checks
        run: python code_quality.py
```

### Pre-commit in CI
```yaml
- name: Run pre-commit
  run: |
    pip install pre-commit
    pre-commit run --all-files
```

## Editor Integration

### VS Code Settings
**`.vscode/settings.json`**:
```json
{
  "python.formatting.provider": "black",
  "python.formatting.blackArgs": ["--line-length", "100"],
  "python.linting.enabled": true,
  "python.linting.flake8Enabled": true,
  "python.linting.mypyEnabled": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

### PyCharm Settings
1. **File > Settings > Tools > Black**
   - Enable: On code reformat
   - Arguments: `--line-length 100`

2. **File > Settings > Tools > isort**
   - Enable: On code reformat

3. **File > Settings > Tools > External Tools**
   - Add Flake8 and MyPy

## Quality Metrics

### Target Metrics
- **Code coverage**: ≥ 70%
- **Flake8 violations**: 0
- **MyPy errors**: 0
- **Complexity**: ≤ 10 per function
- **Documentation**: 100% public APIs

### Current Status
Run `python code_quality.py` to see current metrics.

## Troubleshooting

### Black and Flake8 Conflicts
Some Flake8 rules conflict with Black. Configuration already excludes:
- **E203**: Whitespace before ':'
- **E501**: Line too long (Black handles this)
- **W503**: Line break before binary operator

### MyPy Import Errors
Use `--ignore-missing-imports` for third-party libraries:
```bash
python -m mypy app/ --ignore-missing-imports
```

### Pre-commit Hook Failures
```bash
# Skip hooks temporarily (not recommended)
git commit --no-verify

# Update hooks
pre-commit autoupdate

# Clear cache if issues persist
pre-commit clean
```

## Best Practices

### Before Committing
1. Run `python format_code.py` to auto-format
2. Run `python code_quality.py` to verify
3. Fix any issues reported
4. Commit changes

### Code Review Checklist
- [ ] All functions have type hints
- [ ] All public functions have docstrings
- [ ] Imports are organized (isort)
- [ ] Code is formatted (black)
- [ ] No flake8 violations
- [ ] No mypy errors
- [ ] Tests pass
- [ ] Code coverage maintained/improved

### New Feature Development
1. Write function signature with type hints
2. Add docstring
3. Implement function
4. Write tests
5. Run formatters
6. Run quality checks
7. Commit

## Quick Reference

### Commands
```bash
# Format code automatically
python format_code.py

# Run all quality checks
python code_quality.py

# Individual tools
python -m black app/ main.py
python -m isort app/ main.py
python -m flake8 app/ main.py
python -m mypy app/ main.py
python -m pytest -v

# Pre-commit hooks
pre-commit install
pre-commit run --all-files
```

### Configuration Files
- **pyproject.toml**: Black, isort, mypy, pytest configuration
- **.flake8**: Flake8 configuration
- **.pre-commit-config.yaml**: Pre-commit hooks

### Scripts
- **format_code.py**: Auto-format code
- **code_quality.py**: Run all checks
- **monitoring_test.py**: Test monitoring system
- **performance_test.py**: Test API performance

## Phase 5 Summary

### Implemented
- ✅ Black code formatting (100 char lines)
- ✅ isort import organization
- ✅ Flake8 style checking
- ✅ MyPy static type checking
- ✅ Pre-commit hooks (10 checks)
- ✅ Automated quality check script
- ✅ Automated formatting script
- ✅ Comprehensive configuration files
- ✅ Documentation and standards

### Files Created
- `pyproject.toml` - Tool configuration
- `.flake8` - Flake8 configuration
- `.pre-commit-config.yaml` - Pre-commit hooks
- `code_quality.py` - Quality check automation
- `format_code.py` - Code formatting automation
- `PHASE5_CODE_QUALITY.md` - This documentation

### Next Steps
1. Install tools: `pip install -r requirements.txt`
2. Format code: `python format_code.py`
3. Run checks: `python code_quality.py`
4. Install hooks: `pre-commit install`
5. Review and commit changes

**Phase 5: Code Quality complete!** 🎉
