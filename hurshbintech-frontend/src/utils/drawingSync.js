/**
 * Drawing Sync Utility - Coordinate Normalization for Multi-Device Whiteboard
 * 
 * Enables synchronized drawing across devices with different screen sizes by:
 * 1. Normalizing coordinates to 0..1 range before sending over network
 * 2. Denormalizing to local canvas dimensions on receive
 * 3. Scaling stroke width proportionally for consistent visual appearance
 * 4. Storing normalized paths for replay on resize
 */

/**
 * Normalize a point from canvas pixels to 0..1 range
 * @param {Object} point - {x, y} in canvas pixel coordinates
 * @param {Object} canvas - HTML5 Canvas element
 * @returns {Object} Normalized point {x: 0..1, y: 0..1}
 */
export const normalizePoint = (point, canvas) => {
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
        return { x: 0, y: 0 };
    }
    return {
        x: Math.max(0, Math.min(1, point.x / (canvas.width / (window.devicePixelRatio || 1)))),
        y: Math.max(0, Math.min(1, point.y / (canvas.height / (window.devicePixelRatio || 1))))
    };
};

/**
 * Denormalize a point from 0..1 range to canvas pixels
 * @param {Object} normPoint - {x: 0..1, y: 0..1}
 * @param {Object} canvas - HTML5 Canvas element
 * @returns {Object} Point in canvas pixel coordinates {x, y}
 */
export const denormalizePoint = (normPoint, canvas) => {
    if (!canvas) {
        return { x: 0, y: 0 };
    }
    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;

    return {
        x: Math.round(normPoint.x * canvasWidth),
        y: Math.round(normPoint.y * canvasHeight)
    };
};

/**
 * Normalize stroke width to 0..1 range relative to canvas diagonal
 * This ensures a stroke looks proportionally similar across devices
 * @param {number} strokePx - Stroke width in pixels
 * @param {Object} canvas - HTML5 Canvas element
 * @returns {number} Normalized stroke width (0..1)
 */
export const normalizeStroke = (strokePx, canvas) => {
    if (!canvas || strokePx <= 0) return 0;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;

    // Use the smaller dimension to normalize (so stroke scale is consistent on all orientations)
    const referenceLength = Math.min(canvasWidth, canvasHeight);

    if (referenceLength === 0) return 0;

    // Normalize: divide stroke by reference, clamp to 0..1
    // For typical 2-20px strokes on 500-2000px canvas, this yields 0.001..0.04
    return Math.max(0, Math.min(1, strokePx / referenceLength));
};

/**
 * Denormalize stroke width from 0..1 back to pixels
 * @param {number} normStroke - Normalized stroke width (0..1)
 * @param {Object} canvas - HTML5 Canvas element
 * @returns {number} Stroke width in pixels
 */
export const denormalizeStroke = (normStroke, canvas) => {
    if (!canvas || normStroke <= 0) return 1;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;

    const referenceLength = Math.min(canvasWidth, canvasHeight);
    const strokePx = normStroke * referenceLength;

    // Clamp to reasonable pixel range (1-100px)
    return Math.max(1, Math.min(100, Math.round(strokePx)));
};

/**
 * Replay all stored normalized paths on the canvas
 * Used to redraw the canvas after resize without losing drawing data
 * @param {Array} paths - Array of normalized path segments
 * @param {Object} ctx - Canvas 2D context
 * @param {Object} canvas - HTML5 Canvas element
 */
export const replayPaths = (paths, ctx, canvas) => {
    if (!paths || !ctx || !canvas) return;

    paths.forEach(path => {
        if (!path.segments || path.segments.length === 0) return;

        // Get denormalized stroke width for this path
        const strokePx = denormalizeStroke(path.strokeNorm, canvas);

        // Setup canvas drawing context
        ctx.beginPath();
        ctx.strokeStyle = path.color || '#000000';
        ctx.lineWidth = strokePx;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Handle eraser vs regular pen
        if (path.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }

        // Draw each segment in the path
        path.segments.forEach((segment, idx) => {
            const prevPt = denormalizePoint(segment.prev, canvas);
            const currPt = denormalizePoint(segment.curr, canvas);

            if (idx === 0) {
                ctx.moveTo(prevPt.x, prevPt.y);
            }
            ctx.lineTo(currPt.x, currPt.y);
        });

        ctx.stroke();
        ctx.closePath();
    });

    // Reset to default composite operation
    ctx.globalCompositeOperation = 'source-over';
};

/**
 * Path structure for storing normalized drawing data
 * @typedef {Object} NormalizedPath
 * @property {Array<{prev, curr}>} segments - Array of normalized line segments
 * @property {number} strokeNorm - Normalized stroke width (0..1)
 * @property {string} color - Line color
 * @property {string} tool - 'pen' or 'eraser'
 * @property {number} timestamp - When path was created
 */

/**
 * Create a new path from a draw event
 * @param {Object} prev - Normalized previous point
 * @param {Object} curr - Normalized current point
 * @param {number} strokeNorm - Normalized stroke width
 * @param {string} color - Line color
 * @param {string} tool - 'pen' or 'eraser'
 * @returns {NormalizedPath}
 */
export const createNormalizedPath = (prev, curr, strokeNorm, color, tool = 'pen') => {
    return {
        segments: [{ prev, curr }],
        strokeNorm,
        color,
        tool,
        timestamp: Date.now()
    };
};

/**
 * Add a segment to an existing path
 * @param {NormalizedPath} path - Path to extend
 * @param {Object} prev - Normalized previous point
 * @param {Object} curr - Normalized current point
 * @returns {NormalizedPath} Updated path
 */
export const addSegmentToPath = (path, prev, curr) => {
    return {
        ...path,
        segments: [...path.segments, { prev, curr }]
    };
};

/**
 * Combine consecutive paths from the same tool/color into batches for efficiency
 * @param {Array} paths - Array of normalized paths
 * @returns {Array} Optimized paths
 */
export const optimizePaths = (paths) => {
    if (!paths || paths.length === 0) return [];

    const optimized = [];
    let currentBatch = null;

    paths.forEach(path => {
        // Start new batch if tool, color, or stroke changed
        if (!currentBatch ||
            currentBatch.tool !== path.tool ||
            currentBatch.color !== path.color ||
            currentBatch.strokeNorm !== path.strokeNorm) {

            if (currentBatch) {
                optimized.push(currentBatch);
            }
            currentBatch = { ...path, segments: [...path.segments] };
        } else {
            // Combine segments into current batch
            currentBatch.segments = [...currentBatch.segments, ...path.segments];
        }
    });

    if (currentBatch) {
        optimized.push(currentBatch);
    }

    return optimized;
};

/**
 * Calculate device screen aspect ratio
 * @returns {number} width / height ratio
 */
export const getDeviceAspectRatio = () => {
    return window.innerWidth / window.innerHeight;
};

/**
 * Calculate canvas size to match device screen aspect ratio
 * @param {number} maxWidth - Maximum allowed canvas width
 * @param {number} maxHeight - Maximum allowed canvas height
 * @returns {Object} {width, height} in pixels
 */
export const calculateCanvasSizeForDeviceRatio = (maxWidth, maxHeight) => {
    const aspectRatio = getDeviceAspectRatio();

    let width, height;

    // Try to use full width first
    width = maxWidth;
    height = width / aspectRatio;

    // If height exceeds max, use full height instead
    if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
    }

    return {
        width: Math.round(width),
        height: Math.round(height)
    };
};

export default {
    normalizePoint,
    denormalizePoint,
    normalizeStroke,
    denormalizeStroke,
    replayPaths,
    createNormalizedPath,
    addSegmentToPath,
    optimizePaths,
    getDeviceAspectRatio,
    calculateCanvasSizeForDeviceRatio
};
