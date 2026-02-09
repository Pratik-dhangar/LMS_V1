import React, { useState } from 'react';
import { Download, Check } from 'lucide-react';
import usePWAInstall from '../../hooks/usePWAInstall.js';
import './PWAInstallButton.css';

const PWAInstallButton = () => {
    const { canInstall, installApp } = usePWAInstall();
    const [isInstalling, setIsInstalling] = useState(false);
    const [installSuccess, setInstallSuccess] = useState(false);
    const [showMessage, setShowMessage] = useState(false);

    const handleInstall = async () => {
        setIsInstalling(true);
        try {
            await installApp();
            setInstallSuccess(true);
            setShowMessage(true);
            setTimeout(() => {
                setShowMessage(false);
            }, 3000);
        } catch (error) {
            // Silent error handling
        } finally {
            setIsInstalling(false);
        }
    };

    // Don't render if app is already installed or can't be installed
    if (!canInstall || installSuccess) {
        return null;
    }

    return (
        <div className="pwa-install-wrapper">
            <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="pwa-install-button"
                title="Install HurshBintech App"
            >
                {isInstalling ? (
                    <>
                        <div className="pwa-spinner"></div>
                        <span>Installing...</span>
                    </>
                ) : (
                    <>
                        <Download size={20} />
                        <span>Install App</span>
                    </>
                )}
            </button>

            {showMessage && (
                <div className="pwa-install-message">
                    <Check size={16} />
                    <span>App installed successfully!</span>
                </div>
            )}
        </div>
    );
};

export default PWAInstallButton;
