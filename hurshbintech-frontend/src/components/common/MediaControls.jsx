import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const MediaControls = ({ stream, micEnabled, onToggleMic }) => {
    const [cameraOn, setCameraOn] = useState(true);

    useEffect(() => {
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) setCameraOn(videoTrack.enabled);
        }
    }, [stream]);

    const toggleMic = () => {
        onToggleMic();
    };

    const toggleCamera = () => {
        if (!stream) return;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setCameraOn(videoTrack.enabled);
        }
    };

    return (
        <div className="flex space-x-2">
            <button
                onClick={toggleMic}
                className={`p-2 rounded-full ${micEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white`}
                title={micEnabled ? 'Turn Mic Off' : 'Turn Mic On'}
            >
                {micEnabled ? (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        />
                    </svg>
                ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5.586 5.586a2 2 0 012.828 0L12 10.586l3.586-3.586a2 2 0 112.828 2.828L14.828 13.414l3.586 3.586a2 2 0 01-2.828 2.828L12 16.828l-3.586 3.586a2 2 0 01-2.828-2.828L9.172 13.414 5.586 10.828a2 2 0 010-2.828z"
                        />
                    </svg>
                )}
            </button>
            <button
                onClick={toggleCamera}
                className={`p-2 rounded-full ${cameraOn ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white`}
                title={cameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
            >
                {cameraOn ? (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                    </svg>
                ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5.586 5.586a2 2 0 012.828 0L12 10.586l3.586-3.586a2 2 0 112.828 2.828L14.828 13.414l3.586 3.586a2 2 0 01-2.828 2.828L12 16.828l-3.586 3.586a2 2 0 01-2.828-2.828L9.172 13.414 5.586 10.828a2 2 0 010-2.828z"
                        />
                    </svg>
                )}
            </button>
        </div>
    );
};

MediaControls.propTypes = {
    stream: PropTypes.object,
    micEnabled: PropTypes.bool.isRequired,
    onToggleMic: PropTypes.func.isRequired,
};

export default MediaControls;
