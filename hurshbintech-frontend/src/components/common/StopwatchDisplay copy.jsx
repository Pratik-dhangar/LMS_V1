import React from 'react';

/**
 * StopwatchDisplay Component
 * Displays stopwatch time with controls
 * Can be used as standalone display or with control buttons
 * 
 * @param {Object} formattedTime - Formatted time object { hours, minutes, seconds, display }
 * @param {boolean} isRunning - Is the stopwatch currently running
 * @param {Function} onStart - Callback for start button
 * @param {Function} onPause - Callback for pause button
 * @param {Function} onResume - Callback for resume button
 * @param {Function} onReset - Callback for reset button
 * @param {Function} onSetTime - Callback for setting time (hours, minutes, seconds)
 * @param {boolean} showControls - Show control buttons (default: true)
 * @param {string} size - Size variant: 'sm', 'md', 'lg' (default: 'md')
 * @param {string} variant - Display variant: 'compact', 'standard' (default: 'standard')
 */
const StopwatchDisplay = ({
    formattedTime = { hours: '00', minutes: '00', seconds: '00', display: '00:00:00' },
    isRunning = false,
    onStart = () => { },
    onPause = () => { },
    onResume = () => { },
    onReset = () => { },
    onSetTime = () => { },
    showControls = true,
    size = 'md',
    variant = 'standard'
}) => {
    // ==================== TIME INPUT STATE ====================
    const [inputHours, setInputHours] = React.useState(formattedTime.hours);
    const [inputMinutes, setInputMinutes] = React.useState(formattedTime.minutes);
    const [inputSeconds, setInputSeconds] = React.useState(formattedTime.seconds);
    const [showSetTime, setShowSetTime] = React.useState(false);

    // Handle set time button click
    const handleSetTimeClick = () => {
        const h = Math.max(0, parseInt(inputHours) || 0);
        const m = Math.max(0, Math.min(59, parseInt(inputMinutes) || 0));
        const s = Math.max(0, Math.min(59, parseInt(inputSeconds) || 0));
        onSetTime(h, m, s);
        setShowSetTime(false);
    };

    // Update input values when formattedTime changes
    React.useEffect(() => {
        if (!showSetTime) {
            setInputHours(formattedTime.hours);
            setInputMinutes(formattedTime.minutes);
            setInputSeconds(formattedTime.seconds);
        }
    }, [formattedTime, showSetTime]);

    // ==================== SIZE MAPPINGS ====================
    const sizeClasses = {
        sm: {
            time: 'text-xl',
            label: 'text-xs',
            button: 'px-2 py-1 text-xs',
            container: 'p-2'
        },
        md: {
            time: 'text-3xl',
            label: 'text-sm',
            button: 'px-3 py-2 text-sm',
            container: 'p-4'
        },
        lg: {
            time: 'text-5xl',
            label: 'text-base',
            button: 'px-4 py-3 text-base',
            container: 'p-6'
        }
    };

    const currentSize = sizeClasses[size] || sizeClasses.md;

    // ==================== COMPACT VARIANT ====================
    if (variant === 'compact') {
        return (
            <div className={`flex items-center gap-2 ${currentSize.container}`}>
                <div className={`font-mono font-bold text-gray-800 ${currentSize.time}`}>
                    {formattedTime.display}
                </div>
                {isRunning && (
                    <div className="flex gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] text-red-500 font-medium">RUNNING</span>
                    </div>
                )}
            </div>
        );
    }

    // ==================== STANDARD VARIANT ====================
    return (
        <div className={`bg-white border-2 border-gray-300 rounded-lg shadow-md ${currentSize.container}`}>
            {/* Status Indicator */}
            <div className="flex items-center justify-between mb-3">
                <h3 className={`font-bold text-gray-800 ${currentSize.label}`}>⏲️ Stopwatch</h3>
                {isRunning && (
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className={`font-medium text-green-600 ${currentSize.label}`}>Running</span>
                    </div>
                )}
            </div>


            {/* Time Breakdown */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-center">
                    <div className={`font-mono font-bold text-amber-700 ${currentSize.time}`}>
                        {formattedTime.hours}
                    </div>
                    <div className={`text-[10px] text-gray-600 uppercase mt-1 ${currentSize.label}`}>
                        Hours
                    </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center">
                    <div className={`font-mono font-bold text-purple-600 ${currentSize.time}`}>
                        {formattedTime.minutes}
                    </div>
                    <div className={`text-[10px] text-gray-600 uppercase mt-1 ${currentSize.label}`}>
                        Minutes
                    </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-center">
                    <div className={`font-mono font-bold text-amber-600 ${currentSize.time}`}>
                        {formattedTime.seconds}
                    </div>
                    <div className={`text-[10px] text-gray-600 uppercase mt-1 ${currentSize.label}`}>
                        Seconds
                    </div>
                </div>
            </div>

            {/* Set Time Form */}
            {showSetTime && !isRunning && (
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Set Time</h4>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Hours</label>
                            <input
                                type="number"
                                min="0"
                                max="99"
                                value={inputHours}
                                onChange={(e) => setInputHours(e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-center font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Minutes</label>
                            <input
                                type="number"
                                min="0"
                                max="59"
                                value={inputMinutes}
                                onChange={(e) => setInputMinutes(e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-center font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Seconds</label>
                            <input
                                type="number"
                                min="0"
                                max="59"
                                value={inputSeconds}
                                onChange={(e) => setInputSeconds(e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-center font-mono"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSetTimeClick}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2 py-1 rounded-lg text-sm transition-colors"
                        >
                            ✓ Set
                        </button>
                        <button
                            onClick={() => setShowSetTime(false)}
                            className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold px-2 py-1 rounded-lg text-sm transition-colors"
                        >
                            ✕ Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Control Buttons */}
            {showControls && (
                <div className="flex gap-2 flex-wrap">
                    {!isRunning ? (
                        <button
                            onClick={onStart}
                            className={`flex-1 min-w-[80px] bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors ${currentSize.button}`}
                        >
                            ▶️ Start
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={onPause}
                                className={`flex-1 min-w-[80px] bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg transition-colors ${currentSize.button}`}
                            >
                                ⏸️ Pause
                            </button>
                            <button
                                onClick={onResume}
                                className={`flex-1 min-w-[80px] bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors ${currentSize.button}`}
                            >
                                ▶️ Resume
                            </button>
                        </>
                    )}

                    <button
                        onClick={onReset}
                        className={`flex-1 min-w-[80px] bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors ${currentSize.button}`}
                    >
                        🔄 Reset
                    </button>

                    {!isRunning && (
                        <button
                            onClick={() => setShowSetTime(!showSetTime)}
                            className={`flex-1 min-w-[80px] ${showSetTime ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-500 hover:bg-indigo-600'} text-white font-semibold rounded-lg transition-colors ${currentSize.button}`}
                        >
                            ⏱️ {showSetTime ? 'Done' : 'Set Time'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default StopwatchDisplay;
