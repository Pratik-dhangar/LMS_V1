# Playwright E2E Testing Configuration

## Installation

```bash
cd hurshbintech-frontend
npm install -D @playwright/test
npx playwright install
```

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests in UI mode
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/auth.spec.js
```

## Configuration

Tests are configured in `playwright.config.js` with:
- **Browsers**: Chromium, Firefox, WebKit
- **Base URL**: http://localhost:3000
- **Screenshots**: On failure
- **Videos**: On first retry

## Test Structure

```
hurshbintech-frontend/
├── tests/
│   └── e2e/
│       ├── auth.spec.js         # Authentication flows
│       ├── admin.spec.js        # Admin workflows
│       ├── trainer.spec.js      # Trainer session tests
│       └── learner.spec.js      # Learner workflows
```

## Writing Tests

```javascript
import { test, expect } from '@playwright/test';

test('user can login as admin', async ({ page }) => {
  await page.goto('/login');
  await page.selectOption('[name="role"]', 'admin');
  await page.fill('[name="passcode"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/admin/dashboard');
});
```

## Best Practices

1. **Use data-testid**: Add `data-testid` attributes to elements
2. **Wait for navigation**: Use `await page.waitForURL()`
3. **Clean state**: Reset database/auth between tests
4. **Parallel execution**: Tests run in parallel by default
5. **Screenshots**: Automatic on failure for debugging

## Environment Setup

Create `.env.test` in frontend:
```
VITE_API_BASE_URL=http://localhost:8000/api
VITE_API_TIMEOUT=10000
VITE_ENABLE_PWA=false
```

## CI/CD Integration

Tests run automatically in GitHub Actions on:
- Pull requests to main/develop
- Pushes to main/develop

See `.github/workflows/e2e.yml` for configuration.
