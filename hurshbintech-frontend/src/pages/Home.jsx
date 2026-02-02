import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/common/Loader";
import aboutUsService from '../api/services/aboutUsService';
import blogService from '../api/services/blogService';
import vlogService from '../api/services/vlogService';
import DOMPurify from 'dompurify';
import '../styles/pages/Home.css';
import '../styles/pages/AboutUs.css';
import '../styles/components/common/Modal.css';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aboutUs, setAboutUs] = useState(null);
  const [blogs, setBlogs] = useState([]);
  const [vlogs, setVlogs] = useState([]);
  const [visibleSections, setVisibleSections] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const sectionRefs = useRef({});

  const fetchAboutUs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await aboutUsService.getPublicAboutUs('en');
      setAboutUs(data);
    } catch (err) {
      if (err?.response?.status !== 404) {
        console.error('Error fetching About Us:', err);
      }
      setAboutUs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBlogs = useCallback(async () => {
    try {
      const response = await blogService.getPublicBlogs({ page: 1, per_page: 3 });
      setBlogs(response.blogs || []);
    } catch (err) {
      console.error('Error fetching blogs:', err);
      setBlogs([]);
    }
  }, []);

  const fetchVlogs = useCallback(async () => {
    try {
      const response = await vlogService.getPublicVlogs({ page: 1, per_page: 3 });
      setVlogs(response.vlogs || []);
    } catch (err) {
      console.error('Error fetching vlogs:', err);
      setVlogs([]);
    }
  }, []);

  useEffect(() => {
    fetchAboutUs();
    fetchBlogs();
    fetchVlogs();
  }, [fetchAboutUs, fetchBlogs, fetchVlogs]);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercentage = (scrolled / windowHeight) * 100;
      setShowScrollTop(scrollPercentage > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    if (!aboutUs) {
      // Return default sections when no backend data is available
      return [
        { id: 'intro', title: 'Who We Are', content: 'Learn about our organization and mission.', icon: '👋' },
        { id: 'mission', title: 'Our Mission', content: 'Our mission is to provide quality services.', icon: '🎯' },
        { id: 'vision', title: 'Our Vision', content: 'Our vision for the future.', icon: '🔭' },
        { id: 'programs', title: 'What We Teach', content: 'Discover our educational programs.', icon: '📚' },
        { id: 'methodology', title: 'How We Teach', content: 'Our teaching methodology.', icon: '🎓' },
        { id: 'why_us', title: 'Why Choose Us', content: 'What makes us unique.', icon: '⭐' },
        { id: 'team', title: 'Our Educators', content: 'Meet our team of professionals.', icon: '👥' },
        { id: 'learner_focus', title: 'Learner & Parent Focus', content: 'Our commitment to learners and parents.', icon: '🎪' },
      ];
    }

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

  const handleBookAppointment = () => {
    navigate("/book-appointment");
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const truncateText = (text, length) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]*>/g, '');
    return stripped.length > length ? stripped.substring(0, length) + '...' : stripped;
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="home-hero">
        {/* Navigation Links */}
        <div className="hero-nav-links">
          <button onClick={() => scrollToSection('blogs-section')} className="hero-nav-link">
            Blogs
          </button>
          <span className="hero-nav-divider">|</span>
          <button onClick={() => scrollToSection('vlogs-section')} className="hero-nav-link">
            Vlogs
          </button>
          <span className="hero-nav-divider">|</span>
          <button onClick={() => scrollToSection('about-section')} className="hero-nav-link">
            About Us
          </button>
        </div>

        <h1 className="home-hero-title">WELCOME TO HURSHBIN CHILD DEVELOPMENT LEARNING & BEHAVIOUR SERVICES!</h1>
        <h2 className="home-hero-subtitle"> We stand with families having children facing delays & difficulties by creating optimum learning opportunities!</h2>
      </section>

      {/* Blogs Section */}
      {blogs.length > 0 && (
        <section id="blogs-section" className="home-blogs-section">
          <div className="home-blogs-container">
            <div className="home-section-header">
              <h2 className="home-section-title">Latest Blogs</h2>
              <p className="home-section-subtitle">Educational articles and insights</p>
            </div>
            <div className="home-blogs-grid">
              {blogs.map((blog, index) => (
                <article
                  key={blog.id}
                  className="home-blog-card"
                  onClick={() => navigate(`/blogs/${blog.slug}`)}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Featured Image */}
                  <div className="home-blog-image-wrapper">
                    {blog.featured_image_url ? (
                      <img
                        src={blog.featured_image_url}
                        alt={blog.title}
                        className="home-blog-image"
                      />
                    ) : (
                      <div className="home-blog-placeholder">📝</div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="home-blog-content">
                    <h3 className="home-blog-title">{blog.title}</h3>
                    {blog.excerpt && (
                      <p className="home-blog-excerpt">
                        {truncateText(blog.excerpt, 120)}
                      </p>
                    )}
                    <div className="home-blog-footer">
                      <span className="home-blog-date">
                        📅 {formatDate(blog.created_at)}
                      </span>
                      <span className="home-blog-read-more">Read more →</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="home-section-view-all">
              <button
                onClick={() => navigate('/blogs')}
                className="home-view-all-btn"
              >
                View All Blogs →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Vlogs Section */}
      {vlogs.length > 0 && (
        <section id="vlogs-section" className="home-vlogs-section">
          <div className="home-vlogs-container">
            <div className="home-section-header">
              <h2 className="home-section-title">Latest Vlogs</h2>
              <p className="home-section-subtitle">Video content and tutorials</p>
            </div>
            <div className="home-vlogs-grid">
              {vlogs.map((vlog, index) => (
                <article
                  key={vlog.id}
                  className="home-vlog-card"
                  onClick={() => navigate(`/vlogs/${vlog.id}`)}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Thumbnail */}
                  <div className="home-vlog-thumbnail-wrapper">
                    {vlog.thumbnail_url ? (
                      <img
                        src={vlog.thumbnail_url}
                        alt={vlog.title}
                        className="home-vlog-thumbnail"
                      />
                    ) : (
                      <div className="home-vlog-placeholder">🎥</div>
                    )}
                    <div className="home-vlog-play-icon">▶</div>
                  </div>

                  {/* Content */}
                  <div className="home-vlog-content">
                    <h3 className="home-vlog-title">{vlog.title}</h3>
                    {vlog.description && (
                      <p className="home-vlog-description">
                        {truncateText(vlog.description, 100)}
                      </p>
                    )}
                    <div className="home-vlog-footer">
                      <span className="home-vlog-date">
                        📅 {formatDate(vlog.created_at)}
                      </span>
                      <span className="home-vlog-watch">Watch now →</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="home-section-view-all">
              <button
                onClick={() => navigate('/vlogs')}
                className="home-view-all-btn"
              >
                View All Vlogs →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* About Us Content */}
      {loading ? (
        <div className="about-loading">
          <Loader />
        </div>
      ) : aboutUs ? (
        <main id="about-section" className="about-main">
          {/* Hero Section with Background Image */}
          <div className="home-section-header">
              <h2 className="home-section-title">About Us</h2>
            </div>
          <section className="about-hero-section" aria-label="Hero banner">
            {aboutUs.featured_image_url ? (
              <>
                <img
                  src={aboutUs.featured_image_url}
                  alt="About Us Hero"
                  loading="eager"
                  className="about-hero-image"
                />
                <div className="about-hero-overlay" aria-hidden="true"></div>
              </>
            ) : (
              <div className="about-hero-gradient" aria-hidden="true"></div>
            )}

            <div className="about-hero-content">
              <h1 className="about-hero-title">
                {aboutUs.hero_title || 'About Us'}
              </h1>
              {aboutUs.hero_subtitle && (
                <p className="about-hero-subtitle">
                  {aboutUs.hero_subtitle}
                </p>
              )}
            </div>
          </section>

          {/* Introduction Section */}
          {aboutUs.intro_content && (
            <section className="about-section" aria-labelledby="intro-heading">
              <div className="about-container">
                <div className="about-content-wrapper">
                  {aboutUs.intro_title && (
                    <div className="about-header-wrapper">
                      <div className="about-header-inner">
                        <h2 id="intro-heading" className="about-section-title">
                          {aboutUs.intro_title}
                        </h2>
                        <div className="about-title-divider"></div>
                      </div>
                    </div>
                  )}
                  <div
                    className="about-content-text"
                    dangerouslySetInnerHTML={sanitizeHTML(aboutUs.intro_content)}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Team Roles Grid Section - Numbered Badges */}
          {sections.length > 0 && (
            <section className="services-section-wrapper" aria-labelledby="team-heading">
              <div className="services-section-inner">
                <div className="services-section-content">
                  <div className="services-section-header">
                    <h2 className="services-section-heading">
                      Our Services & Expertise
                    </h2>
                    <p className="services-section-description">
                      Discover what makes us unique
                    </p>
                  </div>
                  <div className="services-cards-grid">
                    {sections.slice(0, 8).map((section, index) => (
                      <article
                        key={section.id}
                        ref={(el) => (sectionRefs.current[section.id] = el)}
                        id={section.id}
                        className={`service-card-article ${visibleSections.has(section.id) ? 'visible' : ''}`}
                      >
                        <button
                          onClick={() => openModal(section)}
                          className="service-card-button"
                          aria-label={`View details about ${section.title}`}
                        >
                          <div className="service-card-inner-box">
                            <div className="service-card-badge">
                              {index + 1}
                            </div>

                            <div className="service-card-overlay"></div>

                            <div className="service-card-emoji" aria-hidden="true">{section.icon}</div>

                            <h3 className="service-card-heading">
                              {section.title}
                            </h3>

                            <div className="service-card-learn-more">
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

          {/* Commitment Section */}
          {aboutUs.commitment_content && (
            <section className="commitment-section" aria-labelledby="commitment-heading">
              <div className="commitment-container">
                <div className="commitment-wrapper">
                  {aboutUs.commitment_title && (
                    <div className="commitment-header">
                      <div className="about-header-inner">
                        <h2 id="commitment-heading" className="about-commitment-title">
                          {aboutUs.commitment_title}
                        </h2>
                        <div className="about-title-divider"></div>
                      </div>
                    </div>
                  )}
                  <div className="commitment-content-box">
                    <div
                      className="about-content-text"
                      dangerouslySetInnerHTML={sanitizeHTML(aboutUs.commitment_content)}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      ) : null}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="scroll-to-top-btn"
          aria-label="Scroll to top"
        >
          ↑
        </button>
      )}

      {/* Modal for Section Details */}
      {modalOpen && selectedSection && (
        <div
          className="app-modal-overlay"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="app-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="app-modal-header app-modal-header--primary">
              <div className="app-modal-header-content">
                <div className="modal-title-wrapper">
                  <span className="modal-icon" aria-hidden="true">{selectedSection.icon}</span>
                  <h2 id="modal-title" className="app-modal-title">
                    {selectedSection.title}
                  </h2>
                </div>
              </div>
              <button onClick={closeModal} className="app-modal-close">
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="app-modal-content">
              <div
                dangerouslySetInnerHTML={sanitizeHTML(selectedSection.content)}
              />
            </div>

            {/* Modal Footer */}
            <div className="app-modal-footer">
              <button
                onClick={closeModal}
                className="app-modal-btn app-modal-btn--secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
