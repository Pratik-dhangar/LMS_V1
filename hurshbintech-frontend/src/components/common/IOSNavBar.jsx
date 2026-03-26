/**
 * IOSNavBar — Floating Back + Refresh strip for iOS Safari and PWA standalone mode.
 *
 * iOS Safari hides / collapses the browser address bar on scroll which leaves
 * users with no native way to refresh or navigate back during a session.
 * In PWA standalone mode (all platforms) there is no browser chrome at all.
 *
 * This component renders a fixed, translucent pill at the bottom-right of the
 * screen (above the iOS home indicator via safe-area-inset-bottom) that provides:
 *   ← Back    ↺ Refresh
 *
 * It is intentionally invisible on desktop Chrome/Firefox where the browser
 * already exposes refresh and back controls.
 */

import React, { useState, useEffect } from 'react';

/**
 * Detect whether the current environment needs a manual nav bar.
 * Returns true for:
 *  - Any PWA running in standalone / fullscreen display mode
 *  - iOS Safari (any mode, because the address bar collapses)
 */
function needsNavBar() {
    // PWA standalone / fullscreen (covers iOS Add-to-Home-Screen + Android PWA)
    const isPWA =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true;

    // iOS Safari — user agent check (excludes Chrome on iOS which reports CriOS)
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) && !/crios/.test(ua);

    return isPWA || isIOS;
}

const BTN = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.15s',
    flexShrink: 0,
};

export default function IOSNavBar({
    onBack,
    onRefresh,
    // Optional position override — 'bottom-right' (default) | 'bottom-left' | 'top-right' | 'top-left'
    position = 'bottom-right',
}) {
    const [visible, setVisible] = useState(false);
    const [pressed, setPressed] = useState(null); // 'back' | 'refresh' | null

    useEffect(() => {
        setVisible(needsNavBar());
    }, []);

    if (!visible) return null;

    const handleBack = () => {
        setPressed('back');
        setTimeout(() => setPressed(null), 300);
        if (onBack) {
            onBack();
        } else {
            window.history.back();
        }
    };

    const handleRefresh = () => {
        setPressed('refresh');
        setTimeout(() => setPressed(null), 300);
        if (onRefresh) {
            onRefresh();
        } else {
            window.location.reload();
        }
    };

    // Position styles
    const posMap = {
        'bottom-right': { bottom: 'calc(env(safe-area-inset-bottom, 12px) + 16px)', right: '16px' },
        'bottom-left':  { bottom: 'calc(env(safe-area-inset-bottom, 12px) + 16px)', left: '16px' },
        'top-right':    { top:    'calc(env(safe-area-inset-top, 12px) + 16px)',    right: '16px' },
        'top-left':     { top:    'calc(env(safe-area-inset-top, 12px) + 16px)',    left: '16px' },
    };

    const pillStyle = {
        position: 'fixed',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '4px 6px',
        background: 'rgba(20, 20, 20, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '28px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.12)',
        pointerEvents: 'auto',
        ...posMap[position] ?? posMap['bottom-right'],
    };

    return (
        <div style={pillStyle} aria-label="Session navigation controls">
            {/* Back */}
            <button
                style={{
                    ...BTN,
                    background: pressed === 'back' ? 'rgba(255,255,255,0.18)' : 'transparent',
                }}
                onPointerDown={() => setPressed('back')}
                onPointerUp={handleBack}
                onPointerLeave={() => setPressed(null)}
                title="Go back"
                aria-label="Go back"
            >
                ←
            </button>

            {/* Divider */}
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />

            {/* Refresh */}
            <button
                style={{
                    ...BTN,
                    background: pressed === 'refresh' ? 'rgba(255,255,255,0.18)' : 'transparent',
                    fontSize: '18px',
                }}
                onPointerDown={() => setPressed('refresh')}
                onPointerUp={handleRefresh}
                onPointerLeave={() => setPressed(null)}
                title="Refresh / Reconnect"
                aria-label="Refresh page"
            >
                ↺
            </button>
        </div>
    );
}
