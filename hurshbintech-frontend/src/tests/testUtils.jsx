/**
 * Test utilities and helpers
 * Provides common testing utilities and mock data
 */
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(ui, options = {}) {
    const { initialUser = null, ...renderOptions } = options;

    // Mock localStorage for auth
    if (initialUser) {
        localStorage.setItem('access_token', 'mock-token');
        localStorage.setItem('user_data', JSON.stringify(initialUser));
    }

    const Wrapper = ({ children }) => (
        <BrowserRouter>
            <AuthProvider>{children}</AuthProvider>
        </BrowserRouter>
    );

    return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Mock user data for testing
 */
export const mockUsers = {
    admin: {
        id: 1,
        name: 'Test Admin',
        email: 'admin@test.com',
        role: 'admin',
    },
    head: {
        id: 2,
        name: 'Test Head',
        email: 'head@test.com',
        role: 'head',
    },
    trainer: {
        id: 3,
        name: 'Test Trainer',
        email: 'trainer@test.com',
        role: 'trainer',
    },
    learner: {
        id: 4,
        name: 'Test Learner',
        email: 'learner@test.com',
        role: 'learner',
    },
};

/**
 * Mock login response
 */
export const mockLoginResponse = (role = 'admin') => ({
    access_token: 'mock-jwt-token',
    token_type: 'bearer',
    user_id: mockUsers[role].id,
    name: mockUsers[role].name,
    role: role,
});

/**
 * Wait for async operations
 */
export const waitFor = (callback, options) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            callback();
            resolve();
        }, options?.timeout || 0);
    });
};

export * from '@testing-library/react';
