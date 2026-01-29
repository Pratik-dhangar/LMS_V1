import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  GraduationCap,
  BookMarked,
  BookOpen,
  ShoppingCart,
  MessageSquare,
  Calendar,
  History,
  Package,
  TrendingUp,
  AlertCircle,
  Loader2,
  X
} from "lucide-react";
import subscriptionService from "../../api/services/subscriptionService";
import "../../styles/admin/index.css";
import "../../styles/components/common/Modal.css";

const LearnerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mySubscription, setMySubscription] = useState(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    fetchMySubscription();
  }, [user]);

  const fetchMySubscription = async () => {
    try {
      if (user?.id) {
        const subs = await subscriptionService.getMySubscriptions();
        const mySub = subs.find(s => ['ACTIVE', 'PAUSED', 'FROZEN'].includes(s.status));
        setMySubscription(mySub || null);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const getDaysUntilExpiry = (expiryDate) => {
    const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    return days;
  };

  

  const menuItems = [
    {
      icon: GraduationCap,
      title: "Individualised Intervention Program(IIP)",
      onClick: () => navigate("/learner/my-sessions"),
    },
    {
      icon: BookMarked,
      title: "Home Program (HP)",
      onClick: () => navigate("/learner/assigned-programs"),
    },
    {
      icon: BookOpen,
      title: "Learning Content",
      onClick: () => navigate("/learner/learning-content"),
    },
    {
      icon: Package,
      title: "My Subscription",
      onClick: () => setShowSubscriptionModal(true),
    }
  ];

  return (
    <div className="admin-dashboard-container">
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Page Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              HurshBin Learner Dashboard
            </h1>
            <div className="admin-dashboard-welcome">
              Welcome, <span className="admin-dashboard-welcome-name">{user?.name || 'Learner'}</span>!
            </div>
          </div>

          {/* Menu Cards */}
          <div className="admin-dashboard-menu">
            <div className="admin-menu-grid">
              {menuItems.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={index}
                    onClick={item.onClick}
                    className="admin-menu-card"
                    style={{ '--i': index }}
                  >
                    <div className="admin-menu-card-icon">
                      <IconComponent size={48} strokeWidth={1.5} />
                    </div>
                    <div className="admin-menu-card-title">{item.title}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subscription Details Modal */}
          {showSubscriptionModal && (
            <div className="app-modal-overlay">
              <div className="app-modal-container app-modal-container--md">
                {/* Modal Header */}
                <div className="app-modal-header app-modal-header--primary">
                  <div className="app-modal-header-content">
                    <h2 className="app-modal-title">My Subscription Details</h2>
                  </div>
                  <button
                    onClick={() => setShowSubscriptionModal(false)}
                    className="app-modal-close"
                    aria-label="Close modal"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="app-modal-content">
                  {loadingSubscription ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                      <Loader2 className="spinner" size={32} />
                    </div>
                  ) : mySubscription ? (
                    <div>
                      {/* Package Name and Status */}
                      <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', marginBottom: '8px' }}>
                          {mySubscription.package_name}
                        </h3>
                        <div style={{
                          display: 'inline-block',
                          padding: '6px 16px',
                          borderRadius: '20px',
                          fontSize: '13px',
                          fontWeight: '600',
                          backgroundColor: '#dbeafe',
                          color: '#1e40af'
                        }}>
                          Status: {mySubscription.status}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '16px',
                        marginBottom: '24px'
                      }}>
                        {/* Sessions */}
                        <div style={{
                          padding: '16px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          backgroundColor: '#f9fafb'
                        }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', marginBottom: '8px' }}>
                            Sessions
                          </div>
                          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}>
                            {mySubscription.sessions_remaining}/{mySubscription.sessions_count}
                          </div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {mySubscription.sessions_completed} completed
                          </div>
                        </div>

                        {/* Expires In */}
                        <div style={{
                          padding: '16px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          backgroundColor: '#f9fafb'
                        }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', marginBottom: '8px' }}>
                            Expires In
                          </div>
                          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}>
                            {getDaysUntilExpiry(mySubscription.expiry_date)} days
                          </div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {new Date(mySubscription.expiry_date).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Amount Paid */}
                        <div style={{
                          padding: '16px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          backgroundColor: '#f9fafb'
                        }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', marginBottom: '8px' }}>
                            Amount Paid
                          </div>
                          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}>
                            ₹{parseFloat(mySubscription.net_price_paid).toLocaleString('en-IN')}
                          </div>
                          {mySubscription.discount_code && (
                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                              Code: {mySubscription.discount_code}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Subscription Information Card */}
                      {(mySubscription.package_description || mySubscription.purchase_date) && (
                        <div style={{
                          padding: '16px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '8px',
                          marginBottom: '16px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#1f2937', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Details
                          </h4>
                          <div style={{ display: 'grid', gap: '10px' }}>
                            {mySubscription.package_description && (
                              <div>
                                <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Description</span>
                                <p style={{ fontSize: '13px', color: '#374151', marginTop: '4px', margin: 0 }}>
                                  {mySubscription.package_description}
                                </p>
                              </div>
                            )}
                            {mySubscription.purchase_date && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Purchase Date</span>
                                <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                                  {new Date(mySubscription.purchase_date).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Warning Alert */}
                      {getDaysUntilExpiry(mySubscription.expiry_date) <= 7 && getDaysUntilExpiry(mySubscription.expiry_date) > 0 && (
                        <div style={{
                          padding: '12px 16px',
                          backgroundColor: '#fef3c7',
                          border: '1px solid #fcd34d',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px'
                        }}>
                          <AlertCircle size={20} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', color: '#92400e', fontWeight: '500' }}>
                            Your subscription is expiring soon! Contact your coach for renewal.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                      <Package size={48} style={{ color: '#d1d5db', margin: '0 auto 16px' }} />
                      <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        No Active Subscription
                      </h3>
                      <p style={{ fontSize: '14px', color: '#6b7280' }}>
                        Contact your coach to get started with a subscription package
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default LearnerDashboard;
