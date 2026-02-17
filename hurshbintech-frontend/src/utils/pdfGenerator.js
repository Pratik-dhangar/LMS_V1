import { jsPDF } from 'jspdf';

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
        const title = programName ? 'Program Progress Report' : 'Overall Progress Report';
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
            doc.text('Detailed Session Reports', margin, currentY);
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
