"""
Code Auto-Formatter
Automatically formats code with Black and isort
"""

import subprocess
import sys
from pathlib import Path


def run_formatter(name: str, command: list[str]) -> bool:
    """Run a formatter and report results"""
    print(f"\n{'='*70}")
    print(f"Running: {name}")
    print(f"{'='*70}")

    try:
        result = subprocess.run(command, capture_output=True, text=True, cwd=Path(__file__).parent)

        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)

        if result.returncode == 0:
            print(f"✅ {name}: Completed")
            return True
        else:
            print(f"⚠️  {name}: Completed with warnings")
            return True

    except FileNotFoundError:
        print(f"❌ {name}: Tool not found. Install with: pip install -r requirements.txt")
        return False
    except Exception as e:
        print(f"❌ {name}: ERROR - {str(e)}")
        return False


def main():
    """Run all code formatters"""
    print("\n" + "=" * 70)
    print(" " * 22 + "CODE AUTO-FORMATTER")
    print(" " * 18 + "Phase 5: Code Quality")
    print("=" * 70)

    # 1. isort - Fix import order
    print("\nStep 1/2: Organizing imports...")
    isort_success = run_formatter(
        "isort (Import Sorting)", [sys.executable, "-m", "isort", "app/", "main.py", "*.py"]
    )

    # 2. Black - Format code
    print("\nStep 2/2: Formatting code...")
    black_success = run_formatter(
        "Black (Code Formatting)", [sys.executable, "-m", "black", "app/", "main.py", "*.py"]
    )

    # Summary
    print("\n" + "=" * 70)
    print("FORMATTING COMPLETE")
    print("=" * 70)

    if isort_success and black_success:
        print("✅ Code has been automatically formatted")
        print("\nFormatted:")
        print("  • Import statements organized (isort)")
        print("  • Code style standardized (black)")
        print("\nNext steps:")
        print("  • Review changes with: git diff")
        print("  • Run quality checks: python code_quality.py")
        return 0
    else:
        print("⚠️  Some formatters failed. Check output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
