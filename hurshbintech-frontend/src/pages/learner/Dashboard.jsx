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
  Loader2
} from "lucide-react";
import subscriptionService from "../../api/services/subscriptionService";
import "../../styles/admin/index.css";

const LearnerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mySubscription, setMySubscription] = useState(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

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
      icon: ShoppingCart,
      title: "Buy Learning Material",
      onClick: () => navigate("/learner/learning-material"),
    },
    {
      icon: History,
      title: "Learning Material Purchase History",
      onClick: () => navigate("/learner/profile-order-history"),
    },
    {
      icon: MessageSquare,
      title: "Communication",
      onClick: () => navigate("/learner/communication"),
    },
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

          {/* My Subscription Card */}
          {!loadingSubscription && (
            <div className="subscription-info-section" style={{ marginBottom: '30px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px', color: '#1f2937' }}>
                My Subscription
              </h2>
              {loadingSubscription ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <Loader2 className="spinner" size={32} />
                </div>
              ) : mySubscription ? (
                <div style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                  color: 'white',
                  padding: '24px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                        {mySubscription.package_name}
                      </h3>
                      <div style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: '600',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)'
                      }}>
                        {mySubscription.status}
                      </div>
                    </div>
                    <Package size={40} style={{ opacity: 0.8 }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    {/* Sessions Remaining */}
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '16px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <TrendingUp size={20} />
                        <span style={{ fontSize: '14px', opacity: 0.9 }}>Sessions</span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                        {mySubscription.sessions_remaining}/{mySubscription.sessions_count}
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                        {mySubscription.sessions_completed} completed
                      </div>
                    </div>

                    {/* Expiry Date */}
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '16px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Calendar size={20} />
                        <span style={{ fontSize: '14px', opacity: 0.9 }}>Expires In</span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                        {getDaysUntilExpiry(mySubscription.expiry_date)} days
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                        {new Date(mySubscription.expiry_date).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Amount Paid */}
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '16px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', opacity: 0.9 }}>Amount Paid</span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                        ₹{parseFloat(mySubscription.net_price_paid).toLocaleString('en-IN')}
                      </div>
                      {mySubscription.discount_code && (
                        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                          Code: {mySubscription.discount_code}
                        </div>
                      )}
                    </div>
                  </div>

                  {getDaysUntilExpiry(mySubscription.expiry_date) <= 7 && getDaysUntilExpiry(mySubscription.expiry_date) > 0 && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      backgroundColor: 'rgba(252, 211, 77, 0.2)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertCircle size={20} />
                      <span style={{ fontSize: '14px' }}>
                        Your subscription is expiring soon! Contact your coach for renewal.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  backgroundColor: '#f9fafb',
                  borderRadius: '12px',
                  border: '2px dashed #e5e7eb'
                }}>
                  <Package size={48} style={{ color: '#9ca3af', margin: '0 auto 16px' }} />
                  <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '16px' }}>
                    You don't have an active subscription yet
                  </p>
                  <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                    Contact your coach to get started with a subscription package
                  </p>
                </div>
              )}
            </div>
          )}

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

        </div>
      </main>
    </div>
  );
};

export default LearnerDashboard;
