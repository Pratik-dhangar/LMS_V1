import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaArrowLeft, FaDownload, FaEye, FaSearch } from "react-icons/fa";

import Loader from "../../components/common/Loader";
import contactService from "../../api/services/contactService";
import "../../styles/Table.css";
import "../../styles/ManageUsersLayout.css";
import "../../styles/admin/AdminFreeAssessments.css";
import { generateFreeAssessmentPDF } from "../../utils/pdfGenerator";

const AdminFreeAssessments = () => {
    const navigate = useNavigate();

    const [initialLoading, setInitialLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState("");
    const hasInitializedSearch = useRef(false);
    const [pagination, setPagination] = useState({
        skip: 0,
        limit: 10,
        total: 0,
    });

    const fetchAssessments = async (skip = 0, searchTerm = search, { initial = false } = {}) => {
        try {
            if (initial) {
                setInitialLoading(true);
            } else {
                setTableLoading(true);
            }

            const data = await contactService.getAdminFreeAssessments(skip, pagination.limit, searchTerm);
            setItems(data.data || []);
            setPagination({
                skip: data.skip,
                limit: data.limit,
                total: data.total,
            });
        } catch (error) {
            console.error("Error loading free assessments:", error);
            toast.error("Failed to load free assessments");
        } finally {
            if (initial) {
                setInitialLoading(false);
            } else {
                setTableLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchAssessments(0, "", { initial: true });
    }, []);

    useEffect(() => {
        if (!hasInitializedSearch.current) {
            hasInitializedSearch.current = true;
            return;
        }

        const timeoutId = window.setTimeout(() => {
            fetchAssessments(0, search);
        }, 300);

        return () => window.clearTimeout(timeoutId);
    }, [search]);

    const handleSearch = (value) => {
        setSearch(value);
    };

    const handlePageChange = (newSkip) => {
        fetchAssessments(newSkip, search);
    };

    const handleDownloadPdf = async (assessment) => {
        try {
            await generateFreeAssessmentPDF(assessment);
            toast.success("Free assessment PDF downloaded successfully");
        } catch (error) {
            console.error("Error downloading free assessment PDF:", error);
            toast.error("Failed to download free assessment PDF");
        }
    };

    const handlePreviewPdf = async (assessment) => {
        try {
            await generateFreeAssessmentPDF(assessment, { previewOnly: true });
        } catch (error) {
            console.error("Error previewing free assessment PDF:", error);
            toast.error("Failed to preview free assessment PDF");
        }
    };

    const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
    const currentPage = Math.floor(pagination.skip / pagination.limit) + 1;

    if (initialLoading) {
        return <Loader />;
    }

    return (
        <div className="page-container">
            <main className="page-main">
                <div className="page-content">
                    <div className="page-header">
                        <button className="back-button" onClick={() => navigate("/admin/subscriptions/records")}>
                            <FaArrowLeft /> Back to Payment Records
                        </button>
                        <div>
                            <h1 className="page-title">Free Assessment Submissions</h1>
                            <p className="page-description">Admin-only preview of all submitted free assessments</p>
                        </div>
                    </div>

                    <div className="assessment-admin-toolbar">
                        <div className="assessment-admin-search">
                            <FaSearch />
                            <input
                                type="text"
                                placeholder="Search by child name or parent info..."
                                value={search}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={`table-primary-container assessment-table-container ${tableLoading ? "assessment-table-container--loading" : ""}`}>
                        {tableLoading && (
                            <div className="assessment-table-loading-overlay">
                                <span className="assessment-table-loading-text">Updating results...</span>
                            </div>
                        )}
                        {items.length === 0 ? (
                            <div className="empty-state">
                                <p>No free assessment submissions found</p>
                            </div>
                        ) : (
                            <div className="table-primary-wrapper">
                                <table className="table-primary free-assessments-table">
                                    <thead className="table-primary-header">
                                        <tr>
                                            <th className="table-primary-th table-primary-th-id">ID</th>
                                            <th className="table-primary-th">Child Name</th>
                                            <th className="table-primary-th">Child Age</th>
                                            <th className="table-primary-th">Mother Contact</th>
                                            <th className="table-primary-th">Father Contact</th>
                                            <th className="table-primary-th">Date Submitted</th>
                                            <th className="table-primary-th table-primary-th-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="table-primary-body">
                                        {items.map((item) => (
                                            <tr key={item.id} className="table-primary-row">
                                                <td className="table-primary-td table-primary-td-id">{item.id}</td>
                                                <td className="table-primary-td">{item.child_name || "-"}</td>
                                                <td className="table-primary-td">{item.child_age || "-"}</td>
                                                <td className="table-primary-td">{item.mother_contact || "-"}</td>
                                                <td className="table-primary-td">{item.father_contact || "-"}</td>
                                                <td className="table-primary-td">{new Date(item.created_at).toLocaleDateString("en-IN")}</td>
                                                <td className="table-primary-td table-primary-td-center">
                                                    <div className="table-primary-actions">
                                                        <button className="table-primary-icon-btn" onClick={() => handlePreviewPdf(item)} title="Preview PDF">
                                                            <FaEye className="table-primary-icon-sm" />
                                                        </button>
                                                        <button className="table-primary-icon-btn" onClick={() => handleDownloadPdf(item)} title="Download PDF">
                                                            <FaDownload className="table-primary-icon-sm" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="pagination">
                        <button
                            className="pagination-btn"
                            disabled={pagination.skip === 0}
                            onClick={() => handlePageChange(Math.max(0, pagination.skip - pagination.limit))}
                        >
                            Previous
                        </button>
                        <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                        <button
                            className="pagination-btn"
                            disabled={pagination.skip + pagination.limit >= pagination.total}
                            onClick={() => handlePageChange(pagination.skip + pagination.limit)}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminFreeAssessments;
