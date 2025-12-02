/**
 * Environment-based logging utility
 * Only logs in development mode, silent in production
 */

const isDevelopment = import.meta.env.MODE === 'development';

const logger = {
    log: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    error: (...args) => {
        // Always log errors, but could send to error tracking service in production
        console.error(...args);
    },

    warn: (...args) => {
        if (isDevelopment) {
            console.warn(...args);
        }
    },

    debug: (...args) => {
        if (isDevelopment) {
            console.debug(...args);
        }
    },

    info: (...args) => {
        if (isDevelopment) {
            console.info(...args);
        }
    },

    /**
     * Log API request/response (excluding sensitive data)
     */
    api: (method, url, data = null) => {
        if (isDevelopment) {
            console.log(`[API ${method}]`, url, data);
        }
    },

    /**
     * Log component lifecycle events
     */
    component: (componentName, event, data = null) => {
        if (isDevelopment) {
            console.log(`[${componentName}] ${event}`, data || '');
        }
    }
};

export default logger;
