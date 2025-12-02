"""
Code Quality Check Script
Runs all code quality tools and reports results
"""

import subprocess
import sys
from pathlib import Path


def run_command(name: str, command: list[str], stop_on_error: bool = False) -> bool:
    """Run a command and report results"""
    print(f"\n{'='*70}")
    print(f"Running: {name}")
    print(f"{'='*70}")

    try:
        result = subprocess.run(command, capture_output=True, text=True, cwd=Path(__file__).parent)

        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)

        if result.returncode == 0:
            print(f"✅ {name}: PASSED")
            return True
        else:
            print(f"❌ {name}: FAILED (exit code {result.returncode})")
            if stop_on_error:
                sys.exit(1)
            return False

    except FileNotFoundError:
        print(f"⚠️  {name}: Tool not found. Install with: pip install -r requirements.txt")
        return False
    except Exception as e:
        print(f"❌ {name}: ERROR - {str(e)}")
        return False


def main():
    """Run all code quality checks"""
    print("\n" + "=" * 70)
    print(" " * 20 + "CODE QUALITY CHECKS")
    print(" " * 18 + "Phase 5: Code Quality")
    print("=" * 70)

    results = {}

    # 1. Black - Code formatting check
    results["black"] = run_command(
        "Black (Code Formatting)",
        [sys.executable, "-m", "black", "--check", "--diff", "app/", "main.py"],
    )

    # 2. isort - Import sorting check
    results["isort"] = run_command(
        "isort (Import Sorting)",
        [sys.executable, "-m", "isort", "--check-only", "--diff", "app/", "main.py"],
    )

    # 3. Flake8 - Style guide enforcement
    results["flake8"] = run_command(
        "Flake8 (Style Guide)", [sys.executable, "-m", "flake8", "app/", "main.py"]
    )

    # 4. MyPy - Static type checking
    results["mypy"] = run_command(
        "MyPy (Type Checking)",
        [sys.executable, "-m", "mypy", "app/", "main.py", "--ignore-missing-imports"],
    )

    # 5. Pytest - Run tests
    results["pytest"] = run_command(
        "Pytest (Unit Tests)", [sys.executable, "-m", "pytest", "-v", "--tb=short"]
    )

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    passed = sum(1 for r in results.values() if r)
    total = len(results)

    for name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}  {name.capitalize()}")

    print("=" * 70)
    print(f"Results: {passed}/{total} checks passed ({passed/total*100:.0f}%)")

    if passed == total:
        print("\n🎉 All code quality checks passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} check(s) failed. Review output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
