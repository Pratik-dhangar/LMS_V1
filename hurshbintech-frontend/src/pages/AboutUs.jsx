import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import Loader from '../components/common/Loader';
import aboutUsService from '../api/services/aboutUsService';
import DOMPurify from 'dompurify';

const AboutUs = () => {
    const [loading, setLoading] = useState(true);
    const [aboutUs, setAboutUs] = useState(null);
    const [visibleSections, setVisibleSections] = useState(new Set());
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedSection, setSelectedSection] = useState(null);
    const sectionRefs = useRef({});
    const navigate = useNavigate();

    const fetchAboutUs = useCallback(async () => {
        try {
            setLoading(true);
            const data = await aboutUsService.getPublicAboutUs('en');
            setAboutUs(data);
        } catch (err) {
            // Silently handle 404 (no published content yet) - expected behavior
            if (err?.response?.status === 404) {
                setAboutUs(null);
            } else {
                // Only log and show toast for unexpected errors
                console.error('Error fetching About Us:', err);
                toast.error('Failed to load About Us page. Please try again later.');
                setAboutUs(null);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAboutUs();
    }, [fetchAboutUs]);

    useEffect(() => {
        if (!aboutUs) return;

        const observerOptions = {
            root: null,
            rootMargin: '50px',
            threshold: 0.15,
        };

        const observerCallback = (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setVisibleSections((prev) => new Set([...prev, entry.target.id]));
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);
        const currentRefs = Object.values(sectionRefs.current).filter(Boolean);

        currentRefs.forEach((ref) => observer.observe(ref));

        return () => {
            currentRefs.forEach((ref) => observer.unobserve(ref));
        };
    }, [aboutUs]);

    const sanitizeHTML = useCallback((html) => {
        return { __html: DOMPurify.sanitize(html) };
    }, []);

    const openModal = useCallback((section) => {
        setSelectedSection(section);
        setModalOpen(true);
        document.body.style.overflow = 'hidden';
    }, []);

    const closeModal = useCallback(() => {
        setModalOpen(false);
        setSelectedSection(null);
        document.body.style.overflow = 'unset';
    }, []);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && modalOpen) {
                closeModal();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [modalOpen, closeModal]);

    const sections = useMemo(() => {
        if (!aboutUs) return [];

        return [
            { id: 'intro', title: aboutUs.intro_title, content: aboutUs.intro_content, icon: '👋' },
            { id: 'mission', title: aboutUs.mission_title, content: aboutUs.mission_content, icon: '🎯' },
            { id: 'vision', title: aboutUs.vision_title, content: aboutUs.vision_content, icon: '🔭' },
            { id: 'programs', title: aboutUs.programs_title, content: aboutUs.programs_content, icon: '📚' },
            { id: 'methodology', title: aboutUs.methodology_title, content: aboutUs.methodology_content, icon: '🎓' },
            { id: 'why_us', title: aboutUs.why_us_title, content: aboutUs.why_us_content, icon: '⭐' },
            { id: 'team', title: aboutUs.team_title, content: aboutUs.team_content, icon: '👥' },
            { id: 'learner_focus', title: aboutUs.learner_focus_title, content: aboutUs.learner_focus_content, icon: '🎪' },
            { id: 'values', title: aboutUs.values_title, content: aboutUs.values_content, icon: '💎' },
            { id: 'commitment', title: aboutUs.commitment_title, content: aboutUs.commitment_content, icon: '🤝' },
        ].filter(section => section.content?.trim() && section.content !== '<p></p>');
    }, [aboutUs]);

    const whyUsFeatures = useMemo(() => {
        if (!aboutUs) return [];

        return [
            { title: aboutUs.mission_title, content: aboutUs.mission_content, icon: '🎯' },
            { title: aboutUs.vision_title, content: aboutUs.vision_content, icon: '🔭' },
            { title: aboutUs.programs_title, content: aboutUs.programs_content, icon: '📚' },
            { title: aboutUs.methodology_title, content: aboutUs.methodology_content, icon: '🎓' },
            { title: aboutUs.learner_focus_title, content: aboutUs.learner_focus_content, icon: '🎪' },
            { title: aboutUs.values_title, content: aboutUs.values_content, icon: '💎' },
        ].filter(item => item.content?.trim() && item.content !== '<p></p>');
    }, [aboutUs]);

    // if (loading) {
    //     return (
    //         <div className="min-h-full w-full bg-gray-50 flex ">
    //             <Loader />
    //         </div>
    //     );
    // }

    if (!aboutUs) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-white flex flex-col">
                <Navbar />
                <main className="flex-grow flex items-center justify-center px-4">
                    <div className="text-center max-w-2xl mx-auto">
                        <div className="mb-8">
                            <div className="w-24 h-24 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">About Us Page Coming Soon</h1>
                            <p className="text-lg text-gray-600 mb-8">We're currently setting up our About Us page. Please check back soon!</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => navigate('/')}
                                className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                            >
                                Go to Home
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-8 py-4 bg-white text-gray-700 font-bold rounded-xl border-2 border-gray-300 hover:border-amber-500 transition-all duration-300 shadow-md hover:shadow-lg"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-white flex flex-col overflow-x-hidden">
            <Navbar />

            {/* Hero Section with Background Image */}
            <section className="relative w-full h-64 md:h-96 overflow-hidden mt-2" aria-label="Hero banner">
                {aboutUs.featured_image_url ? (
                    <>
                        <img
                            src={aboutUs.featured_image_url}
                            alt="About Us Hero"
                            loading="eager"
                            className="absolute inset-0 w-full h-full object-cover transform transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-amber-900/50 to-amber-800/60" aria-hidden="true"></div>
                    </>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-600 via-amber-700 to-orange-700" aria-hidden="true"></div>
                )}

                <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col items-center justify-center text-center">
                    <h1 className="text-2xl sm:text-3xl md:text-6xl lg:text-7xl font-black text-white tracking-tight uppercase mb-4 drop-shadow-2xl animate-fade-in">
                        {aboutUs.hero_title || 'About Us'}
                    </h1>
                    {aboutUs.hero_subtitle && (
                        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 font-medium max-w-3xl drop-shadow-lg px-4">
                            {aboutUs.hero_subtitle}
                        </p>
                    )}
                </div>
            </section>

            {/* Main Content */}
            <main className="flex-grow w-full">
                {/* Introduction Section */}
                {aboutUs.intro_content && (
                    <section className="w-full bg-gradient-to-b from-white to-gray-50 py-12 md:py-20" aria-labelledby="intro-heading">
                        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="max-w-5xl mx-auto text-center w-full">
                                {aboutUs.intro_title && (
                                    <div className="mb-6 md:mb-8">
                                        <div className="inline-block">
                                            <h2 id="intro-heading" className="text-2xl md:text-3xl lg:text-4xl font-black text-gray-900 mb-3 uppercase tracking-tight">
                                                {aboutUs.intro_title}
                                            </h2>
                                            <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-full"></div>
                                        </div>
                                    </div>
                                )}
                                <div
                                    className="prose prose-base md:prose-lg lg:prose-xl max-w-none text-gray-700 leading-relaxed mx-auto prose-headings:text-gray-900 prose-p:text-gray-600 w-full"
                                    dangerouslySetInnerHTML={sanitizeHTML(aboutUs.intro_content)}
                                />
                            </div>
                        </div>
                    </section>
                )}

                {/* Team Roles Grid Section - Numbered Badges */}
                {sections.length > 0 && (
                    <section className="w-full bg-gradient-to-b from-gray-50 to-white py-12 md:py-20" aria-labelledby="team-heading">
                        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="max-w-7xl mx-auto w-full">
                                <div className="text-center mb-8 md:mb-12">
                                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-gray-900 mb-3 uppercase">
                                        Our Services & Expertise
                                    </h2>
                                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                                        Discover what makes us unique
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                                    {sections.slice(0, 8).map((section, index) => (
                                        <article
                                            key={section.id}
                                            ref={(el) => (sectionRefs.current[section.id] = el)}
                                            id={section.id}
                                            className={`transition-all duration-700 ease-out ${visibleSections.has(section.id)
                                                ? 'opacity-100 translate-y-0'
                                                : 'opacity-0 translate-y-10'
                                                }`}
                                        >
                                            <button
                                                onClick={() => openModal(section)}
                                                className="relative h-full w-full group focus:outline-none focus:ring-4 focus:ring-amber-400 rounded-2xl"
                                                aria-label={`View details about ${section.title}`}
                                            >
                                                <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 rounded-2xl shadow-xl p-8 text-center relative overflow-hidden group-hover:shadow-2xl group-hover:scale-110 group-hover:-rotate-1 transition-all duration-500 h-full flex flex-col justify-center cursor-pointer border-2 border-amber-400/50">
                                                    <div className="absolute -top-3 -right-3 bg-white text-amber-700 rounded-full w-14 h-14 flex items-center justify-center font-black text-2xl shadow-2xl z-10 border-4 border-amber-500 group-hover:scale-125 transition-transform duration-300">
                                                        {index + 1}
                                                    </div>

                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                                    <div className="text-6xl mb-4 group-hover:scale-125 transition-transform duration-300" aria-hidden="true">{section.icon}</div>

                                                    <h3 className="text-base md:text-lg font-black text-white uppercase tracking-wide relative z-10">
                                                        {section.title}
                                                    </h3>

                                                    <div className="mt-4 text-sm text-white/90 font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                                        📖 Click to learn more
                                                    </div>
                                                </div>
                                            </button>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Why Choose Us Section - Orange Background */}
                {aboutUs.why_us_content && (
                    <section className="relative w-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 py-16 md:py-24 overflow-hidden" aria-labelledby="why-us-heading">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0aDRjMCAxLjMxLS44OSAyLjM5LTIgMi43MlYxOGgtLjg5QTMuMDAzIDMuMDAzIDAgMCAxIDM2IDE2di0yem00LTJoLTR2Mmgydi0yem0wIDRoLTR2Mmgydi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>
                        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                            <div className="max-w-6xl mx-auto w-full">
                                <div className="text-center mb-12 md:mb-16">
                                    <h2 id="why-us-heading" className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-white mb-4 drop-shadow-lg">
                                        {aboutUs.why_us_title}
                                    </h2>
                                    <div className="w-32 h-1.5 bg-white rounded-full mx-auto"></div>
                                </div>

                                {whyUsFeatures.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                                        {whyUsFeatures.map((item, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => openModal(item)}
                                                className="text-center group cursor-pointer focus:outline-none focus:ring-4 focus:ring-white/50 rounded-2xl p-4 transition-all duration-300"
                                                aria-label={`View details about ${item.title}`}
                                            >
                                                <div className="inline-flex items-center justify-center w-28 h-28 bg-white rounded-full shadow-2xl mb-6 group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 border-4 border-amber-200" aria-hidden="true">
                                                    <span className="text-5xl group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                                                </div>

                                                <h3 className="text-xl font-black text-white mb-2 drop-shadow-md group-hover:scale-105 transition-transform duration-300">
                                                    {item.title}
                                                </h3>

                                                <div className="text-sm text-white/90 font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                                    📖 Click to learn more
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Commitment Section */}
                {aboutUs.commitment_content && (
                    <section className="w-full bg-gradient-to-b from-white to-gray-50 py-12 md:py-20" aria-labelledby="commitment-heading">
                        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="max-w-5xl mx-auto w-full">
                                {aboutUs.commitment_title && (
                                    <div className="text-center mb-8 md:mb-12">
                                        <div className="inline-block">
                                            <h2 id="commitment-heading" className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black text-gray-900 mb-3 uppercase">
                                                {aboutUs.commitment_title}
                                            </h2>
                                            <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-full"></div>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 lg:p-12 border-2 border-amber-100 w-full">
                                    <div
                                        className="prose prose-base md:prose-lg lg:prose-xl max-w-none text-gray-700 leading-relaxed prose-headings:text-gray-900 prose-p:text-gray-600 prose-strong:text-amber-600 w-full"
                                        dangerouslySetInnerHTML={sanitizeHTML(aboutUs.commitment_content)}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            <Footer />

            {/* Modal for Section Details */}
            {modalOpen && selectedSection && (
                <div
                    className="fixed inset-0 z-50 overflow-y-auto animate-fade-in"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                >
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-gradient-to-br from-black/70 to-amber-900/40 backdrop-blur-md transition-opacity"
                        onClick={closeModal}
                        aria-hidden="true"
                    ></div>

                    {/* Modal Content */}
                    <div className="flex min-h-screen items-center justify-center p-4">
                        <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl transform transition-all animate-scale-in border-4 border-amber-200">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-t-3xl px-8 py-8 relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0aDRjMCAxLjMxLS44OSAyLjM5LTIgMi43MlYxOGgtLjg5QTMuMDAzIDMuMDAzIDAgMCAxIDM2IDE2di0yem00LTJoLTR2Mmgydi0yem0wIDRoLTR2Mmgydi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-20\"></div>
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-5\">
                                        <div className="bg-white rounded-full p-4 shadow-xl\">
                                            <span className="text-5xl\" aria-hidden="true">{selectedSection.icon}</span>
                                        </div>
                                        <div>
                                            <h2 id="modal-title" className="text-3xl md:text-4xl font-black text-white drop-shadow-lg">
                                                {selectedSection.title}
                                            </h2>
                                            <div className="h-1 bg-white/50 rounded-full mt-2 w-32\"></div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={closeModal}
                                        className="text-white hover:text-gray-200 transition-all p-3 hover:bg-white/20 rounded-full hover:rotate-90 duration-300"
                                        aria-label="Close modal"
                                    >
                                        <svg
                                            className="w-8 h-8"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            strokeWidth={3}
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="px-8 md:px-12 py-10 max-h-[65vh] overflow-y-auto custom-scrollbar bg-gradient-to-b from-white to-gray-50">
                                <div
                                    className="prose prose-xl max-w-none text-gray-700 leading-relaxed prose-headings:text-gray-900 prose-headings:font-black prose-p:text-gray-600 prose-strong:text-amber-600 prose-a:text-amber-600 prose-li:text-gray-600"
                                    dangerouslySetInnerHTML={sanitizeHTML(selectedSection.content)}
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-amber-50 rounded-b-3xl flex justify-end border-t-2 border-amber-100">
                                <button
                                    onClick={closeModal}
                                    className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 uppercase tracking-wide"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-in {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes scale-in {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }

                .animate-scale-in {
                    animation: scale-in 0.3s ease-out;
                }

                .custom-scrollbar::-webkit-scrollbar {
                    width: 10px;
                }

                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f3f4f6;
                    border-radius: 10px;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: linear-gradient(to bottom, #f59e0b, #f97316);
                    border-radius: 10px;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(to bottom, #d97706, #ea580c);
                }

                @media (prefers-reduced-motion: reduce) {
                    .animate-fade-in,
                    .animate-scale-in {
                        animation: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default AboutUs;
