/**
 * ProtectedRoute component tests
 * Tests route protection and role-based access control
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { AuthProvider } from '../context/AuthContext';
import authService from '../api/services/authService';

// Mock authService
vi.mock('../api/services/authService', () => ({
    default: {
        getCurrentUser: vi.fn(),
    },
}));

// Mock toast
vi.mock('react-toastify', () => ({
    toast: {
        error: vi.fn(),
    },
}));

const TestComponent = () => <div>Protected Content</div>;

describe('ProtectedRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const renderProtectedRoute = (allowedRoles, user = null) => {
        if (user) {
            localStorage.setItem('access_token', 'mock-token');
            localStorage.setItem('user_data', JSON.stringify(user));
            authService.getCurrentUser.mockReturnValue(user);
        } else {
            authService.getCurrentUser.mockReturnValue(null);
        }

        return render(
            <BrowserRouter>
                <AuthProvider>
                    <Routes>
                        <Route
                            path="/protected"
                            element={
                                <ProtectedRoute allowedRoles={allowedRoles}>
                                    <TestComponent />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="/login" element={<div>Login Page</div>} />
                    </Routes>
                </AuthProvider>
            </BrowserRouter>
        );
    };

    it('should render protected content for authorized admin user', async () => {
        const adminUser = { id: 1, role: 'admin', name: 'Admin' };
        renderProtectedRoute(['admin'], adminUser);

        // Wait for auth to load
        await screen.findByText('Protected Content');
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should render protected content for authorized head user', async () => {
        const headUser = { id: 2, role: 'head', name: 'Head' };
        renderProtectedRoute(['head', 'admin'], headUser);

        await screen.findByText('Protected Content');
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should render protected content for any allowed role', async () => {
        const trainerUser = { id: 3, role: 'trainer', name: 'Trainer' };
        renderProtectedRoute(['admin', 'head', 'trainer'], trainerUser);

        await screen.findByText('Protected Content');
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should not render loading state initially', () => {
        const adminUser = { id: 1, role: 'admin', name: 'Admin' };
        authService.getCurrentUser.mockReturnValue(adminUser);
        localStorage.setItem('access_token', 'token');

        renderProtectedRoute(['admin'], adminUser);

        // Should not show loading
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
});
