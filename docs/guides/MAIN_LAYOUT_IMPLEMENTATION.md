# MainLayout Component Implementation

## Overview
The `MainLayout` component is a React layout wrapper that provides consistent navigation and footer across all application pages using React Router's composition pattern.

## Location
`hurshbintech-frontend/src/components/layout/MainLayout.jsx`

## Implementation Details

### Structure
```jsx
const MainLayout = () => {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
};
```

### Key Features
- **Navbar**: Rendered at the top of every page
- **Outlet**: React Router component that renders child routes dynamically
- **Footer**: Rendered at the bottom of every page
- **Fragment Wrapper**: Uses `<>` to avoid unnecessary DOM nodes

## Benefits
1. **DRY Principle**: Eliminates redundant Navbar and Footer imports in every page component
2. **Consistency**: Ensures uniform layout structure across all routes
3. **Maintainability**: Layout changes propagate globally without modifying individual pages
4. **Scalability**: Easy to add new global layout elements (sidebars, modals, etc.)

## Usage
Define routes with MainLayout as parent in your router configuration:
```jsx
{
  element: <MainLayout />,
  children: [
    { path: '/', element: <Home /> },
    { path: '/about', element: <About /> },
    // Other routes...
  ]
}
```

## Related Components
- `Navbar`: Navigation menu component
- `Footer`: Footer component
- Child routes rendered via `<Outlet />`

## Last Updated
January 16, 2026
