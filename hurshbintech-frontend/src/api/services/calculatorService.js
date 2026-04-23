/**
 * Calculator Service
 * 
 * Handles WebSocket communication for calculator operations
 * between instructor and attendee in real-time.
 * 
 * Message Types:
 * - calculator_operation: Number/operation input from attendee
 * - calculator_result: Calculation result
 * - calculator_clear: Clear calculator
 * - calculator_permission: Grant/revoke permission to use calculator
 * - calculator_sync: Sync calculator state
 */

class CalculatorService {
    constructor(whiteboardService) {
        this.whiteboardService = whiteboardService;

        // Callbacks for receiving calculator events
        this.onCalculatorOperation = null;
        this.onCalculatorResult = null;
        this.onCalculatorClear = null;
        this.onCalculatorPermission = null;
        this.onCalculatorSync = null;
    }

    /**
     * Register callbacks for calculator events
     */
    registerCallbacks() {
        if (!this.whiteboardService) {
            console.warn('CalculatorService: whiteboardService not initialized');
            return;
        }

        // Set callback for handling incoming calculator operations
        const originalOnMessage = this.whiteboardService.onMessage;
        this.whiteboardService.onMessage = (message) => {
            if (originalOnMessage) {
                originalOnMessage(message);
            }

            // Handle calculator-specific messages
            if (message.type && message.type.startsWith('calculator_')) {
                this.handleCalculatorMessage(message);
            }
        };
    }

    /**
     * Send calculator operation to the other participant
     */
    sendCalculatorOperation(action, data) {
        if (!this.whiteboardService) {
            console.error('CalculatorService: whiteboardService not initialized');
            return;
        }

        const message = {
            type: 'calculator_operation',
            action, // 'number_input', 'operation', 'equals', 'clear', 'backspace', etc.
            timestamp: Date.now(),
            data: {
                display: data.display,
                previousValue: data.previousValue,
                operation: data.operation,
                history: data.history || [],
                ...data
            }
        };

        this.whiteboardService.send('calculator_operation', message.data);
    }

    /**
     * Send calculator result from attendee
     */
    sendCalculatorResult(calculation, result) {
        if (!this.whiteboardService) {
            console.error('CalculatorService: whiteboardService not initialized');
            return;
        }

        const message = {
            type: 'calculator_result',
            calculation,
            result,
            timestamp: Date.now()
        };

        this.whiteboardService.send('calculator_result', message);
    }

    /**
     * Grant permission to attendee to use calculator
     */
    grantCalculatorPermission(enabled = true) {
        if (!this.whiteboardService) {
            console.error('CalculatorService: whiteboardService not initialized');
            return;
        }

        const message = {
            type: 'calculator_permission',
            enabled,
            timestamp: Date.now()
        };

        this.whiteboardService.send('calculator_permission', message);
    }

    /**
     * Sync calculator state (useful for restoration or re-sync)
     */
    syncCalculatorState(state) {
        if (!this.whiteboardService) {
            console.error('CalculatorService: whiteboardService not initialized');
            return;
        }

        const message = {
            type: 'calculator_sync',
            state: {
                display: state.display,
                previousValue: state.previousValue,
                operation: state.operation,
                history: state.history || [],
                timestamp: Date.now()
            }
        };

        this.whiteboardService.send('calculator_sync', message);
    }

    /**
     * Handle incoming calculator messages
     */
    handleCalculatorMessage(message) {
        try {
            switch (message.type) {
                case 'calculator_operation':
                    if (this.onCalculatorOperation) {
                        this.onCalculatorOperation(message.data);
                    }
                    break;

                case 'calculator_result':
                    if (this.onCalculatorResult) {
                        this.onCalculatorResult({
                            calculation: message.calculation,
                            result: message.result,
                            timestamp: message.timestamp
                        });
                    }
                    break;

                case 'calculator_clear':
                    if (this.onCalculatorClear) {
                        this.onCalculatorClear();
                    }
                    break;

                case 'calculator_permission':
                    if (this.onCalculatorPermission) {
                        this.onCalculatorPermission({
                            enabled: message.enabled,
                            timestamp: message.timestamp
                        });
                    }
                    break;

                case 'calculator_sync':
                    if (this.onCalculatorSync) {
                        this.onCalculatorSync(message.state);
                    }
                    break;

                default:
                    console.warn('Unknown calculator message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling calculator message:', error, message);
        }
    }

    /**
     * Clear all callbacks
     */
    clearCallbacks() {
        this.onCalculatorOperation = null;
        this.onCalculatorResult = null;
        this.onCalculatorClear = null;
        this.onCalculatorPermission = null;
        this.onCalculatorSync = null;
    }

    /**
     * Check if calculator service is ready
     */
    isReady() {
        return this.whiteboardService && this.whiteboardService.ws &&
            this.whiteboardService.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Wait for service to be ready
     */
    async waitForReady(timeoutMs = 5000) {
        const startTime = Date.now();
        while (!this.isReady()) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error('CalculatorService timeout waiting for ready state');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

export default CalculatorService;
