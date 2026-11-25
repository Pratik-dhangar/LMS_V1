import React, { useRef, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
    normalizePoint,
    denormalizePoint,
    normalizeStroke,
    denormalizeStroke,
    replayPaths,
    createNormalizedPath,
    addSegmentToPath
} from '../../utils/drawingSync';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const COLORS = ["#000000", "#e23b3b", "#2f6fdb", "#1fa463", "#ffffff", "#ffed4a"];

const LivePdfViewer = ({
    pdfId,
    pdfUrl,
    isTrainer,
    currentPage = 1,
    onPageChange,
    whiteboardService,
    initialAnnotations = {},
    toolAccess = { draw: false }
}) => {
    const containerRef = useRef(null);
    const pdfCanvasRef = useRef(null);
    const drawCanvasRef = useRef(null);

    const pdfDocRef = useRef(null);
    const renderTaskRef = useRef(null);

    const [numPages, setNumPages] = useState(0);
    const [localCurrentPage, setLocalCurrentPage] = useState(currentPage);
    const [pdfLoading, setPdfLoading] = useState(true);

    // Drawing state
    const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
    const [color, setColor] = useState(COLORS[0]);
    const [lineWidth, setLineWidth] = useState(3);

    // Keep track of annotations for this PDF. Keyed by page number.
    // Format: { [pageNumber]: [stroke1, stroke2, ...] }
    const [annotations, setAnnotations] = useState(initialAnnotations || {});

    // Sync initialAnnotations when it changes (e.g., from whiteboard_restore)
    useEffect(() => {
        if (initialAnnotations && Object.keys(initialAnnotations).length > 0) {
            setAnnotations(prev => {
                // Merge initial annotations with any local ones that might have been drawn
                return { ...initialAnnotations, ...prev };
            });
        }
    }, [initialAnnotations]);

    // Drawing interaction state
    const isDrawing = useRef(false);
    const currentPathRef = useRef(null);
    const lastPointRef = useRef(null);

    const canDraw = isTrainer || toolAccess.draw;

    // 1. Load the PDF document
    useEffect(() => {
        let isMounted = true;
        const loadPdf = async () => {
            if (!pdfUrl) return;
            try {
                setPdfLoading(true);
                const loadingTask = pdfjsLib.getDocument(pdfUrl);
                const pdf = await loadingTask.promise;
                if (isMounted) {
                    pdfDocRef.current = pdf;
                    setNumPages(pdf.numPages);
                    setPdfLoading(false);
                    renderPage(localCurrentPage, pdf);
                }
            } catch (error) {
                console.error('[LivePdfViewer] Error loading PDF:', error);
                if (isMounted) setPdfLoading(false);
            }
        };

        loadPdf();

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfUrl]);

    // 2. Sync page from props (for learners when trainer changes page)
    useEffect(() => {
        if (currentPage && currentPage !== localCurrentPage && pdfDocRef.current) {
            setLocalCurrentPage(currentPage);
            renderPage(currentPage, pdfDocRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage]);

    // 3. Render a specific PDF page
    const renderPage = async (pageNum, pdfDoc = pdfDocRef.current) => {
        if (!pdfDoc || !pdfCanvasRef.current || !drawCanvasRef.current || !containerRef.current) return;

        try {
            // Cancel any ongoing render task
            if (renderTaskRef.current) {
                await renderTaskRef.current.cancel();
            }

            const page = await pdfDoc.getPage(pageNum);
            const containerWidth = containerRef.current.clientWidth || 800;
            
            // Calculate scale to fit width (with some padding)
            const padding = 40;
            const unscaledViewport = page.getViewport({ scale: 1 });
            const scale = (containerWidth - padding) / unscaledViewport.width;
            
            const viewport = page.getViewport({ scale });
            const dpr = window.devicePixelRatio || 1;

            const pdfCanvas = pdfCanvasRef.current;
            const drawCanvas = drawCanvasRef.current;

            // Set canvas dimensions
            const cssW = Math.floor(viewport.width);
            const cssH = Math.floor(viewport.height);

            [pdfCanvas, drawCanvas].forEach(c => {
                c.width = cssW * dpr;
                c.height = cssH * dpr;
                c.style.width = `${cssW}px`;
                c.style.height = `${cssH}px`;
            });

            // Render PDF
            const ctx = pdfCanvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            renderTaskRef.current = page.render(renderContext);
            await renderTaskRef.current.promise;
            renderTaskRef.current = null;

            // Render annotations for this page
            redrawAnnotations(pageNum, drawCanvas);

        } catch (error) {
            if (error.name !== 'RenderingCancelledException') {
                console.error('[LivePdfViewer] Error rendering page:', error);
            }
        }
    };

    // Handle Resize
    useEffect(() => {
        let resizeTimer;
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (pdfDocRef.current) {
                    renderPage(localCurrentPage, pdfDocRef.current);
                }
            }, 200);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localCurrentPage]);

    // Redraw annotations on the canvas
    const redrawAnnotations = (pageNum, canvas = drawCanvasRef.current) => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform for drawing layer
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const pageAnnotations = annotations[pageNum] || [];
        if (pageAnnotations.length > 0) {
            replayPaths(pageAnnotations, ctx, canvas);
        }
    };

    // 4. Handle drawing
    const getPoint = (e) => {
        const canvas = drawCanvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const handlePointerDown = (e) => {
        if (!canDraw) return;
        
        isDrawing.current = true;
        const point = getPoint(e);
        const normPoint = normalizePoint(point, drawCanvasRef.current);
        const normStroke = normalizeStroke(lineWidth * (window.devicePixelRatio || 1), drawCanvasRef.current);
        
        lastPointRef.current = normPoint;
        currentPathRef.current = createNormalizedPath(normPoint, normPoint, normStroke, color, tool);

        // Draw dot immediately
        const ctx = drawCanvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth * (window.devicePixelRatio || 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        
        const denormPoint = denormalizePoint(normPoint, drawCanvasRef.current);
        ctx.moveTo(denormPoint.x, denormPoint.y);
        ctx.lineTo(denormPoint.x, denormPoint.y);
        ctx.stroke();
    };

    const handlePointerMove = (e) => {
        if (!isDrawing.current || !canDraw) return;
        
        const point = getPoint(e);
        const normPoint = normalizePoint(point, drawCanvasRef.current);
        
        // Update current path
        currentPathRef.current = addSegmentToPath(currentPathRef.current, lastPointRef.current, normPoint);
        
        // Draw line
        const ctx = drawCanvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth * (window.devicePixelRatio || 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        
        const prevPt = denormalizePoint(lastPointRef.current, drawCanvasRef.current);
        const currPt = denormalizePoint(normPoint, drawCanvasRef.current);
        
        ctx.moveTo(prevPt.x, prevPt.y);
        ctx.lineTo(currPt.x, currPt.y);
        ctx.stroke();

        // Send to network
        if (whiteboardService) {
            const drawData = {
                pdfId,
                pageNumber: localCurrentPage,
                prevX: lastPointRef.current.x,
                prevY: lastPointRef.current.y,
                currX: normPoint.x,
                currY: normPoint.y,
                color,
                strokeNorm: currentPathRef.current.strokeNorm,
                tool
            };
            console.log('[LivePdfViewer] 📤 Sending pdf_draw:', drawData);
            whiteboardService.sendPdfDraw(drawData);
        }

        lastPointRef.current = normPoint;
    };

    const handlePointerUp = () => {
        if (!isDrawing.current || !canDraw) return;
        isDrawing.current = false;
        
        if (drawCanvasRef.current) {
            drawCanvasRef.current.getContext('2d').globalCompositeOperation = 'source-over';
        }

        // Save path to local state
        if (currentPathRef.current) {
            setAnnotations(prev => {
                const pageStrokes = prev[localCurrentPage] || [];
                return {
                    ...prev,
                    [localCurrentPage]: [...pageStrokes, currentPathRef.current]
                };
            });
        }
    };

    // 5. Handle WebSocket events for drawing
    useEffect(() => {
        if (!whiteboardService) return;

        const handleRemoteDraw = (data) => {
            console.log(`[LivePdfViewer] 📥 Received pdf_draw:`, data, `Current pdfId:`, pdfId, `Current page:`, localCurrentPage);
            
            const isMatch = String(data.pdfId) === String(pdfId) && Number(data.pageNumber) === Number(localCurrentPage);
            console.log(`[LivePdfViewer] 🔍 Match result:`, isMatch);

            if (isMatch) {
                // If the stroke is for the currently viewed page, draw it live
                const canvas = drawCanvasRef.current;
                if (!canvas) {
                    console.warn(`[LivePdfViewer] ⚠️ Canvas not ready!`);
                    return;
                }

                const ctx = canvas.getContext('2d');
                ctx.beginPath();
                ctx.strokeStyle = data.color;
                ctx.lineWidth = denormalizeStroke(data.strokeNorm, canvas);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalCompositeOperation = data.tool === 'eraser' ? 'destination-out' : 'source-over';

                const prevPt = denormalizePoint({ x: data.prevX, y: data.prevY }, canvas);
                const currPt = denormalizePoint({ x: data.currX, y: data.currY }, canvas);

                ctx.moveTo(prevPt.x, prevPt.y);
                ctx.lineTo(currPt.x, currPt.y);
                ctx.stroke();
                ctx.globalCompositeOperation = 'source-over';
            }

            // Save to state regardless of current page
            setAnnotations(prev => {
                const pageNum = data.pageNumber;
                const pageStrokes = prev[pageNum] || [];
                
                // Formulate the path segment format
                const newStroke = {
                    segments: [{
                        prev: { x: data.prevX, y: data.prevY },
                        curr: { x: data.currX, y: data.currY }
                    }],
                    strokeNorm: data.strokeNorm,
                    color: data.color,
                    tool: data.tool,
                    timestamp: data.timestamp || Date.now()
                };

                return {
                    ...prev,
                    [pageNum]: [...pageStrokes, newStroke]
                };
            });
        };

        const handleRemoteClear = (data) => {
            if (String(data.pdfId) === String(pdfId)) {
                setAnnotations(prev => {
                    const next = { ...prev };
                    if (data.pageNumber) {
                        next[data.pageNumber] = [];
                        if (Number(localCurrentPage) === Number(data.pageNumber)) redrawAnnotations(localCurrentPage);
                    } else {
                        return {};
                    }
                    return next;
                });
                
                if (!data.pageNumber) {
                    redrawAnnotations(localCurrentPage);
                }
            }
        };

        whiteboardService.onPdfDraw = handleRemoteDraw;
        whiteboardService.onPdfClearAnnotations = handleRemoteClear;

        return () => {
            whiteboardService.onPdfDraw = null;
            whiteboardService.onPdfClearAnnotations = null;
        };
    }, [whiteboardService, pdfId, localCurrentPage]);


    // 6. Navigation and Toolbar actions
    const changePage = (delta) => {
        const targetPage = localCurrentPage + delta;
        if (targetPage >= 1 && targetPage <= numPages) {
            setLocalCurrentPage(targetPage);
            renderPage(targetPage, pdfDocRef.current);
            if (onPageChange) {
                onPageChange(targetPage);
            }
        }
    };

    const clearCurrentPage = () => {
        setAnnotations(prev => ({
            ...prev,
            [localCurrentPage]: []
        }));
        redrawAnnotations(localCurrentPage);
        
        if (whiteboardService) {
            whiteboardService.sendPdfClearAnnotations({
                pdfId,
                pageNumber: localCurrentPage
            });
        }
    };

    return (
        <div className="live-pdf-viewer" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f0f0' }}>
            {/* Toolbar - Only visible if user can draw or is trainer */}
            {(canDraw || isTrainer) && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 16px',
                    backgroundColor: '#ffffff',
                    borderBottom: '1px solid #e0e0e0',
                    zIndex: 10
                }}>
                    {isTrainer && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button 
                                onClick={() => changePage(-1)} 
                                disabled={localCurrentPage <= 1}
                                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}
                            >
                                ◀
                            </button>
                            <span style={{ fontSize: '14px', minWidth: '60px', textAlign: 'center' }}>
                                {localCurrentPage} / {numPages || '-'}
                            </span>
                            <button 
                                onClick={() => changePage(1)} 
                                disabled={localCurrentPage >= numPages}
                                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}
                            >
                                ▶
                            </button>
                            <div style={{ width: '1px', height: '24px', backgroundColor: '#ccc', margin: '0 8px' }}></div>
                        </div>
                    )}

                    {canDraw && (
                        <>
                            <button
                                onClick={() => setTool('pen')}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    backgroundColor: tool === 'pen' ? '#e6f1fb' : 'transparent',
                                    border: tool === 'pen' ? '1px solid #378add' : '1px solid #ccc',
                                    cursor: 'pointer'
                                }}
                            >
                                Pen
                            </button>
                            <button
                                onClick={() => setTool('eraser')}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    backgroundColor: tool === 'eraser' ? '#e6f1fb' : 'transparent',
                                    border: tool === 'eraser' ? '1px solid #378add' : '1px solid #ccc',
                                    cursor: 'pointer'
                                }}
                            >
                                Eraser
                            </button>

                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginLeft: '8px' }}>
                                {COLORS.map((c) => (
                                    <div
                                        key={c}
                                        onClick={() => { setColor(c); setTool('pen'); }}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            backgroundColor: c,
                                            cursor: 'pointer',
                                            border: color === c && tool === 'pen' ? '3px solid #378add' : '1px solid #ccc'
                                        }}
                                    />
                                ))}
                            </div>

                            <input 
                                type="range" 
                                min="1" max="15" 
                                value={lineWidth} 
                                onChange={(e) => setLineWidth(parseInt(e.target.value))}
                                style={{ marginLeft: '12px', width: '80px' }}
                            />

                            <button
                                onClick={clearCurrentPage}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc',
                                    cursor: 'pointer',
                                    marginLeft: 'auto'
                                }}
                            >
                                Clear Page
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Canvas Container */}
            <div 
                ref={containerRef}
                style={{ 
                    flex: 1, 
                    position: 'relative', 
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '20px'
                }}
            >
                {pdfLoading && <div style={{ marginTop: '50px' }}>Loading PDF...</div>}
                
                <div style={{ position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {/* PDF Rendering Layer */}
                    <canvas 
                        ref={pdfCanvasRef} 
                        style={{ display: 'block', backgroundColor: '#fff' }} 
                    />
                    
                    {/* Drawing Layer */}
                    <canvas 
                        ref={drawCanvasRef}
                        style={{ 
                            position: 'absolute', 
                            top: 0, 
                            left: 0, 
                            touchAction: 'none',
                            cursor: canDraw ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default',
                            pointerEvents: canDraw ? 'auto' : 'none'
                        }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    />
                </div>
            </div>
        </div>
    );
};

LivePdfViewer.propTypes = {
    pdfId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    pdfUrl: PropTypes.string.isRequired,
    isTrainer: PropTypes.bool.isRequired,
    currentPage: PropTypes.number,
    onPageChange: PropTypes.func,
    whiteboardService: PropTypes.object,
    initialAnnotations: PropTypes.object,
    toolAccess: PropTypes.object
};

export default LivePdfViewer;
