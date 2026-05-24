import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import './Calculator.css';

/**
 * Calculator Component for Children (Ages 1-12)
 * 
 * Features:
 * - Basic arithmetic operations (+, -, *, /)
 * - Number display and calculation history
 * - Real-time sync with instructor
 * - Permission-based access (instructor must grant permission)
 */
const Calculator = ({
    onCalculatorChange,
    isInstructor = false,
    hasPermission = false,
    remoteDisplay = null,
    remoteHistory = []
}) => {
    const containerRef = useRef(null);
    const dragStateRef = useRef({ active: false, offsetX: 0, offsetY: 0 });
    const hasPositionedRef = useRef(false);
    const [display, setDisplay] = useState('0');
    const [previousValue, setPreviousValue] = useState(null);
    const [operation, setOperation] = useState(null);
    const [waitingForNewValue, setWaitingForNewValue] = useState(false);
    const [history, setHistory] = useState([]);
    const [error, setError] = useState(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const clampToBounds = (nextX, nextY, bounds, elementBounds) => {
        const maxX = Math.max(0, bounds.width - elementBounds.width - 6);
        const maxY = Math.max(0, bounds.height - elementBounds.height - 6);

        return {
            x: Math.min(Math.max(6, nextX), maxX),
            y: Math.min(Math.max(6, nextY), maxY)
        };
    };

    const positionPanel = () => {
        const element = containerRef.current;
        const parent = element?.parentElement;

        if (!element || !parent) return;

        const parentBounds = parent.getBoundingClientRect();
        const elementBounds = element.getBoundingClientRect();

        if (parentBounds.width === 0 || parentBounds.height === 0 || elementBounds.width === 0 || elementBounds.height === 0) {
            return;
        }

        const nextPosition = clampToBounds(
            parentBounds.width - elementBounds.width - 6,
            parentBounds.height - elementBounds.height - 6,
            parentBounds,
            elementBounds
        );

        setPosition(nextPosition);
        hasPositionedRef.current = true;
    };

    const clampCurrentPosition = () => {
        const element = containerRef.current;
        const parent = element?.parentElement;

        if (!element || !parent) return;

        const parentBounds = parent.getBoundingClientRect();
        const elementBounds = element.getBoundingClientRect();
        setPosition((current) => {
            const nextPosition = clampToBounds(current.x, current.y, parentBounds, elementBounds);
            if (current.x === nextPosition.x && current.y === nextPosition.y) {
                return current;
            }
            return nextPosition;
        });
    };

    useLayoutEffect(() => {
        if (!hasPositionedRef.current) {
            positionPanel();
        } else {
            clampCurrentPosition();
        }
    });

    useEffect(() => {
        const handleResize = () => {
            clampCurrentPosition();
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // For instructor: show remote attendee's calculator state
    const displayValue = isInstructor && remoteDisplay !== null ? remoteDisplay : display;
    const historyItems = isInstructor && remoteHistory.length > 0 ? remoteHistory : history;

    const handleNumberClick = (num) => {
        if (!isInstructor && !hasPermission) {
            setError('Permission required to use calculator');
            return;
        }

        setError(null);

        let newDisplay = display;

        if (waitingForNewValue) {
            newDisplay = String(num);
            setWaitingForNewValue(false);
        } else {
            newDisplay = display === '0' ? String(num) : display + String(num);
        }

        setDisplay(newDisplay);
        notifyChange('number_input', { display: newDisplay });
    };

    const handleDecimalClick = () => {
        if (!isInstructor && !hasPermission) {
            setError('Permission required to use calculator');
            return;
        }

        setError(null);

        if (waitingForNewValue) {
            setDisplay('0.');
            setWaitingForNewValue(false);
        } else if (!display.includes('.')) {
            setDisplay(display + '.');
        }
    };

    const handleOperation = (op) => {
        if (!isInstructor && !hasPermission) {
            setError('Permission required to use calculator');
            return;
        }

        setError(null);
        const currentValue = parseFloat(display);

        if (previousValue === null) {
            setPreviousValue(currentValue);
        } else if (operation) {
            const result = performCalculation(previousValue, currentValue, operation);
            setDisplay(String(result));
            setPreviousValue(result);
        }

        setOperation(op);
        setWaitingForNewValue(true);
        notifyChange('operation', { operation: op, previousValue });
    };

    const performCalculation = (prev, current, op) => {
        let result;

        switch (op) {
            case '+':
                result = prev + current;
                break;
            case '-':
                result = prev - current;
                break;
            case '*':
                result = prev * current;
                break;
            case '/':
                if (current === 0) {
                    setError('Cannot divide by zero');
                    return prev;
                }
                result = prev / current;
                break;
            default:
                result = current;
        }

        return Math.round(result * 10000000) / 10000000; // Prevent floating point errors
    };

    const handleEquals = () => {
        if (!isInstructor && !hasPermission) {
            setError('Permission required to use calculator');
            return;
        }

        setError(null);

        if (operation && previousValue !== null) {
            const currentValue = parseFloat(display);
            const result = performCalculation(previousValue, currentValue, operation);

            // Add to history
            const calculationEntry = `${previousValue} ${operation} ${currentValue} = ${result}`;
            setHistory([...historyItems, calculationEntry]);

            setDisplay(String(result));
            setPreviousValue(null);
            setOperation(null);
            setWaitingForNewValue(true);

            notifyChange('equals', { result, calculation: calculationEntry });
        }
    };

    const handleClear = () => {
        if (!isInstructor && !hasPermission) {
            setError('Permission required to use calculator');
            return;
        }

        setError(null);
        setDisplay('0');
        setPreviousValue(null);
        setOperation(null);
        setHistory([]);
        setWaitingForNewValue(false);
        notifyChange('clear', {});
    };

    const handleBackspace = () => {
        if (!isInstructor && !hasPermission) {
            setError('Permission required to use calculator');
            return;
        }

        setError(null);

        if (display.length > 1) {
            setDisplay(display.slice(0, -1));
        } else {
            setDisplay('0');
        }
    };

    const notifyChange = (action, data) => {
        if (onCalculatorChange) {
            onCalculatorChange({
                action,
                display,
                previousValue,
                operation,
                history: historyItems,
                ...data
            });
        }
    };

    // Handle remote updates when instructor is viewing
    useEffect(() => {
        if (isInstructor && remoteDisplay !== null) {
            // Display is updated via remoteDisplay prop
        }
    }, [remoteDisplay, isInstructor]);

    useEffect(() => {
        const stopDrag = () => {
            dragStateRef.current.active = false;
        };

        const moveDrag = (event) => {
            if (!dragStateRef.current.active) return;

            const element = containerRef.current;
            const parent = element?.parentElement;
            if (!element || !parent) return;

            const parentBounds = parent.getBoundingClientRect();
            const elementBounds = element.getBoundingClientRect();
            const nextPosition = clampToBounds(
                event.clientX - parentBounds.left - dragStateRef.current.offsetX,
                event.clientY - parentBounds.top - dragStateRef.current.offsetY,
                parentBounds,
                elementBounds
            );

            setPosition(nextPosition);
        };

        window.addEventListener('pointermove', moveDrag);
        window.addEventListener('pointerup', stopDrag);
        window.addEventListener('pointercancel', stopDrag);

        return () => {
            window.removeEventListener('pointermove', moveDrag);
            window.removeEventListener('pointerup', stopDrag);
            window.removeEventListener('pointercancel', stopDrag);
        };
    }, []);

    const handleDragStart = (event) => {
        const element = containerRef.current;
        const parent = element?.parentElement;

        if (!element || !parent) return;

        const parentBounds = parent.getBoundingClientRect();
        dragStateRef.current = {
            active: true,
            offsetX: event.clientX - parentBounds.left - position.x,
            offsetY: event.clientY - parentBounds.top - position.y
        };

        event.preventDefault();
        event.stopPropagation();
    };

    const buttonClass = (isInstructor && !hasPermission) ? 'calculator-button disabled' : 'calculator-button';
    const operationButtonClass = (isInstructor && !hasPermission) ? 'calculator-button operation disabled' : 'calculator-button operation';

    return (
        <div
            ref={containerRef}
            className="calculator-container"
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
            <div className="calculator-header calculator-drag-handle" onPointerDown={handleDragStart}>
                <h3>Calculator</h3>
                {!isInstructor && !hasPermission && (
                    <div className="permission-badge">🔒 Waiting for permission</div>
                )}


            </div>

            <div className="calculator-display">
                <div className="display-value">{displayValue}</div>
                {operation && <div className="operation-indicator">{operation}</div>}
                {error && <div className="error-message">{error}</div>}
            </div>

            <div className="calculator-buttons">
                {/* Row 1: Clear, Backspace, Operations */}
                <button onClick={handleClear} className={`${buttonClass} clear`}>C</button>
                <button onClick={handleBackspace} className={`${buttonClass} backspace`}>←</button>
                <button onClick={() => handleOperation('/')} className={operationButtonClass}>÷</button>
                <button onClick={() => handleOperation('*')} className={operationButtonClass}>×</button>

                {/* Row 2: 7, 8, 9, Minus */}
                <button onClick={() => handleNumberClick(7)} className={buttonClass}>7</button>
                <button onClick={() => handleNumberClick(8)} className={buttonClass}>8</button>
                <button onClick={() => handleNumberClick(9)} className={buttonClass}>9</button>
                <button onClick={() => handleOperation('-')} className={operationButtonClass}>−</button>

                {/* Row 3: 4, 5, 6, Plus */}
                <button onClick={() => handleNumberClick(4)} className={buttonClass}>4</button>
                <button onClick={() => handleNumberClick(5)} className={buttonClass}>5</button>
                <button onClick={() => handleNumberClick(6)} className={buttonClass}>6</button>
                <button onClick={() => handleOperation('+')} className={operationButtonClass}>+</button>

                {/* Row 4: 1, 2, 3, Equals */}
                <button onClick={() => handleNumberClick(1)} className={buttonClass}>1</button>
                <button onClick={() => handleNumberClick(2)} className={buttonClass}>2</button>
                <button onClick={() => handleNumberClick(3)} className={buttonClass}>3</button>
                <button onClick={handleEquals} className={`${operationButtonClass} equals`}>=</button>

                {/* Row 5: 0, Decimal */}
                <button onClick={() => handleNumberClick(0)} className={`${buttonClass} zero`}>0</button>
                <button onClick={handleDecimalClick} className={buttonClass}>.</button>
            </div>

            {/* History Display */}
            {historyItems.length > 0 && (
                <div className="calculator-history">
                    <h4>History</h4>
                    <div className="history-list">
                        {historyItems.slice(-5).map((entry, index) => (
                            <div key={index} className="history-item">
                                {entry}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calculator;
