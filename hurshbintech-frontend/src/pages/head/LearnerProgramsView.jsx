import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionReportService from '../../api/services/sessionReportService';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import '../../styles/Pages.css';

const LearnerProgramsView = () => {
    const { learnerId } = useParams();
    const navigate = useNavigate();
    const [programs, setPrograms] = useState([]);
    const [learnerName, setLearnerName] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchLearnerPrograms();
    }, [learnerId]);

    const fetchLearnerPrograms = async () => {
        try {
            setLoading(true);

            // Fetch programs for this learner
            const programsData = await sessionReportService.getLearnerPrograms(parseInt(learnerId));
            setPrograms(programsData);

            // Fetch learner info
            const learners = await sessionReportService.getUniqueLearners();
            const learner = learners.find(l => l.learner_id === parseInt(learnerId));
            if (learner) {
                setLearnerName(learner.learner_name);
            }
        } catch (error) {
            console.error('Error fetching learner programs:', error);
            toast.error('Failed to load programs');
        } finally {
            setLoading(false);
        }
    };

    const handleProgramClick = (programName) => {
        navigate(`/head/learner/${learnerId}/program/${encodeURIComponent(programName)}`);
    };

    const filteredPrograms = programs.filter(program =>
        program.program_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="page-container">
            <Navbar />
            <div className="page-main">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">📚 Programs & Goals</h1>
                        <p className="page-description">
                            {learnerName && `${learnerName}'s Learning Programs`}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/head/reports')}
                        className="btn-secondary"
                    >
                        ← Back to Learners
                    </button>
                </div>

                {/* Search Bar */}
                <div className="search-section">
                    <input
                        type="text"
                        placeholder="🔍 Search programs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p className="loading-text">Loading programs...</p>
                    </div>
                )}

                {/* Empty State */}
                {!loading && filteredPrograms.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <p className="empty-state-description">
                            {searchTerm ? 'No programs found matching your search' : 'No programs found for this learner'}
                        </p>
                    </div>
                )}

                {/* Programs Grid */}
                {!loading && filteredPrograms.length > 0 && (
                    <div className="report-cards-grid">
                        {filteredPrograms.map((program, index) => (
                            <div
                                key={index}
                                onClick={() => handleProgramClick(program.program_name)}
                                className="report-card report-card-active"
                            >
                                {/* Program Header */}
                                <div className="report-card-header">
                                    <div className="report-card-avatar report-card-avatar-active">
                                        📚
                                    </div>
                                    <div className="report-card-info">
                                        <h3 className="report-card-name">{program.program_name}</h3>
                                        {program.program_id && (
                                            <p className="report-card-iip">ID: {program.program_id}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="report-stats">
                                    <div className="report-stat-box">
                                        <div className="report-stat-value report-stat-sessions">
                                            {program.total_sessions}
                                        </div>
                                        <div className="report-stat-label">Sessions</div>
                                    </div>
                                </div>

                                {/* Last Session */}
                                {program.last_session_date && (
                                    <div className="report-card-meta">
                                        <span className="report-meta-label">Last Session:</span>{' '}
                                        {new Date(program.last_session_date).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </div>
                                )}

                                {/* View Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleProgramClick(program.program_name);
                                    }}
                                    className="report-view-button report-view-button-active"
                                >
                                    View Graph →
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
};

export default LearnerProgramsView;
