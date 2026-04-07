/**
 * useDeviceSession Hook
 * Manages WebSocket connection for real-time session invalidation
 * 
 * Features:
 * - Connects to session WebSocket after login
 * - Listens for session invalidation messages
 * - Handles automatic logout when session is invalidated on another device
 * - Provides device ID generation and persistence
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import logger from '../utils/logger';

// Generate and store device ID
const getOrCreateDeviceId = () => {
    const storageKey = 'app_device_id';
    let deviceId = localStorage.getItem(storageKey);

    if (!deviceId) {
        // Generate a unique device ID using crypto or UUID-like string
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(storageKey, deviceId);
    }

    return deviceId;
};

// Get device information
const getDeviceInfo = () => {
    const ua = navigator.userAgent;

    // Detect browser
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';

    if (ua.indexOf('Firefox') > -1) {
        browserName = 'Firefox';
        browserVersion = ua.split('Firefox/')[1]?.split(' ')[0] || 'Unknown';
    } else if (ua.indexOf('Chrome') > -1 && ua.indexOf('Chromium') === -1) {
        browserName = 'Chrome';
        browserVersion = ua.split('Chrome/')[1]?.split(' ')[0] || 'Unknown';
    } else if (ua.indexOf('Safari') > -1) {
        browserName = 'Safari';
        browserVersion = ua.split('Version/')[1]?.split(' ')[0] || 'Unknown';
    } else if (ua.indexOf('Edge') > -1) {
        browserName = 'Edge';
        browserVersion = ua.split('Edge/')[1]?.split(' ')[0] || 'Unknown';
    }

    // Detect device type
    let deviceType = 'desktop';
    if (ua.indexOf('Mobile') > -1 || ua.indexOf('Android') > -1) {
        deviceType = 'mobile';
    } else if (ua.indexOf('iPad') > -1 || ua.indexOf('Tablet') > -1) {
        deviceType = 'tablet';
    }

    // Device name
    const deviceName = `${browserName} on ${deviceType}`;

    return {
        device_id: getOrCreateDeviceId(),
        device_name: deviceName,
        device_type: deviceType,
        browser_info: `${browserName} ${browserVersion}`,
    };
};

/**
 * Hook for managing device session and WebSocket connection
 */
export const useDeviceSession = (accessToken, onSessionInvalidated) => {
    const navigate = useNavigate();
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    const reconnectDelayRef = useRef(1000); // Start with 1 second

    // Connect to session WebSocket
    const connectWebSocket = useCallback(() => {
        if (!accessToken) {
            logger.debug('useDeviceSession: No access token, skipping WebSocket connection');
            return;
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            logger.debug('useDeviceSession: WebSocket already connected');
            return;
        }

        try {
            const deviceInfo = getDeviceInfo();

            // Get backend URL from environment or use default
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

            // Build WS URL robustly from API base URL.
            const parsedApiUrl = new URL(apiBaseUrl);
            const wsProtocol = parsedApiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsBase = `${wsProtocol}//${parsedApiUrl.host}`;

            const deviceParam = encodeURIComponent(deviceInfo.device_id);

            const wsUrl = `${wsBase}/api/ws/session/${accessToken}?device_id=${deviceParam}`;

            logger.info('useDeviceSession: Connecting to session WebSocket', {
                url: wsUrl.replace(accessToken, '***'),
                deviceId: deviceInfo.device_id,
            });

            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                logger.info('useDeviceSession: WebSocket connected');
                reconnectAttemptsRef.current = 0;
                reconnectDelayRef.current = 1000;
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    logger.debug('useDeviceSession: Received message', message);

                    if (message.type === 'connected') {
                        logger.info('useDeviceSession: Session connection confirmed');
                    } else if (message.type === 'session_invalidated') {
                        logger.warn('useDeviceSession: Session invalidated by another device', message);
                        handleSessionInvalidated();
                    } else if (message.type === 'pong') {
                        // Heartbeat response
                        logger.debug('useDeviceSession: Pong received');
                    }
                } catch (error) {
                    logger.error('useDeviceSession: Error parsing message', error);
                }
            };

            ws.onerror = (error) => {
                logger.error('useDeviceSession: WebSocket error', error);
            };

            ws.onclose = (event) => {
                logger.info('useDeviceSession: WebSocket closed', {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean,
                });

                wsRef.current = null;

                // Handle special close codes
                if (event.code === 4000) {
                    // Session invalidated by server
                    logger.warn('useDeviceSession: Connection closed due to session invalidation');
                    handleSessionInvalidated();
                } else if (event.code === 1008) {
                    // Policy violation (invalid token)
                    logger.warn('useDeviceSession: Connection closed due to policy violation');
                    handleSessionInvalidated();
                } else if (event.wasClean === false && reconnectAttemptsRef.current < maxReconnectAttempts) {
                    // Unexpected close, try to reconnect
                    reconnectAttemptsRef.current++;
                    const delay = reconnectDelayRef.current * Math.pow(1.5, reconnectAttemptsRef.current - 1);
                    reconnectDelayRef.current = delay;

                    logger.info('useDeviceSession: Attempting to reconnect', {
                        attempt: reconnectAttemptsRef.current,
                        delay: Math.round(delay),
                    });

                    setTimeout(() => {
                        connectWebSocket();
                    }, delay);
                }
            };

            wsRef.current = ws;
        } catch (error) {
            logger.error('useDeviceSession: Error creating WebSocket', error);
        }
    }, [accessToken]);

    // Handle session invalidation
    const handleSessionInvalidated = useCallback(() => {
        logger.info('useDeviceSession: Handling session invalidation');

        // Clear stored session data
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_data');

        // Close WebSocket if open
        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch (e) {
                logger.error('useDeviceSession: Error closing WebSocket', e);
            }
            wsRef.current = null;
        }

        // Show custom notification modal
        if (onSessionInvalidated) {
            onSessionInvalidated();
        }

        // Navigate to login after a brief delay (allows modal to show)
        setTimeout(() => {
            navigate('/login');
        }, 1000);
    }, [navigate, onSessionInvalidated]);

    // Send heartbeat periodically
    useEffect(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
        }

        const heartbeatInterval = setInterval(() => {
            try {
                wsRef.current.send(JSON.stringify({ type: 'ping' }));
            } catch (error) {
                logger.error('useDeviceSession: Error sending heartbeat', error);
            }
        }, 30000); // Send ping every 30 seconds

        return () => clearInterval(heartbeatInterval);
    }, []);

    // Setup WebSocket connection on mount
    useEffect(() => {
        connectWebSocket();

        return () => {
            if (wsRef.current) {
                try {
                    wsRef.current.close();
                } catch (e) {
                    logger.error('useDeviceSession: Error during cleanup', e);
                }
            }
        };
    }, [connectWebSocket]);

    return {
        deviceInfo: getDeviceInfo(),
        isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    };
};

export { getDeviceInfo, getOrCreateDeviceId };
