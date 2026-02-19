import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaSearch, FaCalendar, FaUser } from "react-icons/fa";
import Loader from "../../components/common/Loader";
import ErrorState from "../../components/common/ErrorState";
import blogService from "../../api/services/blogService";
import { getFileUrl } from "../../utils/urlHelper";
import "../../styles/ManageUsersLayout.css";
import "../../styles/pages/BlogList.css";

const BlogList = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();
  const debounceTimerRef = useRef(null);

  // Debounce search term - only update after 500ms of no typing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const response = await blogService.getPublicBlogs({
        page: currentPage,
        per_page: 10,
        search: debouncedSearchTerm || undefined,
      });
      setBlogs(response.blogs);
      setTotal(response.total);
      setTotalPages(response.total_pages);
      setError(null);
    } catch (err) {
      console.error("Error fetching blogs:", err);
      setError("Failed to fetch blogs. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, [currentPage, debouncedSearchTerm]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const truncateText = (text, length) => {
    if (!text) return "";
    const stripped = text.replace(/<[^>]*>/g, "");
    return stripped.length > length
      ? stripped.substring(0, length) + "..."
      : stripped;
  };

  if (loading && blogs.length === 0) return <Loader />;
  if (error && blogs.length === 0) return <ErrorState message={error} />;

  return (
    <div className="page-container">
      <main className="page-main">
        <div className="page-content">
            {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate("/")}
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
              Go Back
            </button>
            <div>
              <h1 className="page-title">Our Blogs</h1>
              <p className="page-description">
                 Insights, stories, and updates from our team
              </p>
            </div>
          </div>


          {/* Search Bar */}
          <div className="blog-search-section">
            <form onSubmit={handleSearch} className="blog-search-form">
              <div className="blog-search-wrapper">
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="blog-search-input"
                />
                <FaSearch className="blog-search-icon" />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                    className="blog-search-clear-btn"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="page-content">
            {blogs.length === 0 ? (
              <div className="blog-no-results">
                <div className="blog-no-results-content">
                  <p className="blog-no-results-title">No blogs found</p>
                  <p className="blog-no-results-text">
                    Try adjusting your search
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="blog-grid">
                  {blogs.map((blog, index) => (
                    <article
                      key={blog.id}
                      className="blog-card"
                      onClick={() => navigate(`/blogs/${blog.slug}`)}
                    >
                      {/* Featured Image */}
                      <div className="blog-card-image">
                        {blog.featured_image_url ? (
                          <img
                            src={getFileUrl(blog.featured_image_url)}
                            alt={blog.title}
                            className="blog-card-img"
                          />
                        ) : (
                          <div className="blog-card-img-placeholder"></div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="blog-card-content">
                        <h2 className="blog-card-title">{blog.title}</h2>

                        {blog.excerpt && (
                          <p className="blog-card-excerpt">{blog.excerpt}</p>
                        )}

                        {/* Meta Info */}
                        <div className="blog-card-meta">
                          <div className="blog-card-meta-item">
                            <FaUser className="blog-card-meta-icon" />
                            <span>{blog.author.name}</span>
                          </div>
                          <div className="blog-card-meta-item">
                            <FaCalendar className="blog-card-meta-icon" />
                            <span>{formatDate(blog.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="blog-pagination">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="blog-pagination-btn"
                    >
                      Previous
                    </button>

                    <div className="blog-pagination-pages">
                      {[...Array(totalPages)].map((_, idx) => {
                        const pageNum = idx + 1;
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= currentPage - 1 &&
                            pageNum <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={idx}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`blog-pagination-page ${
                                currentPage === pageNum ? "active" : ""
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (
                          pageNum === currentPage - 2 ||
                          pageNum === currentPage + 2
                        ) {
                          return (
                            <span
                              key={idx}
                              className="blog-pagination-ellipsis"
                            >
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>

                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className="blog-pagination-btn"
                    >
                      Next
                    </button>
                  </div>
                )}

                {/* Results Info */}
                <div className="blog-results-info">
                  Showing{" "}
                  <span className="blog-results-highlight">
                    {(currentPage - 1) * 10 + 1}
                  </span>{" "}
                  -{" "}
                  <span className="blog-results-highlight">
                    {Math.min(currentPage * 10, total)}
                  </span>{" "}
                  of <span className="blog-results-highlight">{total}</span>{" "}
                  articles
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default BlogList;
