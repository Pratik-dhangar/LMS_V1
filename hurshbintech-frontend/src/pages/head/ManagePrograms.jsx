import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import programService from '../../api/services/programService';
import headService from '../../api/services/headService';
import '../../styles/ManageUsersLayout.css';
import '../../styles/Table.css';

const ManagePrograms = () => {
    const navigate = useNavigate();
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [learnerNameById, setLearnerNameById] = useState({});

    useEffect(() => {
        fetchPrograms();
    }, []);

    const fetchPrograms = async () => {
        try {
            setLoading(true);
            const [programsResult, learnersResult] = await Promise.allSettled([
                programService.getPrograms(),
                headService.getLearnersForSessionScheduling(),
            ]);

            if (programsResult.status !== 'fulfilled') {
                throw programsResult.reason;
            }

            setPrograms(programsResult.value || []);

            if (learnersResult.status === 'fulfilled') {
                const learnerMap = {};
                (learnersResult.value || []).forEach((learner) => {
                    if (learner?.id != null && learner?.name) {
                        learnerMap[String(learner.id)] = String(learner.name);
                    }
                });
                setLearnerNameById(learnerMap);
            } else {
                setLearnerNameById({});
            }
        } catch (error) {
            toast.error('Failed to load programs');
        } finally {
            setLoading(false);
        }
    };

    const getProgramLearnerName = (program) => {
        const directName =
            program?.learner_name ||
            program?.learnerName ||
            program?.learner?.name ||
            program?.user?.name;

        if (directName && String(directName).trim()) {
            return String(directName).trim();
        }

        const learnerId = program?.learner_id ?? program?.learnerId;
        if (learnerId == null) {
            return '';
        }

        return learnerNameById[String(learnerId)] || '';
    };

    const filteredPrograms = programs.filter(
        (program) => {
            const normalizedSearch = searchTerm.toLowerCase();
            const learnerName = getProgramLearnerName(program);
            return (
                program.name?.toLowerCase().includes(normalizedSearch) ||
                (program.skill || program.description || '').toLowerCase().includes(normalizedSearch) ||
                learnerName.toLowerCase().includes(normalizedSearch)
            );
        }
    );

    const handleEdit = (programId) => {
        navigate(`/head/edit-program/${programId}`);
    };

    const handleDelete = async (programId, programName) => {
        if (window.confirm(`Are you sure you want to delete the program "${programName}"?`)) {
            try {
                setDeletingId(programId);
                await programService.deleteProgram(programId);
                toast.success(`Program "${programName}" deleted successfully`);
                setPrograms(programs.filter((p) => p.id !== programId));
            } catch (error) {
                toast.error(
                    error.response?.data?.detail || 'Failed to delete program'
                );
            } finally {
                setDeletingId(null);
            }
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-main">
                <div className="page-content">
                    <div className="page-header">
                        <button
                            onClick={() => navigate('/head/manage-sessions')}
                            className="back-button"
                        >
                            <svg
                                className="back-icon"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path d="M15 19l-7-7 7-7"></path>
                            </svg>
                            Back to Manage Sessions
                        </button>
                        <div>
                            <h1 className="page-title">Manage Programs</h1>
                            <p className="page-description">
                                View, edit, and delete your created programs
                            </p>
                        </div>
                    </div>

                    <div className="modern-form-card">
                        <div className="modern-form-section">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1, marginRight: '1rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Search programs by name, description, or learner..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="modern-form-input"
                                    />
                                </div>
                                <button
                                    onClick={() => navigate('/head/create-new-program')}
                                    className="modern-form-btn modern-form-btn-primary"
                                >
                                    Create New Program
                                </button>
                            </div>

                            {filteredPrograms.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                                    <p style={{ marginBottom: '1rem' }}>
                                        {programs.length === 0
                                            ? 'No programs created yet'
                                            : 'No programs match your search'}
                                    </p>
                                    {programs.length === 0 && (
                                        <button
                                            onClick={() => navigate('/head/create-new-program')}
                                            className="modern-form-btn modern-form-btn-primary"
                                        >
                                            Create Your First Program
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="table-primary-container">
                                    <div className="table-primary-wrapper">
                                        <table className="table-primary">
                                            <thead className="table-primary-header">
                                                <tr>
                                                    <th className="table-primary-th">Program Name</th>
                                                    <th className="table-primary-th">Learning Skill</th>
                                                    <th className="table-primary-th">Learner Name </th>
                                                    <th className="table-primary-th" style={{ textAlign: 'center' }}>Learning Goals</th>
                                                    <th className="table-primary-th" style={{ textAlign: 'center' }}>Learning Content</th>
                                                    <th className="table-primary-th" style={{ textAlign: 'center', width: '120px' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="table-primary-body">
                                                {filteredPrograms.map((program) => (
                                                    <tr key={program.id}>
                                                        <td className="table-primary-td">
                                                            <span style={{ fontWeight: 600, color: '#1f2937' }}>
                                                                {program.name}
                                                            </span>
                                                        </td>
                                                        <td className="table-primary-td">
                                                            {program.skill || program.description || '-'}
                                                        </td>
                                                        <td className="table-primary-td">
                                                            {getProgramLearnerName(program) || '-'}
                                                        </td>
                                                        <td className="table-primary-td" style={{ textAlign: 'center' }}>
                                                            <span
                                                                style={{
                                                                    display: 'inline-block',
                                                                    padding: '0.25rem 0.75rem',
                                                                    backgroundColor: '#dbeafe',
                                                                    color: '#1e40af',
                                                                    borderRadius: '0.25rem',
                                                                    fontSize: '0.875rem',
                                                                    fontWeight: 500,
                                                                }}
                                                            >
                                                                {(program.goal_ids || []).length}
                                                            </span>
                                                        </td>
                                                        <td className="table-primary-td" style={{ textAlign: 'center' }}>
                                                            <span
                                                                style={{
                                                                    display: 'inline-block',
                                                                    padding: '0.25rem 0.75rem',
                                                                    backgroundColor: '#dcfce7',
                                                                    color: '#166534',
                                                                    borderRadius: '0.25rem',
                                                                    fontSize: '0.875rem',
                                                                    fontWeight: 500,
                                                                }}
                                                            >
                                                                {(program.content_ids || []).length}
                                                            </span>
                                                        </td>
                                                        <td className="table-primary-td" style={{ textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                                <button
                                                                    onClick={() => handleEdit(program.id)}
                                                                    className="action-btn action-btn-edit"
                                                                    title="Edit this program"
                                                                    style={{
                                                                        padding: '0.5rem',
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        color: '#059669',
                                                                        fontSize: '1.125rem',
                                                                    }}
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(program.id, program.name)}
                                                                    disabled={deletingId === program.id}
                                                                    className="action-btn action-btn-delete"
                                                                    title="Delete this program"
                                                                    style={{
                                                                        padding: '0.5rem',
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: deletingId === program.id ? 'not-allowed' : 'pointer',
                                                                        color: '#dc2626',
                                                                        fontSize: '1.125rem',
                                                                        opacity: deletingId === program.id ? 0.5 : 1,
                                                                    }}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagePrograms;
