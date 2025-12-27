import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import Loader from '../../components/common/Loader';
import RichTextEditor from '../../components/RichTextEditor';
import { FaSave, FaTimes, FaImage, FaGlobe } from 'react-icons/fa';
import aboutUsService from '../../api/services/aboutUsService';

const AdminAboutUs = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [aboutUsId, setAboutUsId] = useState(null);
    const [activeTab, setActiveTab] = useState('hero');

    const [formData, setFormData] = useState({
        language_code: 'en',
        is_active: true,
        hero_title: '',
        hero_subtitle: '',
        intro_title: 'Who We Are',
        intro_content: '',
        mission_title: 'Our Mission',
        mission_content: '',
        vision_title: 'Our Vision',
        vision_content: '',
        programs_title: 'What We Teach',
        programs_content: '',
        methodology_title: 'How We Teach',
        methodology_content: '',
        why_us_title: 'Why Choose Us',
        why_us_content: '',
        team_title: 'Our Educators',
        team_content: '',
        learner_focus_title: 'Learner & Parent Focus',
        learner_focus_content: '',
        values_title: 'Our Values',
        values_content: '',
        commitment_title: 'Our Commitment',
        commitment_content: '',
        status: 'draft',
    });

    const [featuredImage, setFeaturedImage] = useState(null);
    const [featuredImagePreview, setFeaturedImagePreview] = useState(null);

    useEffect(() => {
        fetchAboutUs();
    }, []);

    const fetchAboutUs = async () => {
        try {
            setLoading(true);
            const aboutUs = await aboutUsService.getAdminAboutUs('en');
            if (aboutUs) {
                setAboutUsId(aboutUs.id);
                setFormData({
                    language_code: aboutUs.language_code,
                    is_active: aboutUs.is_active,
                    hero_title: aboutUs.hero_title || '',
                    hero_subtitle: aboutUs.hero_subtitle || '',
                    intro_title: aboutUs.intro_title || 'Who We Are',
                    intro_content: aboutUs.intro_content || '',
                    mission_title: aboutUs.mission_title || 'Our Mission',
                    mission_content: aboutUs.mission_content || '',
                    vision_title: aboutUs.vision_title || 'Our Vision',
                    vision_content: aboutUs.vision_content || '',
                    programs_title: aboutUs.programs_title || 'What We Teach',
                    programs_content: aboutUs.programs_content || '',
                    methodology_title: aboutUs.methodology_title || 'How We Teach',
                    methodology_content: aboutUs.methodology_content || '',
                    why_us_title: aboutUs.why_us_title || 'Why Choose Us',
                    why_us_content: aboutUs.why_us_content || '',
                    team_title: aboutUs.team_title || 'Our Educators',
                    team_content: aboutUs.team_content || '',
                    learner_focus_title: aboutUs.learner_focus_title || 'Learner & Parent Focus',
                    learner_focus_content: aboutUs.learner_focus_content || '',
                    values_title: aboutUs.values_title || 'Our Values',
                    values_content: aboutUs.values_content || '',
                    commitment_title: aboutUs.commitment_title || 'Our Commitment',
                    commitment_content: aboutUs.commitment_content || '',
                    status: aboutUs.status,
                });
                if (aboutUs.featured_image_url) {
                    setFeaturedImagePreview(aboutUs.featured_image_url);
                }
            }
        } catch (err) {
            // If no About Us page exists yet, that's okay - we'll create one
            if (err.response?.status === 404) {
                console.log('No About Us page exists yet. Ready to create one.');
            } else {
                console.error('Error fetching About Us:', err);
                toast.error('Failed to fetch About Us page');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleContentChange = (field, html) => {
        setFormData((prev) => ({ ...prev, [field]: html }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                toast.error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                toast.error('File size too large. Maximum size is 5MB.');
                return;
            }

            setFeaturedImage(file);

            const reader = new FileReader();
            reader.onloadend = () => {
                setFeaturedImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = async () => {
        try {
            // If there's an aboutUsId, delete from server first
            if (aboutUsId) {
                await aboutUsService.deleteFeaturedImage(aboutUsId);
                
            }
            // Clear local state
            setFeaturedImage(null);
            setFeaturedImagePreview(null);
        } catch (err) {
            console.error('Error deleting featured image:', err);
            toast.error(err.response?.data?.detail || 'Failed to delete featured image');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setSaving(true);

            const formDataToSend = new FormData();

            // Append all form fields
            Object.keys(formData).forEach(key => {
                if (formData[key] !== null && formData[key] !== undefined) {
                    formDataToSend.append(key, formData[key]);
                }
            });

            if (featuredImage) {
                formDataToSend.append('featured_image', featuredImage);
            }

            if (aboutUsId) {
                await aboutUsService.updateAboutUs(aboutUsId, formDataToSend);
                toast.success('About Us page updated successfully');
            } else {
                const result = await aboutUsService.createAboutUs(formDataToSend);
                setAboutUsId(result.id);
                toast.success('About Us page created successfully');
            }

            // Refresh data
            await fetchAboutUs();

        } catch (err) {
            console.error('Error saving About Us:', err);
            toast.error(err.response?.data?.detail || 'Failed to save About Us page');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'hero', label: 'Hero Section', icon: '🏆' },
        { id: 'intro', label: 'Introduction', icon: '👋' },
        { id: 'mission', label: 'Mission', icon: '🎯' },
        { id: 'vision', label: 'Vision', icon: '🔭' },
        { id: 'programs', label: 'Programs', icon: '📚' },
        { id: 'methodology', label: 'Methodology', icon: '🎓' },
        { id: 'why_us', label: 'Why Us', icon: '⭐' },
        { id: 'team', label: 'Team', icon: '👥' },
        { id: 'learner_focus', label: 'Learner Focus', icon: '🎪' },
        { id: 'values', label: 'Values', icon: '💎' },
        { id: 'commitment', label: 'Commitment', icon: '🤝' },
    ];

    if (loading) {
        return (
            <div>
                <Loader />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex flex-col">
            <Navbar />

            <main className="flex-grow container mx-auto px-4 py-8 mt-20">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <div className="inline-block">
                            <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
                                {aboutUsId ? 'Edit About Us Page' : 'Create About Us Page'}
                            </h1>
                            <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-full"></div>
                        </div>
                        <p className="text-gray-600 mt-4 text-lg">
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Top Controls */}
                        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 backdrop-blur-lg bg-opacity-90">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                                <span className="w-2 h-8 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full mr-3"></span>
                                Page Settings
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Language */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                                        <FaGlobe className="inline mr-2 text-blue-600" />
                                        Language
                                    </label>
                                    <select
                                        name="language_code"
                                        value={formData.language_code}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm hover:border-blue-400"
                                    >
                                        <option value="en">🇬🇧 English</option>
                                        <option value="es">🇪🇸 Spanish</option>
                                        <option value="fr">🇫🇷 French</option>
                                    </select>
                                </div>

                                {/* Status */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                                        Status
                                    </label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm hover:border-blue-400"
                                    >
                                        <option value="draft">📝 Draft</option>
                                        <option value="published">✅ Published</option>
                                    </select>
                                </div>

                                {/* Active Toggle */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                                        Page Status
                                    </label>
                                    <label className="flex items-center cursor-pointer bg-gray-50 p-3 rounded-xl hover:bg-gray-100 transition-colors">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                name="is_active"
                                                checked={formData.is_active}
                                                onChange={handleChange}
                                                className="sr-only"
                                            />
                                            <div className={`w-14 h-8 rounded-full transition-colors ${formData.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <div className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform ${formData.is_active ? 'transform translate-x-6' : ''}`}></div>
                                        </div>
                                        <span className={`ml-3 text-sm font-medium ${formData.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                                            {formData.is_active ? '🟢 Active' : '🔴 Inactive'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Featured Image */}
                            <div className="mt-8">
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    <FaImage className="inline mr-2 text-blue-600" />
                                    Featured Hero Image
                                </label>

                                {featuredImagePreview ? (
                                    <div className="relative group">
                                        <div className="relative overflow-hidden rounded-2xl shadow-xl">
                                            <img
                                                src={featuredImagePreview}
                                                alt="Featured preview"
                                                className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={removeImage}
                                            className="absolute top-4 right-4 bg-red-500 text-white p-3 rounded-full hover:bg-red-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-110"
                                        >
                                            <FaTimes className="text-lg" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center w-full">
                                        <label className="flex flex-col items-center justify-center w-full h-48 border-3 border-blue-300 border-dashed rounded-2xl cursor-pointer bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 shadow-inner">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <div className="w-16 h-16 mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <FaImage className="w-8 h-8 text-blue-600" />
                                                </div>
                                                <p className="mb-2 text-base text-gray-700">
                                                    <span className="font-bold text-blue-600">Click to upload</span> or drag and drop
                                                </p>
                                                <p className="text-sm text-gray-500">PNG, JPG, WebP (MAX. 5MB)</p>
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabbed Content Editor */}
                        <div className="mt-8 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                            {/* Tab Navigation */}
                            <div className="border-b-2 border-gray-200 overflow-x-auto bg-gradient-to-r from-gray-50 via-blue-50 to-indigo-50">
                                <div className="flex p-2 space-x-2 scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-gray-100">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl whitespace-nowrap transition-all duration-300 transform ${activeTab === tab.id
                                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105'
                                                : 'text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-md hover:scale-102'
                                                }`}
                                        >
                                            <span className="text-xl">{tab.icon}</span>
                                            <span>{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div className="p-8 bg-gradient-to-br from-white to-gray-50">
                                {/* Hero Section */}
                                {activeTab === 'hero' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-blue-600">✨</span>
                                                Hero Title
                                            </label>
                                            <input
                                                type="text"
                                                name="hero_title"
                                                value={formData.hero_title}
                                                onChange={handleChange}
                                                placeholder="e.g., Empowering Learners Worldwide"
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-indigo-600">💬</span>
                                                Hero Subtitle
                                            </label>
                                            <textarea
                                                name="hero_subtitle"
                                                value={formData.hero_subtitle}
                                                onChange={handleChange}
                                                rows={3}
                                                placeholder="e.g., Quality education through technology and expert guidance"
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Introduction */}
                                {activeTab === 'intro' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-blue-600">📌</span>
                                                Section Title
                                            </label>
                                            <input
                                                type="text"
                                                name="intro_title"
                                                value={formData.intro_title}
                                                onChange={handleChange}
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-indigo-600">✍️</span>
                                                Content
                                            </label>
                                            <RichTextEditor
                                                value={formData.intro_content}
                                                onChange={(html) => handleContentChange('intro_content', html)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Mission */}
                                {activeTab === 'mission' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-blue-600">📌</span>
                                                Section Title
                                            </label>
                                            <input
                                                type="text"
                                                name="mission_title"
                                                value={formData.mission_title}
                                                onChange={handleChange}
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-indigo-600">✍️</span>
                                                Content
                                            </label>
                                            <RichTextEditor
                                                value={formData.mission_content}
                                                onChange={(html) => handleContentChange('mission_content', html)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Vision */}
                                {activeTab === 'vision' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-blue-600">📌</span>
                                                Section Title
                                            </label>
                                            <input
                                                type="text"
                                                name="vision_title"
                                                value={formData.vision_title}
                                                onChange={handleChange}
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-indigo-600">✍️</span>
                                                Content
                                            </label>
                                            <RichTextEditor
                                                value={formData.vision_content}
                                                onChange={(html) => handleContentChange('vision_content', html)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Programs */}
                                {activeTab === 'programs' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-blue-600">📌</span>
                                                Section Title
                                            </label>
                                            <input
                                                type="text"
                                                name="programs_title"
                                                value={formData.programs_title}
                                                onChange={handleChange}
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-indigo-600">✍️</span>
                                                Content
                                            </label>
                                            <RichTextEditor
                                                value={formData.programs_content}
                                                onChange={(html) => handleContentChange('programs_content', html)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Methodology */}
                                {activeTab === 'methodology' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-blue-600">📌</span>
                                                Section Title
                                            </label>
                                            <input
                                                type="text"
                                                name="methodology_title"
                                                value={formData.methodology_title}
                                                onChange={handleChange}
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-indigo-600">✍️</span>
                                                Content
                                            </label>
                                            <RichTextEditor
                                                value={formData.methodology_content}
                                                onChange={(html) => handleContentChange('methodology_content', html)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Why Us */}
                                {activeTab === 'why_us' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-blue-600">📌</span>
                                                Section Title
                                            </label>
                                            <input
                                                type="text"
                                                name="why_us_title"
                                                value={formData.why_us_title}
                                                onChange={handleChange}
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-indigo-600">✍️</span>
                                                Content
                                            </label>
                                            <RichTextEditor
                                                value={formData.why_us_content}
                                                onChange={(html) => handleContentChange('why_us_content', html)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Team */}
                                {activeTab === 'team' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-blue-600">📌</span>
                                                Section Title
                                            </label>
                                            <input
                                                type="text"
                                                name="team_title"
                                                value={formData.team_title}
                                                onChange={handleChange}
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-indigo-600">✍️</span>
                                                Content
                                            </label>
                                            <RichTextEditor
                                                value={formData.team_content}
                                                onChange={(html) => handleContentChange('team_content', html)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Learner Focus */}
                                {activeTab === 'learner_focus' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-blue-600">📌</span>
                                                Section Title
                                            </label>
                                            <input
                                                type="text"
                                                name="learner_focus_title"
                                                value={formData.learner_focus_title}
                                                onChange={handleChange}
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-indigo-600">✍️</span>
                                                Content
                                            </label>
                                            <RichTextEditor
                                                value={formData.learner_focus_content}
                                                onChange={(html) => handleContentChange('learner_focus_content', html)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Values */}
                                {activeTab === 'values' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-blue-600">📌</span>
                                                Section Title
                                            </label>
                                            <input
                                                type="text"
                                                name="values_title"
                                                value={formData.values_title}
                                                onChange={handleChange}
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-indigo-600">✍️</span>
                                                Content
                                            </label>
                                            <RichTextEditor
                                                value={formData.values_content}
                                                onChange={(html) => handleContentChange('values_content', html)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Commitment */}
                                {activeTab === 'commitment' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-blue-600">📌</span>
                                                Section Title
                                            </label>
                                            <input
                                                type="text"
                                                name="commitment_title"
                                                value={formData.commitment_title}
                                                onChange={handleChange}
                                                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                                            />
                                        </div>
                                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-indigo-600">✍️</span>
                                                Content
                                            </label>
                                            <RichTextEditor
                                                value={formData.commitment_content}
                                                onChange={(html) => handleContentChange('commitment_content', html)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-10 flex flex-col sm:flex-row justify-end gap-4">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/dashboard')}
                                className="px-8 py-4 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-300 flex items-center justify-center font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
                            >
                                <FaTimes className="mr-2 text-xl" />
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 flex items-center justify-center font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-3 border-white mr-3"></div>
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaSave className="mr-2 text-xl" />
                                        <span>Save About Us</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default AdminAboutUs;
