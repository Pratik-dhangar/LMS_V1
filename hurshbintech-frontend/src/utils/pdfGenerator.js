import { jsPDF } from 'jspdf';

/**
 * Loads /Header.jpeg via the browser, draws it onto a canvas, and returns
 * { dataURL (PNG), naturalWidth, naturalHeight }.
 * Using canvas→PNG avoids jsPDF JPEG rendering issues (CMYK, certain encodings).
 * Returns null if the image cannot be loaded.
 */
const loadHeaderDataURL = () =>
    new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve({
                    dataURL: canvas.toDataURL('image/png'),
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                });
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        // Cache-bust to ensure the browser fetches the file fresh each time
        img.src = '/Header.jpeg?' + Date.now();
    });

/**
 * Draws the branded company header onto the doc starting at y=0.
 * - Header.jpeg placed full page width (aspect-ratio preserved)
 * - Thin gold divider line
 * - Report title / subtitle / date in dark text below
 * Returns the y-position right after the header block.
 */
const drawBrandedHeader = (doc, { headerDataURL, reportTitle, subtitle, generatedDate }) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    /* ── HEADER IMAGE ───────────────────────────────────────────── */
    let imgH = 0;
    if (headerDataURL && headerDataURL.dataURL) {
        const { dataURL, naturalWidth, naturalHeight } = headerDataURL;
        // Derive height from real pixel dimensions with max cap to save space
        imgH = (naturalWidth > 0 && naturalHeight > 0)
            ? Math.min(pageWidth * (naturalHeight / naturalWidth), 28)
            : 28;
        doc.addImage(dataURL, 'PNG', 0, 0, pageWidth, imgH, '', 'FAST');
    }

    /* ── GOLD DIVIDER LINE ──────────────────────────────────────── */
    doc.setDrawColor(219, 157, 50);
    doc.setLineWidth(0.8);
    doc.line(0, imgH, pageWidth, imgH);

    /* ── REPORT TITLE BLOCK ─────────────────────────────────────── */
    let y = imgH + 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(52, 73, 94);
    doc.text(reportTitle, pageWidth / 2, y, { align: 'center' });
    y += 7;

    if (subtitle) {
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
        y += 6;
    }

    if (generatedDate) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 130, 130);
        doc.text(generatedDate, pageWidth / 2, y, { align: 'center' });
        y += 5;
    }

    // Thin separator below title block
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);

    return y + 6; // y after full header
};

/**
 * Generate a progress report card PDF for a learner
 * Can generate for a specific program or all programs
 */
export const generateProgressReportPDF = (data, options = {}) => {
    const {
        learnerName,
        programName = null,
        programs = [],
    } = data;

    const {
        orientation = 'portrait',
        format = 'a4',
    } = options;

    // Create new PDF document
    const doc = new jsPDF({
        orientation,
        unit: 'mm',
        format,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let currentY = margin;

    // Helper function to add a new page if needed
    const checkPageBreak = (requiredSpace = 20) => {
        if (currentY + requiredSpace > pageHeight - margin) {
            doc.addPage();
            currentY = margin;
            return true;
        }
        return false;
    };

    // Helper function to draw a simple table manually
    const drawTable = (columns, rows, startY, columnWidths = null) => {
        const cellHeight = 7;
        const cellPadding = 2;

        // Calculate column widths if not provided
        if (!columnWidths) {
            const availableWidth = pageWidth - 2 * margin;
            const colWidth = availableWidth / columns.length;
            columnWidths = Array(columns.length).fill(colWidth);
        }

        let y = startY;

        // Draw header
        doc.setFillColor(52, 73, 94);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);

        let x = margin;
        columns.forEach((col, idx) => {
            doc.rect(x, y, columnWidths[idx], cellHeight, 'F');
            doc.text(col, x + cellPadding, y + cellHeight - cellPadding, { maxWidth: columnWidths[idx] - 2 * cellPadding });
            x += columnWidths[idx];
        });

        y += cellHeight;

        // Draw rows
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        rows.forEach((row, rowIdx) => {
            checkPageBreak(cellHeight + 2);

            const bgColor = rowIdx % 2 === 0 ? 245 : 255;

            x = margin;
            row.forEach((cell, colIdx) => {
                doc.setFillColor(bgColor, bgColor, bgColor);
                doc.rect(x, y, columnWidths[colIdx], cellHeight, 'FD');
                doc.text(String(cell || 'N/A'), x + cellPadding, y + cellHeight - cellPadding, {
                    maxWidth: columnWidths[colIdx] - 2 * cellPadding
                });
                x += columnWidths[colIdx];
            });

            y += cellHeight;
            currentY = y + 2;
        });

        currentY = y + 4;
        return y + 4;
    };

    // Helper function to add header
    const addHeader = () => {
        doc.setFontSize(22);
        doc.setTextColor(52, 73, 94);
        doc.setFont('helvetica', 'bold');
        const title = programName ? 'Progress Graph' : 'Overall Progress Report';
        doc.text(title, pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;

        doc.setFontSize(16);
        doc.setTextColor(41, 128, 185);
        doc.text(learnerName, pageWidth / 2, currentY, { align: 'center' });
        currentY += 8;

        if (programName) {
            doc.setFontSize(14);
            doc.setTextColor(52, 152, 219);
            doc.text(programName, pageWidth / 2, currentY, { align: 'center' });
            currentY += 8;
        }

        doc.setFontSize(10);
        doc.setTextColor(127, 140, 141);
        const dateStr = `Generated on: ${new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
        doc.text(dateStr, pageWidth / 2, currentY, { align: 'center' });
        currentY += 12;

        doc.setDrawColor(189, 195, 199);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;
    };

    const addSummaryStats = (programsList) => {
        checkPageBreak(40);

        doc.setFontSize(14);
        doc.setTextColor(52, 73, 94);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary Statistics', margin, currentY);
        currentY += 8;

        // Calculate totals from programs
        const totalSessions = programsList.reduce((sum, p) => sum + (p.total_sessions || 0), 0);
        const totalPrograms = programsList.length;

        // Create stats boxes
        const boxWidth = (pageWidth - 2 * margin - 20) / 3;
        const boxHeight = 20;
        const boxStartY = currentY;

        // Total Sessions
        doc.setFillColor(219, 157, 50); // Gold
        doc.roundedRect(margin, boxStartY, boxWidth, boxHeight, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(String(totalSessions), margin + boxWidth / 2, boxStartY + 10, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Total Sessions', margin + boxWidth / 2, boxStartY + 16, { align: 'center' });

        // Programs
        doc.setFillColor(46, 204, 113); // Green
        doc.roundedRect(margin + boxWidth + 10, boxStartY, boxWidth, boxHeight, 3, 3, 'F');
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(String(totalPrograms), margin + boxWidth + 10 + boxWidth / 2, boxStartY + 10, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Programs', margin + boxWidth + 10 + boxWidth / 2, boxStartY + 16, { align: 'center' });

        // Date Range
        const dates = programsList
            .map(p => p.last_session_date)
            .filter(d => d)
            .sort();
        const latestDate = dates.length > 0
            ? new Date(dates[dates.length - 1]).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : 'N/A';

        doc.setFillColor(155, 89, 182); // Purple
        doc.roundedRect(margin + 2 * (boxWidth + 10), boxStartY, boxWidth, boxHeight, 3, 3, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(latestDate, margin + 2 * (boxWidth + 10) + boxWidth / 2, boxStartY + 10, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Latest Session', margin + 2 * (boxWidth + 10) + boxWidth / 2, boxStartY + 16, { align: 'center' });

        currentY = boxStartY + boxHeight + 12;
    };

    // Helper function to add program breakdown
    const addProgramBreakdown = (programsList) => {
        checkPageBreak(50);

        doc.setFontSize(14);
        doc.setTextColor(52, 73, 94);
        doc.setFont('helvetica', 'bold');
        doc.text('Program Breakdown', margin, currentY);
        currentY += 12;

        const programData = programsList.map(program => [
            program.program_name,
            String(program.total_sessions || 0),
            program.last_session_date
                ? new Date(program.last_session_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                })
                : 'N/A'
        ]);

        const availableWidth = pageWidth - 2 * margin;
        const columnWidths = [availableWidth * 0.5, availableWidth * 0.25, availableWidth * 0.25];
        drawTable(['Program Name', 'Sessions', 'Last Session'], programData, currentY, columnWidths);
    };

    // Helper function to add detailed session reports from programs
    const addDetailedProgramReports = (programsList) => {
        for (const program of programsList) {
            if (!program.sessions || program.sessions.length === 0) continue;

            checkPageBreak(60);

            // Program header
            doc.setFontSize(13);
            doc.setTextColor(41, 128, 185);
            doc.setFont('helvetica', 'bold');
            doc.text(`Program: ${program.program_name}`, margin, currentY);
            currentY += 6;

            doc.setFontSize(10);
            doc.setTextColor(127, 140, 141);
            doc.setFont('helvetica', 'normal');
            doc.text(`Total Sessions: ${program.total_sessions || program.sessions.length}`, margin, currentY);
            currentY += 8;

            // Create table data from session data
            const tableData = program.sessions.map((session, idx) => {
                const dateStr = session.session_date
                    ? new Date(session.session_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    })
                    : 'N/A';

                return [
                    `Session ${session.session_number || idx + 1}`,
                    dateStr,
                    session.prompt_meter || 'N/A',
                    session.reinforcement_meter || 'N/A',
                ];
            });

            const availableWidth = pageWidth - 2 * margin;
            const columnWidths = [availableWidth * 0.25, availableWidth * 0.25, availableWidth * 0.25, availableWidth * 0.25];
            drawTable(['Session', 'Date', 'Prompt Level', 'Reinforcement Level'], tableData, currentY, columnWidths);
        }
    };

    // Generate PDF content
    addHeader();

    // Use programs array (works for both single and multiple programs)
    if (programs && programs.length > 0) {
        addSummaryStats(programs);
        addProgramBreakdown(programs);

        // Add page break before detailed reports if there are multiple programs
        if (programs.length > 1 || (programs[0]?.sessions && programs[0].sessions.length > 5)) {
            doc.addPage();
            currentY = margin;

            doc.setFontSize(16);
            doc.setTextColor(52, 73, 94);
            doc.setFont('helvetica', 'bold');
            doc.text('Detailed Learning Progress', margin, currentY);
            currentY += 12;
        }

        addDetailedProgramReports(programs);
    } else {
        // Empty state
        doc.setFontSize(14);
        doc.setTextColor(255, 0, 0);
        doc.text('No data available for PDF generation.', margin, currentY);
    }

    // Add footer to all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(127, 140, 141);
        doc.setFont('helvetica', 'normal');
        doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
        doc.text(
            'HurshbinTech - Progress Report',
            margin,
            pageHeight - 10
        );
    }

    return doc;
};

/**
 * Download progress report as PDF
 */
export const downloadProgressReportPDF = (data, options = {}) => {
    const { learnerName, programName } = data;
    const doc = generateProgressReportPDF(data, options);

    // Generate filename
    const sanitizeName = (name) => name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = programName
        ? `progress_report_${sanitizeName(learnerName)}_${sanitizeName(programName)}_${timestamp}.pdf`
        : `progress_report_${sanitizeName(learnerName)}_all_programs_${timestamp}.pdf`;

    // Save PDF
    doc.save(filename);
};

/**
 * Download a program progress report PDF matching the "View Report" modal layout:
 *  - Gold header (learner name, program name, generated date)
 *  - Bar chart of prompt values per session
 *  - Session details table (Session ID | Date & Time | Prompt Level)
 *
 * @param {object} params
 * @param {string} params.learnerName
 * @param {string} params.programName
 * @param {Array}  params.sessionData  – processed session array from ProgramGraphView state
 */
export const downloadProgramGraphPDF = async ({ learnerName, programName, sessionData }) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();   // 210
    const pageHeight = doc.internal.pageSize.getHeight();  // 297
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    /* ── BRANDED HEADER ───────────────────────────────────────────── */
    const headerDataURL = await loadHeaderDataURL();
    const subtitle = learnerName ? `${learnerName}  —  ${programName}` : programName;
    const genDate = `Generated on: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })}`;
    let y = drawBrandedHeader(doc, {
        headerDataURL,
        reportTitle: 'Progress Graph',
        subtitle,
        generatedDate: genDate,
    });

    /* ── BAR CHART ────────────────────────────────────────────────── */
    const chartH = 70;
    const chartTop = y;
    const chartBottom = y + chartH;
    const axisLeft = margin + 12; // space for Y labels
    const axisRight = pageWidth - margin;
    const chartW = axisRight - axisLeft;

    // Y-axis labels & grid lines (0, 25, 50, 75, 100)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    [0, 25, 50, 75, 100].forEach(val => {
        const gy = chartBottom - (val / 100) * chartH;
        // grid line
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(axisLeft, gy, axisRight, gy);
        // label
        doc.setTextColor(100, 100, 100);
        doc.text(String(val), axisLeft - 2, gy + 1, { align: 'right' });
    });

    // X & Y axis lines
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.line(axisLeft, chartTop, axisLeft, chartBottom);
    doc.line(axisLeft, chartBottom, axisRight, chartBottom);

    // Bars
    const n = sessionData.length;
    const barAreaW = chartW;
    const barW = Math.min(18, (barAreaW / n) * 0.55);
    const gap = barAreaW / n;

    sessionData.forEach((session, idx) => {
        const val = session.prompt_value ?? 0;
        const barH = (val / 100) * chartH;
        const bx = axisLeft + idx * gap + (gap - barW) / 2;
        const by = chartBottom - barH;

        // Bar fill – gold
        doc.setFillColor(219, 157, 50);
        doc.roundedRect(bx, by, barW, barH, 1, 1, 'F');

        // If value is 0, add a green line at the x-axis
        if (val === 0) {
            // Draw green line at x-axis
            doc.setDrawColor(34, 197, 94); // green color
            doc.setLineWidth(0.8);
            doc.line(bx, chartBottom, bx + barW, chartBottom);

            // Add "Done" text above the line
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(34, 197, 94);
            doc.text('Done', bx + barW / 2, chartBottom - 3, { align: 'center' });
        }

        // Value label above bar
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 60, 0);
        doc.text(String(val), bx + barW / 2, by - 1.5, { align: 'center' });

        // X label below chart
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(0, 0, 0);
        const xLabel = `S${session.session_id}`;
        doc.text(xLabel, bx + barW / 2, chartBottom + 5, { align: 'center' });
    });

    // Axis titles
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Prompt Level (0–100)', pageWidth / 2, chartBottom + 12, { align: 'center' });

    // Legend
    const legendX = axisRight - 28;
    const legendY = chartTop + 2;
    doc.setFillColor(219, 157, 50);
    doc.rect(legendX, legendY, 5, 3.5, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.text('Prompt Level', legendX + 7, legendY + 3);

    y = chartBottom + 18;

    /* ── DIVIDER ──────────────────────────────────────────────────── */
    doc.setDrawColor(219, 157, 50);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    /* ── SESSION DETAILS TABLE ────────────────────────────────────── */
    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(52, 73, 94);
    doc.text('Session Details', margin, y);
    y += 7;

    const cols = ['Session ID', 'Date & Time', 'Prompt Level'];
    const colW = [contentWidth * 0.22, contentWidth * 0.50, contentWidth * 0.28];
    const rowH = 8;
    const pad = 2.5;

    // Table header – gold (re-set fill + text color per cell to avoid jsPDF state bleed)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    let tx = margin;
    cols.forEach((col, i) => {
        doc.setFillColor(219, 157, 50);      // gold fill
        doc.setDrawColor(184, 121, 10);      // darker gold border
        doc.setLineWidth(0.3);
        doc.rect(tx, y, colW[i], rowH, 'FD');
        doc.setTextColor(255, 255, 255);     // white text
        doc.text(col, tx + pad, y + rowH - pad, { maxWidth: colW[i] - pad * 2 });
        tx += colW[i];
    });
    y += rowH;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    sessionData.forEach((session, idx) => {
        if (y + rowH > pageHeight - 14) {
            doc.addPage();
            y = margin;
        }

        const isEven = idx % 2 === 0;
        const dateStr = session.session_date
            ? new Date(session.session_date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })
            : 'N/A';
        const promptLabel = `${session.prompt_meter}  (${session.prompt_value}/100)`;
        const rowCells = [`Session ${session.session_id}`, dateStr, promptLabel];

        tx = margin;
        rowCells.forEach((cell, i) => {
            // Explicitly set fill and stroke for every cell
            if (isEven) {
                doc.setFillColor(249, 250, 251);
            } else {
                doc.setFillColor(255, 255, 255);
            }
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.2);
            doc.rect(tx, y, colW[i], rowH, 'FD');

            // Text color per column
            if (i === 2) {
                doc.setTextColor(156, 106, 8);  // gold for prompt value
            } else {
                doc.setTextColor(50, 50, 50);   // dark grey
            }
            doc.text(cell, tx + pad, y + rowH - pad, { maxWidth: colW[i] - pad * 2 });
            tx += colW[i];
        });
        y += rowH;
    });

    /* ── FOOTER ───────────────────────────────────────────────────── */
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(7.5);
        doc.setTextColor(160, 160, 160);
        doc.setFont('helvetica', 'normal');
        doc.text('HurshbinTech — Progress Report', margin, pageHeight - 8);
        doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    /* ── SAVE ─────────────────────────────────────────────────────── */
    const safe = (s) => (s || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const ts = new Date().toISOString().split('T')[0];
    doc.save(`progress_report_${safe(learnerName)}_${safe(programName)}_${ts}.pdf`);
};

/**
 * Download a full all-programs report PDF that matches the "View Report" modal layout:
 *  - Gold gradient header (learner name, generated date)
 *  - Summary cards (Programs, Total Sessions, Latest Session)
 *  - Per-program sections: bar chart + session details table (gold headers)
 *
 * @param {object} params
 * @param {string} params.learnerName
 * @param {Array}  params.programs  – array from getPdfData API, each with .program_name,
 *                                    .total_sessions, .last_session_date, .sessions[]
 */
export const downloadAllProgramsPDF = async ({ learnerName, programs }) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    const safe = (s) => (s || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();

    /* ── BRANDED HEADER ─────────────────────────────────────────── */
    const headerDataURL = await loadHeaderDataURL();
    let y = drawBrandedHeader(doc, {
        headerDataURL,
        reportTitle: 'Latest Skilled Development',
        subtitle: learnerName || 'Learner',
        generatedDate: `Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    });

    /* ── helpers ─────────────────────────────────────────────────── */
    const checkBreak = (needed) => {
        if (y + needed > pageHeight - 14) {
            doc.addPage();
            y = margin;
            return true;
        }
        return false;
    };

    const drawSummaryCards = () => {
        const totalSessions = programs.reduce((s, p) => s + (p.total_sessions || p.sessions?.length || 0), 0);
        const dates = programs.map(p => p.last_session_date).filter(Boolean).sort();
        const latestDate = dates.length > 0
            ? new Date(dates[dates.length - 1]).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : 'N/A';

        const cardW = (contentWidth - 8) / 3;
        const cardH = 18;
        const cardY = y;

        // Programs card (gold)
        doc.setFillColor(219, 157, 50);
        doc.roundedRect(margin, cardY, cardW, cardH, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(String(programs.length), margin + cardW / 2, cardY + 10, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Programs', margin + cardW / 2, cardY + 15, { align: 'center' });

        // Total Sessions card (green)
        const c2x = margin + cardW + 4;
        doc.setFillColor(46, 204, 113);
        doc.roundedRect(c2x, cardY, cardW, cardH, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(String(totalSessions), c2x + cardW / 2, cardY + 10, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Total Sessions', c2x + cardW / 2, cardY + 15, { align: 'center' });

        // Latest Session card (purple)
        const c3x = margin + 2 * (cardW + 4);
        doc.setFillColor(155, 89, 182);
        doc.roundedRect(c3x, cardY, cardW, cardH, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(latestDate, c3x + cardW / 2, cardY + 10, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Latest Session', c3x + cardW / 2, cardY + 15, { align: 'center' });

        y = cardY + cardH + 10;
    };

    const drawProgramSection = (prog) => {
        const sessions = prog.sessions || [];

        /* sub-header bar */
        checkBreak(14);
        doc.setFillColor(243, 244, 246);
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.rect(margin, y, contentWidth, 12, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(55, 65, 81);
        doc.text(`  ${prog.program_name}`, margin + 2, y + 8);
        const subLabel = `${prog.total_sessions || sessions.length} Sessions${prog.last_session_date ? '  ·  Last: ' + new Date(prog.last_session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(107, 114, 128);
        doc.text(subLabel, pageWidth - margin - 2, y + 8, { align: 'right' });
        y += 14;

        if (sessions.length === 0) {
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text('No session data available', pageWidth / 2, y + 5, { align: 'center' });
            y += 12;
            return;
        }

        /* bar chart */
        const chartH = 55;
        checkBreak(chartH + 20);
        const chartTop = y;
        const chartBottom = y + chartH;
        const axisLeft = margin + 12;
        const axisRight = pageWidth - margin;
        const chartW = axisRight - axisLeft;

        // grid + Y labels
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        [0, 25, 50, 75, 100].forEach(val => {
            const gy = chartBottom - (val / 100) * chartH;
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.2);
            doc.line(axisLeft, gy, axisRight, gy);
            doc.setTextColor(100, 100, 100);
            doc.text(String(val), axisLeft - 2, gy + 1, { align: 'right' });
        });

        // axes
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.4);
        doc.line(axisLeft, chartTop, axisLeft, chartBottom);
        doc.line(axisLeft, chartBottom, axisRight, chartBottom);

        // bars
        const n = sessions.length;
        const gap = chartW / n;
        const barW = Math.min(16, gap * 0.55);

        sessions.forEach((session, idx) => {
            const val = session.prompt_value ?? 0;
            const barH = (val / 100) * chartH;
            const bx = axisLeft + idx * gap + (gap - barW) / 2;
            const by = chartBottom - barH;

            // Bar fill
            doc.setFillColor(219, 157, 50);
            doc.roundedRect(bx, by, barW, barH, 1, 1, 'F');

            // --- Green line and "Done" for 0 value ---
            if (val === 0) {
                // Draw green line at the bottom (0 level)
                doc.setDrawColor(34, 197, 94); // #22c55e
                doc.setLineWidth(0.8);
                doc.line(bx, chartBottom, bx + barW, chartBottom);

                // Draw "Done" text above
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6);
                doc.setTextColor(34, 197, 94);
                doc.text('Done', bx + barW / 2, chartBottom - 2, { align: 'center' });
            } else {
                // Prompt value text above non-zero bars
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6);
                doc.setTextColor(100, 60, 0);
                doc.text(String(val), bx + barW / 2, by - 1.5, { align: 'center' });
            }

            // Session ID label
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(80, 80, 80);
            doc.text(`S${session.session_id}`, bx + barW / 2, chartBottom + 4.5, { align: 'center' });
        });

        // axis title + legend
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(0, 0, 0);
        doc.text('Session ID & Time', pageWidth / 2, chartBottom + 10, { align: 'center' });
        const legX = axisRight - 26;
        doc.setFillColor(219, 157, 50);
        doc.rect(legX, chartTop + 2, 4.5, 3, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(6.5);
        doc.text('Prompt Level', legX + 6, chartTop + 4.5);

        y = chartBottom + 14;

        /* session details table */
        checkBreak(16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(52, 73, 94);
        doc.text('Session Details', margin, y);
        y += 6;

        const cols = ['Session ID', 'Date & Time', 'Prompt Level'];
        const colW = [contentWidth * 0.22, contentWidth * 0.50, contentWidth * 0.28];
        const rowH = 7.5;
        const pad = 2.2;

        // header row
        let tx = margin;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        cols.forEach((col, i) => {
            doc.setFillColor(219, 157, 50);
            doc.setDrawColor(184, 121, 10);
            doc.setLineWidth(0.3);
            doc.rect(tx, y, colW[i], rowH, 'FD');
            doc.setTextColor(255, 255, 255);
            doc.text(col, tx + pad, y + rowH - pad, { maxWidth: colW[i] - pad * 2 });
            tx += colW[i];
        });
        y += rowH;

        // data rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        sessions.forEach((session, idx) => {
            checkBreak(rowH + 2);
            const dateStr = session.session_date
                ? new Date(session.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'N/A';
            const promptLabel = `${session.prompt_meter}  (${session.prompt_value}/100)`;
            const cells = [`Session ${session.session_id}`, dateStr, promptLabel];
            tx = margin;
            cells.forEach((cell, i) => {
                doc.setFillColor(idx % 2 === 0 ? 249 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 251 : 255);
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.2);
                doc.rect(tx, y, colW[i], rowH, 'FD');
                doc.setTextColor(i === 2 ? 156 : 50, i === 2 ? 106 : 50, i === 2 ? 8 : 50);
                doc.text(cell, tx + pad, y + rowH - pad, { maxWidth: colW[i] - pad * 2 });
                tx += colW[i];
            });
            y += rowH;
        });

        y += 8; // spacing before next program
    };

    /* ── BUILD PDF ────────────────────────────────────────────────── */
    drawSummaryCards();

    programs.forEach((prog, idx) => {
        if (idx > 0) checkBreak(60);
        drawProgramSection(prog);
    });

    /* ── FOOTER ───────────────────────────────────────────────────── */
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(7.5);
        doc.setTextColor(160, 160, 160);
        doc.setFont('helvetica', 'normal');
        doc.text('HurshbinTech — Progress Report', margin, pageHeight - 8);
        doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    /* ── SAVE ─────────────────────────────────────────────────────── */
    const ts = new Date().toISOString().split('T')[0];
    doc.save(`progress_report_${safe(learnerName)}_all_programs_${ts}.pdf`);
};

/* ─────────────────────────────────────────────────────────────────
   LEARNER PROGRESS REPORT PDF
   Matches the HurshBin branded format:
   • Gold border • Company header image • Structured content • Footer
   ───────────────────────────────────────────────────────────────── */
export const generateLearnerProgressReportPDF = async (form, { signatureImage = null, previewOnly = false } = {}) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();   // 210 mm
    const pageH = doc.internal.pageSize.getHeight();  // 297 mm

    const BORDER_MARGIN = 8;
    const BORDER_THICK = 3.5;
    const INNER_PAD = 5;
    const contentX = BORDER_MARGIN + BORDER_THICK + INNER_PAD;
    const contentW = pageW - 2 * contentX;
    const GOLD = [210, 140, 30];
    const BROWN = [122, 44, 44];  // Brown color (#7a2c2c) for headings
    const FOOTER_H = 38;   // height reserved at bottom for footer

    // ── Draw outer gold border on current page ──────────────────────
    const drawBorder = () => {
        doc.setDrawColor(...GOLD);
        doc.setLineWidth(BORDER_THICK);
        doc.rect(BORDER_MARGIN, BORDER_MARGIN,
            pageW - 2 * BORDER_MARGIN, pageH - 2 * BORDER_MARGIN, 'S');
    };

    // ── Load image and convert to base64 ──────────────────────
    const loadImage = async (imagePath) => {
        try {
            const response = await fetch(imagePath);
            if (!response.ok) {
                console.warn(`Image not found: ${imagePath}`);
                return null;
            }
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result);
                reader.onerror = () => {
                    console.warn(`Failed to read image: ${imagePath}`);
                    resolve(null);
                };
                reader.readAsDataURL(blob);
            });
        } catch (err) {
            console.warn(`Could not load image ${imagePath}:`, err.message);
            return null;
        }
    };

    // ── Draw footer on current page ─────────────────────────────────
    const drawFooter = async (pageNum, totalPages) => {
        try {
            const footerTop = pageH - BORDER_MARGIN - BORDER_THICK - INNER_PAD - FOOTER_H + 3;

            // Gold divider
            doc.setDrawColor(...GOLD);
            doc.setLineWidth(0.6);
            doc.line(contentX, footerTop, contentX + contentW, footerTop);

            let fy = footerTop + 6;

            // Company name centred
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            doc.text(
                'HURSHBIN CHILD DEVELOPMENT, LEARNING AND BEHAVIOUR SERVICES (ABA)',
                pageW / 2, fy, { align: 'center' }
            );
            fy += 6;

            // Load icons from public/icons folder
            const telIcon = await loadImage('/icons/Tel.png');
            const instaIcon = await loadImage('/icons/Instagram.webp');
            const fbIcon = await loadImage('/icons/FB.png');
            const webIcon = await loadImage('/icons/Web.png');

            // Two-column contact line with icons
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const col1 = contentX + 4;
            const col2 = pageW / 2 + 8;
            const iconSize = 3.5; // 3.5mm icons
            const iconOffsetX = -1; // Left of text

            // Column 1: Tel and Instagram
            let col1X = col1;
            if (telIcon) {
                try {
                    doc.addImage(telIcon, 'PNG', col1X + iconOffsetX, fy - 2.4, iconSize, iconSize);
                } catch (e) {
                    console.warn('Failed to add tel icon:', e.message);
                }
                col1X += 4;
            }
            doc.text('+91 8928765220', col1X, fy);

            fy += 5.5;
            col1X = col1;
            if (instaIcon) {
                try {
                    doc.addImage(instaIcon, 'WEBP', col1X + iconOffsetX, fy - 2.4, iconSize, iconSize);
                } catch (e) {
                    // Try as PNG if WEBP fails
                    try {
                        doc.addImage(instaIcon, 'PNG', col1X + iconOffsetX, fy - 2.4, iconSize, iconSize);
                    } catch (e2) {
                        console.warn('Failed to add instagram icon:', e2.message);
                    }
                }
                col1X += 4;
            }
            doc.text('hurshbin_mumbai / binal_all_about_happychild', col1X, fy, { maxWidth: contentW / 2 - 8 });

            // Column 2: Facebook and Web
            fy = footerTop + 12;
            let col2X = col2;
            if (fbIcon) {
                try {
                    doc.addImage(fbIcon, 'PNG', col2X + iconOffsetX, fy - 2.4, iconSize, iconSize);
                } catch (e) {
                    console.warn('Failed to add facebook icon:', e.message);
                }
                col2X += 4;
            }
            doc.text('HurshBin Child Development Learning & Behaviour Services', col2X, fy, { maxWidth: contentW / 2 - 8 });

            fy += 5.5;
            col2X = col2;
            if (webIcon) {
                try {
                    doc.addImage(webIcon, 'PNG', col2X + iconOffsetX, fy - 2.4, iconSize, iconSize);
                } catch (e) {
                    console.warn('Failed to add web icon:', e.message);
                }
                col2X += 4;
            }
            doc.text('www.HurshBin.com', col2X, fy);

            // Page counter for multi-page docs
            if (totalPages > 1) {
                doc.setFontSize(7);
                doc.setTextColor(0, 0, 0);
                doc.text(`Page ${pageNum} / ${totalPages}`,
                    pageW / 2, pageH - BORDER_MARGIN - BORDER_THICK - INNER_PAD - 2, { align: 'center' });
            }
        } catch (err) {
            console.error('Error drawing footer:', err.message);
            // Continue anyway - don't let footer errors crash the PDF generation
        }
    };

    // Load header image (/public/Header.jpeg)
    const headerImg = await loadHeaderDataURL();

    // ── Page state ──────────────────────────────────────────────────
    const START_Y = BORDER_MARGIN + BORDER_THICK + INNER_PAD;
    let y = START_Y;

    // Add new page helper
    const newPage = () => {
        doc.addPage();
        drawBorder();
        y = START_Y;
    };

    // Page-break check (reserve footer space and bottom border)
    const maybeBreak = (needed = 10) => {
        if (y + needed > pageH - BORDER_MARGIN - BORDER_THICK - INNER_PAD - FOOTER_H - 2) {
            newPage();
            return true;
        }
        return false;
    };

    // ── Utility: write wrapped text advancing y ──────────────────────
    const writeWrapped = (text, x, maxW, lineH = 5.2, fontStyle = 'normal', fontSize = 10.5) => {
        if (!text) return;
        doc.setFont('helvetica', fontStyle);
        doc.setFontSize(fontSize);
        doc.setTextColor(0, 0, 0);
        const lines = doc.splitTextToSize(String(text), maxW);
        lines.forEach(line => {
            maybeBreak(lineH + 1);
            doc.text(line, x, y);
            y += lineH;
        });
    };

    // ── Utility: bold-label on one line, value after ────────────────
    const FIELD_FS = 10.5;
    const LINE_H = 6.5;

    const renderField = (label, value) => {
        maybeBreak(LINE_H + 2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FIELD_FS);
        doc.setTextColor(...BROWN);
        const lw = doc.getTextWidth(label + ' ');
        doc.text(label, contentX, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        if (value) doc.text(value, contentX + lw, y);
        y += LINE_H;
    };

    const fmtDate = (d) => {
        if (!d) return '';
        try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }); }
        catch { return d; }
    };

    /* ══════════════════════════════════════════════════════════════
       PAGE 1 CONTENT
    ══════════════════════════════════════════════════════════════ */
    drawBorder();

    // ── Header image ───────────────────────────────────────────────
    if (headerImg) {
        const imgH = contentW * (headerImg.naturalHeight / headerImg.naturalWidth);
        doc.addImage(headerImg.dataURL, 'PNG', contentX, y, contentW, imgH, '', 'FAST');
        // Redraw border so it appears on top of image
        doc.setDrawColor(...GOLD);
        doc.setLineWidth(BORDER_THICK);
        doc.rect(BORDER_MARGIN, BORDER_MARGIN,
            pageW - 2 * BORDER_MARGIN, pageH - 2 * BORDER_MARGIN, 'S');
        y += imgH + 5;
    } else {
        // Fallback branded text header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text('HURSHBIN CHILD DEVELOPMENT, LEARNING AND BEHAVIOUR (ABA) SERVICES',
            pageW / 2, y + 8, { align: 'center', maxWidth: contentW });
        y += 16;
    }

    // ── "REPORT" title ─────────────────────────────────────────────
    maybeBreak(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...BROWN);
    doc.text('THE COMPREHENSIVE SKILL DEVELOPMENT EVALUATION REPORT', pageW / 2, y, { align: 'center' });
    // Add underline
    const reportTextWidth = doc.getTextWidth('THE COMPREHENSIVE SKILL DEVELOPMENT EVALUATION REPORT');
    const reportLineX1 = pageW / 2 - reportTextWidth / 2;
    const reportLineX2 = pageW / 2 + reportTextWidth / 2;
    doc.setDrawColor(...BROWN);
    doc.setLineWidth(0.8);
    doc.line(reportLineX1, y + 3, reportLineX2, y + 3);
    y += 12;  // Extra space after underline

    // ── Basic info fields ──────────────────────────────────────────
    // Name and Refered by on same line (Name on left, Refered by on right)
    maybeBreak(LINE_H + 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FIELD_FS);
    doc.setTextColor(...BROWN);

    // Left column: Name
    const midpoint = contentX + contentW / 2;
    doc.text('Name:', contentX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(form.name || '', contentX + 20, y);

    // Right column: Refered by
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BROWN);
    doc.text('Refered by:', midpoint, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(form.referred_by || '', midpoint + 22, y);

    y += LINE_H;

    // Date of Birth and Date of Report
    renderField('Date of Birth:', fmtDate(form.date_of_birth));
    renderField('Date of report:', fmtDate(form.date_of_report));
    y += 2; // blank line gap

    // ── Birth History ──────────────────────────────────────────────
    maybeBreak(LINE_H + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FIELD_FS);
    doc.setTextColor(...BROWN);
    doc.text('Birth History:', contentX, y);
    y += LINE_H;
    if (form.birth_history) {
        writeWrapped(form.birth_history, contentX + 4, contentW - 6, 5.2, 'normal', 10.5);
    }
    y += 3;

    // ── Development History ────────────────────────────────────────
    maybeBreak(LINE_H + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FIELD_FS);
    doc.setTextColor(...BROWN);
    doc.text('Development History:', contentX, y);
    y += LINE_H;
    if (form.development_history) {
        writeWrapped(form.development_history, contentX + 4, contentW - 6, 5.2, 'normal', 10.5);
    }
    y += 3;

    // ── Learning History ──────────────────────────────────────────
    maybeBreak(LINE_H + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FIELD_FS);
    doc.setTextColor(...BROWN);
    doc.text('Learning History:', contentX, y);
    y += LINE_H;
    if (form.learning_history) {
        writeWrapped(form.learning_history, contentX + 4, contentW - 6, 5.2, 'normal', 10.5);
    }
    y += 3;

    // ── Check if this is a Coach or Head report ─────────────────────
    const isCoachReport = form.report_type === 'coach';
    const coachQnaData = form.coach_qna_data || [];

    // ── Assessment Content (Coach Q&A or Head Development Areas) ─────
    if (isCoachReport && coachQnaData.length > 0) {
        // COACH: Questions & Answers
        maybeBreak(14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...BROWN);
        doc.text('ASSESSMENT QUESTIONS & ANSWERS', contentX + contentW / 2, y, { align: 'center' });
        // Add underline
        const assessmentTextWidth = doc.getTextWidth('ASSESSMENT QUESTIONS & ANSWERS');
        const assessmentLineX1 = contentX + contentW / 2 - assessmentTextWidth / 2;
        const assessmentLineX2 = contentX + contentW / 2 + assessmentTextWidth / 2;
        doc.setDrawColor(...BROWN);
        doc.setLineWidth(0.8);
        doc.line(assessmentLineX1, y + 3, assessmentLineX2, y + 3);
        y += LINE_H + 4;  // Extra space after underline

        coachQnaData.forEach((qaPair, idx) => {
            maybeBreak(LINE_H + 2);
            // Question heading only (no number prefix)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FIELD_FS);
            doc.setTextColor(...BROWN);
            const questionTitle = qaPair.heading || 'Question';
            const lines = doc.splitTextToSize(questionTitle, contentW - 4);
            lines.forEach(l => {
                maybeBreak(LINE_H);
                doc.text(l, contentX + 2, y);
                y += LINE_H;
            });
            // Answer text
            if (qaPair.answer) {
                writeWrapped(qaPair.answer, contentX + 8, contentW - 12, 5.2, 'normal', 10.5);
            }
            y += 2;
        });

        // Summary fields for Coach reports
        y += 3;

        // Intervention Plan
        if (form.intervention_plan) {
            maybeBreak(LINE_H + 4);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FIELD_FS);
            doc.setTextColor(...BROWN);
            doc.text('The Immediate Intervention Plan:', contentX, y);
            y += LINE_H;
            writeWrapped(form.intervention_plan, contentX + 4, contentW - 6, 5.2, 'normal', 10.5);
            y += 2;
        }

        // Recommendation
        if (form.recommendation) {
            maybeBreak(LINE_H + 6);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FIELD_FS);
            doc.setTextColor(...BROWN);
            doc.text('Recommendation:', contentX, y);
            y += LINE_H + 1;
            doc.setTextColor(0, 0, 0);
            writeWrapped(form.recommendation, contentX + 4, contentW - 6, 5.2, 'normal', 10.5);
            y += 3;
        }

        // Conclusion
        if (form.conclusion) {
            maybeBreak(LINE_H + 6);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FIELD_FS);
            doc.setTextColor(...BROWN);
            doc.text('Conclusion:', contentX, y);
            y += LINE_H + 1;
            doc.setTextColor(0, 0, 0);
            writeWrapped(form.conclusion, contentX + 4, contentW - 6, 5.2, 'normal', 10.5);
            y += 3;
        }

        // Intervention Plan for Coach
        if (form.intervention_plan) {
            maybeBreak(LINE_H + 6);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FIELD_FS);
            doc.setTextColor(...BROWN);
            doc.text('The Immediate Intervention Plan:', contentX, y);
            y += LINE_H + 1;
            doc.setTextColor(0, 0, 0);
            writeWrapped(form.intervention_plan, contentX + 4, contentW - 6, 5.2, 'normal', 10.5);
            y += 3;
        }
    } else if (!isCoachReport) {
        // HEAD: Functional Development Overview (9 areas)
        maybeBreak(14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FIELD_FS);
        doc.setTextColor(...BROWN);
        doc.text('Functional Development Overview through overall development', contentX + contentW / 2, y, { align: 'center' });
        // Add underline
        const functionalTextWidth = doc.getTextWidth('Functional Development Overview through overall development');
        const functionalLineX1 = contentX + contentW / 2 - functionalTextWidth / 2;
        const functionalLineX2 = contentX + contentW / 2 + functionalTextWidth / 2;
        doc.setDrawColor(...BROWN);
        doc.setLineWidth(0.8);
        doc.line(functionalLineX1, y + 3, functionalLineX2, y + 3);
        y += LINE_H + 4;  // Extra space after underline

        const AREAS = [
            { key: 'attention_cooperation', label: 'ATTENTION & CO-OPERATION' },
            { key: 'sensory_integration_motor', label: 'SENSORY INTEGRATION & MOTOR COORDINATION' },
            { key: 'speech_language_communication', label: 'SPEECH, LANGUAGE & COMMUNICATION' },
            { key: 'play_leisure', label: 'PLAY & LEISURE' },
            { key: 'social_interaction_group', label: 'SOCIAL INTERACTION AND GROUP BEHAVIOUR' },
            { key: 'emotional_regulation', label: 'EMOTIONAL REGULATION' },
            { key: 'independent_living', label: 'INDEPENDENT LIVING' },
            { key: 'academic_readiness', label: 'ACADEMIC READINESS' },
            { key: 'professional_development', label: 'PROFESSIONAL DEVELOPMENT' },
        ];

        AREAS.forEach(({ key, label }) => {
            maybeBreak(LINE_H + 2);
            // Bullet + uppercase label
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FIELD_FS);
            doc.setTextColor(...BROWN);
            const lines = doc.splitTextToSize(`\u2022  ${label}`, contentW - 4);
            lines.forEach(l => {
                maybeBreak(LINE_H);
                doc.text(l, contentX + 2, y);
                y += LINE_H;
            });
            // Content text
            if (form[key]) {
                writeWrapped(form[key], contentX + 8, contentW - 12, 5.2, 'normal', 10.5);
            }
            y += 2;
        });
    }

    y += 2;

    // ── The Immediate Intervention Plan ────────────────────────────
    if (form.intervention_plan) {
        maybeBreak(LINE_H + 6);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FIELD_FS);
        doc.setTextColor(...BROWN);
        doc.text('The Immediate Intervention Plan:', contentX, y);
        y += LINE_H + 1;
        doc.setTextColor(0, 0, 0);
        writeWrapped(form.intervention_plan, contentX + 4, contentW - 6, 5.2, 'normal', 10.5);
        y += 3;
    }

    // ── Recommendation ─────────────────────────────────────────────
    if (form.recommendation) {
        maybeBreak(LINE_H + 6);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FIELD_FS);
        doc.setTextColor(...BROWN);
        doc.text('Recommendation:', contentX, y);
        y += LINE_H + 1;
        doc.setTextColor(0, 0, 0);
        writeWrapped(form.recommendation, contentX + 4, contentW - 6, 5.2, 'normal', 10.5);
        y += 3;
    }

    // ── Conclusion ─────────────────────────────────────────────────
    if (form.conclusion) {
        maybeBreak(LINE_H + 6);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FIELD_FS);
        doc.setTextColor(...BROWN);
        doc.text('Conclusion:', contentX, y);
        y += LINE_H + 1;
        doc.setTextColor(0, 0, 0);
        writeWrapped(form.conclusion, contentX + 4, contentW - 6, 5.2, 'normal', 10.5);
        y += 3;
    }

    // ── Report Created By ──────────────────────────────────────────
    maybeBreak(LINE_H + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FIELD_FS);
    doc.setTextColor(...BROWN);
    doc.text('Report Created By:', contentX, y);
    y += LINE_H + 1;
    if (form.report_created_by) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(form.report_created_by, contentX + 4, y);
        y += LINE_H;
    }

    // ── Disclaimer ────────────────────────────────────────────────
    maybeBreak(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BROWN);
    doc.text('Disclaimer:', contentX, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const disclaimerText = 'This report has been prepared based on observations, assessments, interactions, tools and information provided by parents/caregivers at the time of evaluation.'
    const disclaimerLines = doc.splitTextToSize(disclaimerText, contentW - 6);
    disclaimerLines.forEach(line => {
        maybeBreak(5);
        doc.text(line, contentX + 4, y);
        y += 5;
    });

    // ── Digital Signature & Stamp ──────────────────────────────────
    maybeBreak(45);
    const sigX = contentX + contentW - 44; // Right side positioning for signature
    const stampX = sigX - 45; // Left of signature

    // Load and add Stamp.png
    const stampImg = await loadImage('/sign/Stamp.png');
    if (stampImg) {
        const stampW = 38;
        const stampH = 38;
        doc.addImage(stampImg, 'PNG', stampX, y - 5, stampW, stampH, '', 'FAST');
    }

    if (signatureImage) {
        const sigImgW = 40;
        const sigImgH = 25;
        // Load signature image from public folder
        try {
            const sigBlob = await fetch(signatureImage).then(res => res.blob());
            const sigDataURL = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result);
                reader.readAsDataURL(sigBlob);
            });
            doc.addImage(sigDataURL, 'PNG', sigX, y, sigImgW, sigImgH, '', 'FAST');
        } catch (err) {
            console.warn('Could not load signature image:', err);
        }
    }

    // ── Professional Signature Line ────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FIELD_FS);
    doc.setTextColor(...BROWN);
    doc.text('Ms.Binal Shah For HurshBin Child Development Learning & Behaviour Modification services', sigX + 40, y + 32, { align: 'right', maxWidth: 50 });
    y = Math.max(y + 45, y + 45);



    /* ── Stamp footer ONLY on the last page ──────────────────────── */
    const totalPages = doc.internal.getNumberOfPages();
    doc.setPage(totalPages);
    await drawFooter(totalPages, totalPages);

    /* ── Save / Preview ──────────────────────────────────────────── */
    const safe = (s) => (s || 'report').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const ts = new Date().toISOString().split('T')[0];

    if (previewOnly) {
        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank');
        return doc.output('blob');
    }

    doc.save(`progress_report_${safe(form.name)}_${ts}.pdf`);

    // Return the PDF blob so callers can upload it to S3 on deploy
    return doc.output('blob');
};
