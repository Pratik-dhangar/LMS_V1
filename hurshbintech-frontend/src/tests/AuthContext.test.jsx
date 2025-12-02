/**
 * AuthContext tests
 * Tests authentication state management and user login
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import authService from '../api/services/authService';

// Mock authService
vi.mock('../api/services/authService', () => ({
    default: {
        userLogin: vi.fn(),
        logout: vi.fn(),
        getCurrentUser: vi.fn(),
    },
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock toast
vi.mock('react-toastify', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const wrapper = ({ children }) => (
        <BrowserRouter>
            <AuthProvider>{children}</AuthProvider>
        </BrowserRouter>
    );

    it('should initialize with no user when localStorage is empty', async () => {
        authService.getCurrentUser.mockReturnValue(null);

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => {
            expect(result.current.user).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.loading).toBe(false);
        });
    });

    it('should load user from localStorage on mount', async () => {
        const mockUser = { id: 1, role: 'admin', name: 'Test Admin' };
        authService.getCurrentUser.mockReturnValue(mockUser);
        localStorage.setItem('access_token', 'mock-token');

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => {
            expect(result.current.user).toEqual(mockUser);
            expect(result.current.isAuthenticated).toBe(true);
            expect(result.current.loading).toBe(false);
        });
    });

    it('should handle successful login', async () => {
        const mockResponse = {
            access_token: 'new-token',
            user_id: 1,
            role: 'admin',
            name: 'Admin User',
        };
        authService.userLogin.mockResolvedValue(mockResponse);

        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await result.current.userLogin({ role: 'admin', passcode: '123456' });
        });

        await waitFor(() => {
            expect(result.current.user).toEqual({
                id: 1,
                role: 'admin',
                name: 'Admin User',
            });
            expect(result.current.isAuthenticated).toBe(true);
            expect(localStorage.getItem('access_token')).toBe('new-token');
            expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
        });
    });

    it('should handle login error', async () => {
        const error = new Error('Invalid credentials');
        error.response = { data: { detail: 'Invalid credentials' } };
        authService.userLogin.mockRejectedValue(error);

        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await result.current.userLogin({ role: 'admin', passcode: 'wrong' });
        });

        await waitFor(() => {
            expect(result.current.user).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
        });
    });

    it('should redirect to correct dashboard based on role', async () => {
        const roles = [
            { role: 'admin', path: '/admin/dashboard' },
            { role: 'head', path: '/head/dashboard' },
            { role: 'trainer', path: '/trainer/dashboard' },
            { role: 'learner', path: '/learner/dashboard' },
        ];

        for (const { role, path } of roles) {
            mockNavigate.mockClear();
            authService.userLogin.mockResolvedValue({
                access_token: 'token',
                user_id: 1,
                role: role,
                name: 'Test User',
            });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await act(async () => {
                await result.current.userLogin({ role, passcode: '123456' });
            });

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(path);
            });
        }
    });

    it('should handle logout', async () => {
        const mockUser = { id: 1, role: 'admin', name: 'Test Admin' };
        authService.getCurrentUser.mockReturnValue(mockUser);
        localStorage.setItem('access_token', 'token');
        localStorage.setItem('user_data', JSON.stringify(mockUser));

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(true);
        });

        act(() => {
            result.current.logout();
        });

        await waitFor(() => {
            expect(result.current.user).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
            expect(authService.logout).toHaveBeenCalled();
        });
    });
});
