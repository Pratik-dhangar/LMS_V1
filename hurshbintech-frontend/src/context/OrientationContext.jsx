import React, { createContext, useContext } from 'react';
import useOrientation from '../hooks/useOrientation';

/**
 * OrientationContext
 * Provides device orientation state to the entire application
 * 
 * Context provides:
 * - isPortrait: boolean - true if portrait orientation
 * - isLandscape: boolean - true if landscape orientation
 * - orientation: string - 'portrait' or 'landscape'
 * - width: number - window width
 * - height: number - window height
 */
const OrientationContext = createContext(null);

/**
 * OrientationProvider Component
 * 
 * Wraps the app to provide orientation detection context
 * Usage:
 * <OrientationProvider>
 *   <App />
 * </OrientationProvider>
 */
export const OrientationProvider = ({ children }) => {
    const orientationData = useOrientation();

    return (
        <OrientationContext.Provider value={orientationData}>
            {children}
        </OrientationContext.Provider>
    );
};

/**
 * useOrientationContext Hook
 * 
 * Access orientation context in any component
 * Returns: { isPortrait, isLandscape, orientation, width, height }
 * 
 * Usage:
 * const { isPortrait, isLandscape } = useOrientationContext();
 */
export const useOrientationContext = () => {
    const context = useContext(OrientationContext);
    if (!context) {
        throw new Error('useOrientationContext must be used within OrientationProvider');
    }
    return context;
};

export default OrientationContext;
