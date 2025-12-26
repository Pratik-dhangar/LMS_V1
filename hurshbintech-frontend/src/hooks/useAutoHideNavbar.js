import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for auto-hiding navbar on mobile/tablet devices
 * Shows navbar for 5 seconds on load and when user touches/clicks
 */
const useAutoHideNavbar = () => {
    const [isNavbarHidden, setIsNavbarHidden] = useState(false);
    const hideTimeoutRef = useRef(null);
    const isDesktopRef = useRef(false);

    // Initialize navbar visibility on mount
    useEffect(() => {
        // Check if device is desktop
        const checkIsDesktop = () => {
            return window.innerWidth >= 1024;
        };

        isDesktopRef.current = checkIsDesktop();

        // Only hide on mobile/tablet
        if (!isDesktopRef.current) {
            // Show navbar for 5 seconds on initial load
            setIsNavbarHidden(false);
            scheduleNavbarHide();
        }

        // Handle window resize
        const handleResize = () => {
            const wasDesktop = isDesktopRef.current;
            isDesktopRef.current = checkIsDesktop();

            if (!isDesktopRef.current && wasDesktop) {
                // Switched from desktop to mobile
                setIsNavbarHidden(false);
                scheduleNavbarHide();
            } else if (isDesktopRef.current && !wasDesktop) {
                // Switched from mobile to desktop
                setIsNavbarHidden(false);
                clearTimeout(hideTimeoutRef.current);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Function to schedule navbar hide after 5 seconds
    const scheduleNavbarHide = () => {
        clearTimeout(hideTimeoutRef.current);
        setIsNavbarHidden(false);

        if (!isDesktopRef.current) {
            hideTimeoutRef.current = setTimeout(() => {
                setIsNavbarHidden(true);
            }, 5000);
        }
    };

    // Show navbar on user interaction
    const handleUserInteraction = () => {
        if (!isDesktopRef.current) {
            scheduleNavbarHide();
        }
    };

    // Add event listeners on mount
    useEffect(() => {
        if (isDesktopRef.current) return;

        window.addEventListener('touchstart', handleUserInteraction);
        window.addEventListener('click', handleUserInteraction);
        window.addEventListener('mousemove', handleUserInteraction);

        return () => {
            window.removeEventListener('touchstart', handleUserInteraction);
            window.removeEventListener('click', handleUserInteraction);
            window.removeEventListener('mousemove', handleUserInteraction);
        };
    }, []);

    return {
        isNavbarHidden,
        navbarClassName: isNavbarHidden ? 'navbar-hidden' : '',
        pageClassName: isNavbarHidden ? 'navbar-is-hidden' : 'navbar-is-visible'
    };
};

export default useAutoHideNavbar;
