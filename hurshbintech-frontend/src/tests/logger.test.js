/**
 * Logger utility tests
 * Tests environment-based logging functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import logger from '../utils/logger';

describe('Logger Utility', () => {
    let consoleLogSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('should have log method', () => {
        expect(logger.log).toBeDefined();
        expect(typeof logger.log).toBe('function');
    });

    it('should have error method', () => {
        expect(logger.error).toBeDefined();
        expect(typeof logger.error).toBe('function');
    });

    it('should have warn method', () => {
        expect(logger.warn).toBeDefined();
        expect(typeof logger.warn).toBe('function');
    });

    it('should have debug method', () => {
        expect(logger.debug).toBeDefined();
        expect(typeof logger.debug).toBe('function');
    });

    it('should have api method', () => {
        expect(logger.api).toBeDefined();
        expect(typeof logger.api).toBe('function');
    });

    it('should have component method', () => {
        expect(logger.component).toBeDefined();
        expect(typeof logger.component).toBe('function');
    });

    it('should always log errors', () => {
        logger.error('Test error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Test error');
    });

    it('should handle multiple arguments in error', () => {
        logger.error('Error:', { code: 500 });
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', { code: 500 });
    });
});
