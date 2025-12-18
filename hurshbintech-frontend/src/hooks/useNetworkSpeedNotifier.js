import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'

const SLOW_TOAST_ID = 'slow-network-toast'
const EFFECTIVE_TYPE_SLOW = new Set(['slow-2g', '2g', '3g'])
const SLOW_DOWNLINK_THRESHOLD_MBPS = 1.5
const SLOW_RTT_THRESHOLD_MS = 350
const MANUAL_TEST_INTERVAL_MS = 45_000
const MANUAL_TEST_THRESHOLD_MBPS = 1.0
const MANUAL_TEST_URL = '/speedtest.bin'

const makeSlowMessage = (reason) =>
    `Your network quality is slow${reason ? ` (${reason})` : ''}. Some features may take longer.`

const showSlowToast = (reason) => {
    if (toast.isActive(SLOW_TOAST_ID)) return
    toast.warn(makeSlowMessage(reason), {
        toastId: SLOW_TOAST_ID,
        autoClose: 8_000,
        closeOnClick: true,
        pauseOnFocusLoss: true,
        pauseOnHover: true
    })
}

const clearSlowToast = () => {
    if (toast.isActive(SLOW_TOAST_ID)) {
        toast.dismiss(SLOW_TOAST_ID)
    }
}

const useNetworkSpeedNotifier = () => {
    const lastStateRef = useRef('normal')
    const manualController = useRef(null)
    const intervalRef = useRef(null)

    const markSlow = (reason) => {
        if (lastStateRef.current === 'slow') return
        console.debug('[net-test] marking SLOW, reason:', reason)
        lastStateRef.current = 'slow'
        showSlowToast(reason)
    }

    const markGood = () => {
        if (lastStateRef.current !== 'slow') return
        console.debug('[net-test] marking GOOD')
        lastStateRef.current = 'normal'
        clearSlowToast()
    }

    const evaluateConnectionHints = (connection) => {
        if (!connection) {
            return false
        }

        const reasons = []
        const { effectiveType, downlink, rtt } = connection

        console.debug('[net-test] connection hints', { effectiveType, downlink, rtt })

        if (effectiveType && EFFECTIVE_TYPE_SLOW.has(effectiveType)) {
            reasons.push(`effective type ${effectiveType}`)
        }

        if (typeof downlink === 'number' && downlink < SLOW_DOWNLINK_THRESHOLD_MBPS) {
            reasons.push(`${downlink.toFixed(1)} Mbps downlink`)
        }

        if (typeof rtt === 'number' && rtt > SLOW_RTT_THRESHOLD_MS) {
            reasons.push(`${Math.round(rtt)} ms RTT`)
        }

        if (reasons.length) {
            markSlow(reasons[0])
            return true
        }

        markGood()
        return false
    }

    // Fallback speed test for browsers that lack reliable connection hints.
    const runManualSpeedTest = async () => {
        if (typeof navigator === 'undefined') return
        manualController.current?.abort()
        const controller = new AbortController()
        manualController.current = controller

        const start = performance.now()

        try {
            console.debug('[net-test] starting manual speed test')
            const response = await fetch(`${MANUAL_TEST_URL}?t=${Date.now()}`, {
                cache: 'no-store',
                signal: controller.signal
            })
            if (!response.ok) {
                console.debug('[net-test] fetch not ok', response.status)
                markGood()
                return
            }
            const blob = await response.blob()
            const durationSeconds = (performance.now() - start) / 1000
            console.debug('[net-test] downloaded', blob.size, 'bytes in', durationSeconds, 's')
            if (durationSeconds <= 0) {
                markGood()
                return
            }

            const mbps = (blob.size * 8) / (durationSeconds * 1_000_000)
            console.debug('[net-test] measured Mbps', mbps)
            if (Number.isFinite(mbps) && mbps < MANUAL_TEST_THRESHOLD_MBPS) {
                markSlow(`${mbps.toFixed(1)} Mbps measured`)
            } else {
                markGood()
            }
        } catch (error) {
            if (error.name === 'AbortError') return
            console.debug('Network speed test failed', error)
        }
    }

    useEffect(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return

        const connection = navigator.connection
        const handleConnectionChange = () => evaluateConnectionHints(connection)

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handleConnectionChange()
                runManualSpeedTest()
            }
        }

        const handleOnline = () => {
            handleConnectionChange()
            runManualSpeedTest()
        }

        connection?.addEventListener?.('change', handleConnectionChange)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('online', handleOnline)

        handleConnectionChange()
        runManualSpeedTest()
        // Expose a dev-only helper to trigger the manual speed test from the Console
        try {
            if (typeof window !== 'undefined' && (import.meta && import.meta.env && import.meta.env.DEV)) {
                // attach as non-enumerable to avoid accidental overwrites
                Object.defineProperty(window, 'runNetworkSpeedCheck', {
                    value: runManualSpeedTest,
                    writable: false,
                    configurable: true
                })
            }
        } catch (e) {
            // ignore if environment info not available
        }
        intervalRef.current = window.setInterval(runManualSpeedTest, MANUAL_TEST_INTERVAL_MS)

        return () => {
            connection?.removeEventListener?.('change', handleConnectionChange)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('online', handleOnline)
            if (intervalRef.current) {
                window.clearInterval(intervalRef.current)
            }
            manualController.current?.abort()
            try {
                if (typeof window !== 'undefined' && window.runNetworkSpeedCheck) {
                    try { delete window.runNetworkSpeedCheck } catch (_) { window.runNetworkSpeedCheck = undefined }
                }
            } catch (_) { }
            markGood()
        }
    }, [])
}

export default useNetworkSpeedNotifier
