// AssignedTrainingsList.jsx - View assigned trainings for regular users

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { BookOpen, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AssignedTrainingCard from "../../components/AssignedTrainingCard";
import assignedTrainingService from "../../api/services/assignedTrainingService";
import "../../styles/admin/AssignedTrainingsList.css";
import "../../styles/admin/AssignedTrainingsListAdditions.css";

const AssignedTrainingsList = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // List Management
    const [trainings, setTrainings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pagination, setPagination] = useState({ skip: 0, limit: 10, total: 0 });

    // Fetch trainings on mount and when pagination changes
    useEffect(() => {
        fetchTrainings();
    }, [pagination.skip]);

    const fetchTrainings = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await assignedTrainingService.getMyAssignedTrainings({
                skip: pagination.skip,
                limit: pagination.limit,
            });
            setTrainings(data.items || []);
            setPagination((prev) => ({ ...prev, total: data.total || 0 }));
        } catch (err) {
            console.error("Error fetching trainings:", err);
            setError("Failed to load your assigned trainings. Please try again.");
            toast.error("Failed to load trainings", {
                position: "top-center",
                autoClose: 3000,
            });
        } finally {
            setLoading(false);
        }
    };;



    return (
        <div className="page-container">
            <main className="page-main">
                <div className="page-content">
                    {/* Header */}
                    <div className="page-header">
                        <div>
                            <button
                            onClick={() => navigate("/admin/dashboard")}
                            className="back-button"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path d="M15 19l-7-7 7-7"></path>
                            </svg>
                            Back to Dashboard
                        </button>
                            <h1 className="page-title">Assigned Training</h1>
                            <p className="page-description">
                                View trainings assigned to you
                            </p>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="error-message">
                            <div className="error-message-content">
                                <AlertCircle className="icon-md error-icon" />
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading ? (
                        <div className="loading-container">
                            <Loader2 className="loading-spinner" />
                            <p className="loading-text">Loading your trainings...</p>
                        </div>
                    ) : (
                        <>
                            {/* Training Cards Grid */}
                            <div className="trainings-grid">
                                {trainings.length === 0 ? (
                                    <div className="empty-state">
                                        <BookOpen className="empty-state-icon" />
                                        <h3 className="empty-state-title">
                                            No trainings assigned yet
                                        </h3>
                                        <p className="empty-state-description">
                                            Check back later for new training assignments
                                        </p>
                                    </div>
                                ) : (
                                    trainings.map((training) => (
                                        <AssignedTrainingCard
                                            key={training.id}
                                            training={training}
                                            isAdmin={false}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Pagination */}
                            {trainings.length > 0 && (
                                <div className="pagination-section">
                                    <button
                                        disabled={pagination.skip === 0}
                                        onClick={() =>
                                            setPagination((prev) => ({
                                                ...prev,
                                                skip: Math.max(0, prev.skip - prev.limit),
                                            }))
                                        }
                                        className="pagination-btn"
                                    >
                                        Previous
                                    </button>
                                    <span className="pagination-info">
                                        Showing {pagination.skip + 1} to{" "}
                                        {Math.min(
                                            pagination.skip + pagination.limit,
                                            pagination.total
                                        )}{" "}
                                        of {pagination.total}
                                    </span>
                                    <button
                                        disabled={
                                            pagination.skip + pagination.limit >= pagination.total
                                        }
                                        onClick={() =>
                                            setPagination((prev) => ({
                                                ...prev,
                                                skip: prev.skip + prev.limit,
                                            }))
                                        }
                                        className="pagination-btn"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AssignedTrainingsList;
