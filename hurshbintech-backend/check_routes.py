from main import app

print("Registered routes:")
for route in app.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        methods = ', '.join(sorted(route.methods)) if route.methods else 'N/A'
        print(f"  [{methods:10}] {route.path}")
