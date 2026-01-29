import { useState, useEffect } from 'react';

/**
 * Custom Hook: useOrientation
 * 
 * Detects and tracks device orientation changes (portrait/landscape)
 * Provides orientation state and screen dimensions
 * 
 * Usage:
 * const { isPortrait, isLandscape, orientation, width, height } = useOrientation();
 * 
 * Returns:
 * - isPortrait: boolean - true if device is in portrait orientation
 * - isLandscape: boolean - true if device is in landscape orientation
 * - orientation: string - 'portrait' or 'landscape'
 * - width: number - window inner width
 * - height: number - window inner height
 */
const useOrientation = () => {
    const [orientation, setOrientation] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        }
        return 'portrait';
    });

    const [dimensions, setDimensions] = useState(() => {
        if (typeof window !== 'undefined') {
            return {
                width: window.innerWidth,
                height: window.innerHeight,
            };
        }
        return { width: 0, height: 0 };
    });

    useEffect(() => {
        const handleOrientationChange = () => {
            const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
            setOrientation(newOrientation);
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });

            // Trigger custom event for other listeners
            window.dispatchEvent(
                new CustomEvent('orientationchange-custom', {
                    detail: {
                        orientation: newOrientation,
                        width: window.innerWidth,
                        height: window.innerHeight,
                    },
                })
            );
        };

        const handleResize = () => {
            const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

            if (newOrientation !== orientation) {
                setOrientation(newOrientation);
            }

            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        // Listen to both orientationchange and resize events
        window.addEventListener('orientationchange', handleOrientationChange);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('orientationchange', handleOrientationChange);
            window.removeEventListener('resize', handleResize);
        };
    }, [orientation]);

    return {
        isPortrait: orientation === 'portrait',
        isLandscape: orientation === 'landscape',
        orientation,
        width: dimensions.width,
        height: dimensions.height,
    };
};

export default useOrientation;
