import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import storeService from "../../api/services/ecommerce/storeService";
import cartService from "../../api/services/ecommerce/cartService";
import { toast } from "react-toastify";




const StoreCatalog = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ageGroups, setAgeGroups] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [animatingProducts, setAnimatingProducts] = useState(new Set());

  const [filters, setFilters] = useState({
    search: "",
    category_id: "",
    age_group_ids: [],
    skill_ids: [],
    price_min: "",
    price_max: "",
    sort: "featured",
    page: 1,
    limit: 9,
  });

  const [pagination, setPagination] = useState({ total: 0, pages: 0 });

  // Helper function to get role-based dashboard URL
  const getDashboardUrl = () => {
    try {
      const userData = localStorage.getItem('user_data');
      const user = userData ? JSON.parse(userData) : null;
      if (!user || !user.role) return '/dashboard';
      const dashboardMap = {
        'head': '/head/dashboard',
        'trainer': '/trainer/dashboard',
        'coach': '/coach/dashboard',
        'admin': '/admin/dashboard',
        'learner': '/learner/dashboard'
      };
      return dashboardMap[user.role] || '/dashboard';
    } catch (error) {
      console.error('Error getting dashboard URL:', error);
      return '/dashboard';
    }
  };

  // Helper function to get role-based order history URL
  const getOrderHistoryUrl = () => {
    try {
      const userData = localStorage.getItem('user_data');
      const user = userData ? JSON.parse(userData) : null;
      if (!user || !user.role) return '/learner/profile-order-history';
      const orderHistoryMap = {
        'head': '/head/profile-order-history',
        'trainer': '/trainer/profile-order-history',
        'coach': '/coach/profile-order-history',
        'admin': '/admin/profile-order-history',
        'learner': '/learner/profile-order-history'
      };
      return orderHistoryMap[user.role] || '/learner/profile-order-history';
    } catch (error) {
      console.error('Error getting order history URL:', error);
      return '/learner/profile-order-history';
    }
  };


  useEffect(() => {
    loadMetadata();
    loadCartCount();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [filters]);

  const loadMetadata = async () => {
    try {
      const [categoriesData, ageGroupsData, skillsData] = await Promise.all([
        storeService.getCategories(),
        storeService.getAgeGroups(),
        storeService.getSkills(),
      ]);
      setCategories(categoriesData);
      setAgeGroups(ageGroupsData);
      setSkills(skillsData);
    } catch (error) {
      console.error("Failed to load metadata:", error);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const filterParams = {
        ...filters,
        age_group_ids: filters.age_group_ids.join(","),
        skill_ids: filters.skill_ids.join(","),
      };
      const data = await storeService.browseProducts(filterParams);
      setProducts(data.products || []);
      setPagination(data.pagination || { total: 0, pages: 0 });
    } catch (error) {
      console.error("Failed to load products:", error);
      // toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadCartCount = async () => {
    try {
      const cartData = await cartService.getCart();
      setCartCount(cartData.items?.length || 0);
    } catch (error) {
      // Cart might be empty or user not logged in
      setCartCount(0);
    }
  };

  const handleAddToCart = async (productId) => {
    try {
      // Trigger animation
      setAnimatingProducts(prev => new Set(prev).add(productId));

      await cartService.addToCart({ product_id: productId, quantity: 1 });
      loadCartCount();

      toast.success('Item added to cart!');

      // Remove animation after it completes
      setTimeout(() => {
        setAnimatingProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
      }, 600);
    } catch (error) {
      // Remove animation on error
      setAnimatingProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });

      if (error.response?.status === 401) {
        toast.info("Please login to add items to cart");
        navigate("/login");
      } else {
        toast.error(error.response?.data?.detail || "Failed to add to cart");
      }
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleCheckboxFilter = (key, value) => {
    setFilters((prev) => {
      const currentValues = prev[key];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      return { ...prev, [key]: newValues, page: 1 };
    });
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      category_id: "",
      age_group_ids: [],
      skill_ids: [],
      price_min: "",
      price_max: "",
      sort: "featured",
      page: 1,
      limit: 9,
    });
  };

  const getTagBadge = (tags) => {
    if (!tags || tags.length === 0) return null;
    const tagColors = {
      Recommended: "bg-green-600",
      Bestseller: "bg-red-500",
      New: "bg-amber-600",
    };
    const tag = tags[0];
    return (
      <div
        className={`absolute top-2 right-2 ${tagColors[tag] || "bg-gray-600"} text-white px-2 py-1 rounded text-xs font-semibold`}
      >
        {tag.toUpperCase()}
      </div>
    );
  };

  return (
    <div className="page-container">
      <style>{`
        @keyframes addToCartPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(39, 174, 96, 0.7);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 15px rgba(39, 174, 96, 0);
          }
        }
        
        @keyframes cartFly {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(50px, -50px) scale(0.5);
          }
        }
        
        .add-to-cart-animating {
          animation: addToCartPulse 0.6s ease-out !important;
        }
      `}</style>
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <button
                onClick={() => navigate(getDashboardUrl())}
                className="back-button"
              >
                <svg
                  className="icon-sm"
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
              <h1 className="page-title">Learning Materials Store</h1>
              <p className="page-description">
                Customized toys, board games, and books for your learning
                journey
              </p>
            </div>
            <button
              onClick={() => navigate(getOrderHistoryUrl())}
              style={{
                padding: '0.6rem 1rem',
                background: '#DB9D32',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#c4860f'}
              onMouseLeave={(e) => e.target.style.background = '#DB9D32'}
              title="View purchase history"
            >
              📋 Purchase History
            </button>
          </div>
          {/* Content */}

          <div
            style={{
              maxWidth: "1400px",
              margin: "0 auto",
              padding: "30px 20px",
            }}
          >
            <div
              style={{ display: "flex", gap: "30px", alignItems: "flex-start" }}
            >
              {/* Filter Sidebar */}
              <div style={{ width: "280px", flexShrink: 0 }}>
                <div
                  style={{
                    background: "white",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    padding: "20px",
                  }}
                >
                  {/* Categories */}
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      marginBottom: "15px",
                      color: "#2c3e50",
                    }}
                  >
                    Categories
                  </h3>
                  <div style={{ marginBottom: "20px" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "10px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        checked={filters.category_id === ""}
                        onChange={() => handleFilterChange("category_id", "")}
                        style={{ marginRight: "8px" }}
                      />
                      <span style={{ fontSize: "14px" }}>
                        All Products ({pagination.total})
                      </span>
                    </label>
                    {categories.map((cat) => (
                      <label
                        key={cat.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "10px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          checked={filters.category_id === cat.id}
                          onChange={() =>
                            handleFilterChange("category_id", cat.id)
                          }
                          style={{ marginRight: "8px" }}
                        />
                        <span style={{ fontSize: "14px" }}>{cat.name}</span>
                      </label>
                    ))}
                  </div>

                  {/* Age Groups */}
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      marginBottom: "15px",
                      color: "#2c3e50",
                      marginTop: "20px",
                    }}
                  >
                    Age Group
                  </h3>
                  <div style={{ marginBottom: "20px" }}>
                    {ageGroups.map((age) => (
                      <label
                        key={age.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "10px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={filters.age_group_ids.includes(age.id)}
                          onChange={() =>
                            handleCheckboxFilter("age_group_ids", age.id)
                          }
                          style={{ marginRight: "8px" }}
                        />
                        <span style={{ fontSize: "14px" }}>
                          {age.min_age}-{age.max_age} years
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Skills */}
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      marginBottom: "15px",
                      color: "#2c3e50",
                      marginTop: "20px",
                    }}
                  >
                    Skill Focus
                  </h3>
                  <div style={{ marginBottom: "20px" }}>
                    {skills.map((skill) => (
                      <label
                        key={skill.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "10px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={filters.skill_ids.includes(skill.id)}
                          onChange={() =>
                            handleCheckboxFilter("skill_ids", skill.id)
                          }
                          style={{ marginRight: "8px" }}
                        />
                        <span style={{ fontSize: "14px" }}>{skill.name}</span>
                      </label>
                    ))}
                  </div>

                  {/* Price Range */}
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      marginBottom: "15px",
                      color: "#2c3e50",
                      marginTop: "20px",
                    }}
                  >
                    Price Range
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      marginBottom: "15px",
                    }}
                  >
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.price_min}
                      onChange={(e) =>
                        handleFilterChange("price_min", e.target.value)
                      }
                      style={{
                        width: "70px",
                        padding: "8px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "13px",
                      }}
                    />
                    <span>-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.price_max}
                      onChange={(e) =>
                        handleFilterChange("price_max", e.target.value)
                      }
                      style={{
                        width: "70px",
                        padding: "8px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  {/* Filter Buttons */}
                  <button
                    onClick={loadProducts}
                    style={{
                      width: "100%",
                      padding: "10px",
                      background: "#DB9D32",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                      marginBottom: "10px",
                    }}
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={clearFilters}
                    style={{
                      width: "100%",
                      padding: "10px",
                      background: "#ecf0f1",
                      color: "#2c3e50",
                      border: "1px solid #bdc3c7",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Products Grid */}
              <div style={{ flex: 1 }}>
                {/* Search and Sort Bar */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px",
                    gap: "15px",
                  }}
                >
                  <div style={{ display: "flex", flex: 1, gap: "10px" }}>
                    <input
                      type="text"
                      placeholder="🔍 Search materials..."
                      value={filters.search}
                      onChange={(e) =>
                        handleFilterChange("search", e.target.value)
                      }
                      style={{
                        flex: 1,
                        padding: "10px 15px",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#7f8c8d",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Sort by:
                    </span>
                    <select
                      value={filters.sort}
                      onChange={(e) =>
                        handleFilterChange("sort", e.target.value)
                      }
                      style={{
                        padding: "10px 15px",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        background: "white",
                        fontSize: "14px",
                      }}
                    >
                      <option value="featured">Featured</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="newest">Newest</option>
                      <option value="bestseller">Best Selling</option>
                    </select>
                  </div>
                  <button
                    onClick={() => navigate("/store/cart")}
                    style={{
                      padding: "10px 20px",
                      background: "#27ae60",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    🛒 Cart ({cartCount})
                  </button>
                </div>

                {/* Products Grid */}
                {loading ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "60px 0",
                      color: "#7f8c8d",
                    }}
                  >
                    Loading products...
                  </div>
                ) : products.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "60px 0",
                      color: "#7f8c8d",
                    }}
                  >
                    No products found
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "20px",
                      }}
                    >
                      {products.map((product) => (
                        <div
                          key={product.id}
                          style={{
                            background: "white",
                            borderRadius: "8px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                            padding: "15px",
                            cursor: "pointer",
                            transition: "transform 0.2s, box-shadow 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform =
                              "translateY(-4px)";
                            e.currentTarget.style.boxShadow =
                              "0 6px 16px rgba(0,0,0,0.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow =
                              "0 2px 8px rgba(0,0,0,0.1)";
                          }}
                          onClick={() =>
                            navigate(`/store/product/${product.id}`)
                          }
                        >
                          <div
                            style={{
                              position: "relative",
                              background: "#f8f9fa",
                              height: "180px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "6px",
                              marginBottom: "12px",
                              overflow: "hidden",
                            }}
                          >
                            {product.thumbnail_url || product.image_url ? (
                              <img
                                src={product.thumbnail_url || product.image_url}
                                alt={product.name}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.parentElement.innerHTML =
                                    '<div style="font-size: 64px">📦</div>';
                                }}
                              />
                            ) : (
                              <div style={{ fontSize: "64px" }}>📦</div>
                            )}
                            {product.tags && product.tags.length > 0 && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "10px",
                                  right: "10px",
                                  background:
                                    product.tags[0] === "Recommended"
                                      ? "#27ae60"
                                      : product.tags[0] === "Bestseller"
                                        ? "#9C4D0B"
                                        : "#DB9D32",
                                  color: "white",
                                  padding: "4px 8px",
                                  borderRadius: "3px",
                                  fontSize: "11px",
                                  fontWeight: "600",
                                }}
                              >
                                {product.tags[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <h3
                            style={{
                              fontSize: "14px",
                              fontWeight: "600",
                              color: "#2c3e50",
                              marginBottom: "6px",
                              height: "40px",
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {product.name}
                          </h3>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#7f8c8d",
                              marginBottom: "8px",
                            }}
                          >
                            {product.category?.name || "Uncategorized"}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#7f8c8d",
                              marginBottom: "12px",
                              minHeight: "36px",
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {product.description &&
                              product.description.toString().trim()
                              ? product.description
                              : "No description available"}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "8px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "18px",
                                fontWeight: "bold",
                                color: "#2c3e50",
                              }}
                            >
                              ₹{product.final_price}
                            </div>
                            {product.discount_percentage > 0 && (
                              <div
                                style={{ fontSize: "12px", color: "#7f8c8d" }}
                              >
                                <del>₹{product.price}</del>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(product.id);
                            }}
                            disabled={!product.stock_available}
                            className={animatingProducts.has(product.id) ? 'add-to-cart-animating' : ''}
                            style={{
                              width: "100%",
                              padding: "10px",
                              background: product.stock_available
                                ? "#27ae60"
                                : "#95a5a6",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "13px",
                              fontWeight: "600",
                              cursor: product.stock_available
                                ? "pointer"
                                : "not-allowed",
                              marginTop: "10px",
                              transition: 'all 0.3s ease',
                            }}
                          >
                            {product.stock_available
                              ? "🛒 Add to Cart"
                              : "Out of Stock"}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: "10px",
                          marginTop: "30px",
                        }}
                      >
                        <button
                          onClick={() =>
                            handleFilterChange("page", filters.page - 1)
                          }
                          disabled={filters.page === 1}
                          style={{
                            padding: "10px 20px",
                            background:
                              filters.page === 1 ? "#ecf0f1" : "white",
                            border: "1px solid #ddd",
                            borderRadius: "6px",
                            cursor:
                              filters.page === 1 ? "not-allowed" : "pointer",
                            fontSize: "14px",
                          }}
                        >
                          ← Previous
                        </button>
                        <div style={{ display: "flex", gap: "5px" }}>
                          {[...Array(Math.min(5, pagination.pages))].map(
                            (_, i) => {
                              const page = i + 1;
                              return (
                                <button
                                  key={page}
                                  onClick={() =>
                                    handleFilterChange("page", page)
                                  }
                                  style={{
                                    padding: "10px 15px",
                                    background:
                                      filters.page === page
                                        ? "#DB9D32"
                                        : "white",
                                    color:
                                      filters.page === page
                                        ? "white"
                                        : "#2c3e50",
                                    border: "1px solid #ddd",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight:
                                      filters.page === page ? "600" : "400",
                                  }}
                                >
                                  {page}
                                </button>
                              );
                            },
                          )}
                        </div>
                        <button
                          onClick={() =>
                            handleFilterChange("page", filters.page + 1)
                          }
                          disabled={filters.page >= pagination.pages}
                          style={{
                            padding: "10px 20px",
                            background:
                              filters.page >= pagination.pages
                                ? "#ecf0f1"
                                : "white",
                            border: "1px solid #ddd",
                            borderRadius: "6px",
                            cursor:
                              filters.page >= pagination.pages
                                ? "not-allowed"
                                : "pointer",
                            fontSize: "14px",
                          }}
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StoreCatalog;
