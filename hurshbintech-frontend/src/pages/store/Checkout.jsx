import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import cartService from '../../api/services/ecommerce/cartService';
import orderService from '../../api/services/ecommerce/orderService';
import axiosInstance from '../../api/axios';
import { toast } from 'react-toastify';
import { Mail, AlertCircle } from 'lucide-react';

const Checkout = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [orderData, setOrderData] = useState(null);
    const [createdOrderId, setCreatedOrderId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [emailVerified, setEmailVerified] = useState(false);

    const [formData, setFormData] = useState({
        delivery_address: '',
        delivery_city: '',
        delivery_pincode: '',
        payment_method: 'UPI_QR',
        email: '',
        contact_number: ''
    });

    useEffect(() => {
        loadCart();
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            // Fetch user profile data from Users table via profile endpoint
            const response = await axiosInstance.get('/profile/me/user');

            if (!response.data) {
                console.warn('No user data returned from API');
                return;
            }

            // Extract email and contact_number directly from response
            const userEmail = response.data.email || '';
            const userContactNumber = response.data.contact_number || '';

            console.log('=== USER DATA FETCHED ===');
            console.log('Email:', userEmail);
            console.log('Contact Number:', userContactNumber);
            console.log('========================');

            // Update form data with fetched values
            setFormData(prevData => ({
                ...prevData,
                email: userEmail,
                contact_number: userContactNumber
            }));

            // Set email verification status
            if (userEmail) {
                setEmailVerified(true);
            }

            // Store user data in state
            setCurrentUser(response.data);

        } catch (error) {
            console.error('Failed to load user data:', error);
            toast.error('Could not load user information');
        }
    };

    const loadCart = async () => {
        try {
            setLoading(true);
            const data = await cartService.getCart();
            if (!data.items || data.items.length === 0) {
                toast.info('Your cart is empty');
                navigate('/store');
                return;
            }
            setCart(data);
        } catch (error) {
            if (error.response?.status === 401) {
                toast.info('Please login to checkout');
                navigate('/auth/login');
            } else {
                toast.error('Failed to load cart');
                navigate('/store/cart');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Update email verification status when email is changed by user
        if (name === 'email' && currentUser && value !== currentUser.email) {
            setEmailVerified(false);
        } else if (name === 'email' && currentUser && value === currentUser.email) {
            setEmailVerified(true);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
            if (!validTypes.includes(file.type)) {
                toast.error('Please upload JPG, PNG, or PDF file');
                return;
            }
            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('File size should not exceed 5MB');
                return;
            }
            setReceiptFile(file);

            // Create preview for image files
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => setReceiptPreview(ev.target.result);
                reader.readAsDataURL(file);
            } else {
                setReceiptPreview(null); // PDF doesn't have preview
            }

            toast.success('Receipt selected: ' + file.name);
        }
    };

    const handleCheckout = async () => {
        // Validate form
        if (!formData.delivery_address || !formData.delivery_city || !formData.delivery_pincode) {
            toast.error('Please fill in all delivery details');
            return;
        }
        if (!formData.email) {
            toast.error('Please provide your email address');
            return;
        }
        if (!formData.contact_number) {
            toast.error('Please provide your contact number');
            return;
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            toast.error('Please enter a valid email address');
            return;
        }
        if (!receiptFile) {
            toast.error('Please upload payment receipt');
            return;
        }

        try {
            setSubmitting(true);
            // Create order
            const order = await orderService.checkout(formData);

            // Store the created order ID in state so it displays
            setCreatedOrderId(order.order_number);

            // Upload receipt (use order_id from response)
            await orderService.uploadReceipt(order.order_id, receiptFile);

            toast.success('Order placed successfully! Admin will verify payment shortly.');

            // Redirect to appropriate dashboard based on user role
            if (user && user.role) {
                const dashboardMap = {
                    'head': '/head/dashboard',
                    'trainer': '/trainer/dashboard',
                    'coach': '/coach/dashboard',
                    'admin': '/admin/dashboard',
                    'learner': '/learner/dashboard'
                };
                const redirectUrl = dashboardMap[user.role] || '/store';
                navigate(redirectUrl);
            } else {
                navigate('/store');
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to place order');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: '18px', color: '#7f8c8d' }}>Loading checkout...</p>
            </div>
        );
    }

    if (!cart) return null;

    // Use actual order ID if created, otherwise show placeholder
    const displayOrderId = createdOrderId || 'ORD-XXXX-XXXXXX';

    return (
        <div style={{ minHeight: '100vh', background: '#f5f6fa', padding: '30px 20px' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    padding: '30px',
                    borderTop: '4px solid #f39c12'
                }}>
                    <h1 style={{ fontSize: '28px', fontWeight: '600', color: '#2c3e50', marginBottom: '20px' }}>
                        Checkout - Payment via QR Code or Bank Transfer
                    </h1>

                    <div style={{ display: 'flex', gap: '30px' }}>
                        {/* Checkout Form */}
                        <div style={{ flex: 2 }}>
                            {/* Email Verification */}
                            <div style={{
                                background: emailVerified ? '#d4edda' : '#fff3cd',
                                border: `1px solid ${emailVerified ? '#28a745' : '#ffc107'}`,
                                borderRadius: '8px',
                                padding: '20px',
                                marginBottom: '20px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <Mail size={20} style={{ color: emailVerified ? '#28a745' : '#ff9800', marginTop: '2px' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
                                                Email for Payment Instructions
                                            </h4>

                                        </div>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            placeholder="your.email@example.com"
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                border: `2px solid ${emailVerified ? '#28a745' : '#ffc107'}`,
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                background: 'white',
                                                boxSizing: 'border-box'
                                            }}
                                        />

                                    </div>
                                </div>
                            </div>

                            {/* Delivery Address */}
                            <div style={{
                                background: 'white',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                padding: '25px',
                                marginBottom: '20px'
                            }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#2c3e50' }}>
                                    1. Delivery Address
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
                                            Full Address *
                                        </label>
                                        <input
                                            type="text"
                                            name="delivery_address"
                                            value={formData.delivery_address}
                                            onChange={handleInputChange}
                                            placeholder="Enter your complete address"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #ddd',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
                                                City *
                                            </label>
                                            <input
                                                type="text"
                                                name="delivery_city"
                                                value={formData.delivery_city}
                                                onChange={handleInputChange}
                                                placeholder="City"
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '6px',
                                                    fontSize: '14px'
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
                                                Postal Code *
                                            </label>
                                            <input
                                                type="text"
                                                name="delivery_pincode"
                                                value={formData.delivery_pincode}
                                                onChange={handleInputChange}
                                                placeholder="Pincode"
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '6px',
                                                    fontSize: '14px'
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
                                            Contact Number *
                                        </label>
                                        <input
                                            type="tel"
                                            name="contact_number"
                                            value={formData.contact_number}
                                            onChange={handleInputChange}
                                            placeholder="Enter your contact number"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #ddd',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Payment Section */}
                            <div style={{
                                background: 'white',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                padding: '25px'
                            }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#2c3e50' }}>
                                    2. Payment Method - Choose One
                                </h3>

                                {/* QR Code Payment */}
                                <div
                                    onClick={() => setFormData(prev => ({ ...prev, payment_method: 'UPI_QR' }))}
                                    style={{
                                        border: formData.payment_method === 'UPI_QR' ? '3px solid #27ae60' : '2px solid #e0e0e0',
                                        borderRadius: '8px',
                                        padding: '20px',
                                        marginBottom: '15px',
                                        cursor: 'pointer',
                                        textAlign: 'center'
                                    }}
                                >
                                    <div style={{ fontWeight: '600', marginBottom: '15px', fontSize: '16px', color: '#27ae60' }}>
                                        📱 Option 1: Scan QR Code
                                    </div>
                                    <div style={{
                                        background: '#f0f8f5',
                                        padding: '40px',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <img
                                            src="/upi-qr.jpeg"
                                            alt="UPI QR Code"
                                            className="bsm-qr-img"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                const placeholder = e.target.nextElementSibling;
                                                if (placeholder) placeholder.style.display = 'flex';
                                            }}
                                        />
                                        <div className="bsm-qr-placeholder">
                                            <p>📱</p>
                                            <span>QR Code file not found</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bank Transfer Payment */}
                                <div
                                    onClick={() => setFormData(prev => ({ ...prev, payment_method: 'BANK_TRANSFER' }))}
                                    style={{
                                        border: formData.payment_method === 'BANK_TRANSFER' ? '3px solid #3498db' : '2px solid #e0e0e0',
                                        borderRadius: '8px',
                                        padding: '20px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ fontWeight: '600', marginBottom: '15px', fontSize: '16px', color: '#3498db' }}>
                                        🏦 Option 2: Bank Transfer
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                        <tbody>
                                            <tr style={{ borderBottom: '1px solid #ddd' }}>
                                                <td style={{ padding: '12px 0', fontWeight: '600', color: '#2c3e50', width: '40%' }}>Bank Name</td>
                                                <td style={{ padding: '12px 0', color: '#2c3e50' }}>ICICI Bank</td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid #ddd' }}>
                                                <td style={{ padding: '12px 0', fontWeight: '600', color: '#2c3e50' }}>Account Holder</td>
                                                <td style={{ padding: '12px 0', color: '#2c3e50' }}>HurshBin Technologies Pvt Ltd</td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid #ddd' }}>
                                                <td style={{ padding: '12px 0', fontWeight: '600', color: '#2c3e50' }}>Account Number</td>
                                                <td style={{ padding: '10px', color: '#2c3e50', fontFamily: 'monospace', background: '#f8f9fa' }}>
                                                    1234567890123456
                                                </td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid #ddd' }}>
                                                <td style={{ padding: '12px 0', fontWeight: '600', color: '#2c3e50' }}>IFSC Code</td>
                                                <td style={{ padding: '10px', color: '#2c3e50', fontFamily: 'monospace', background: '#f8f9fa' }}>
                                                    ICIC0000001
                                                </td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid #ddd' }}>
                                                <td style={{ padding: '12px 0', fontWeight: '600', color: '#2c3e50' }}>Amount to Pay</td>
                                                <td style={{ padding: '12px 0', color: '#27ae60', fontWeight: '600', fontSize: '16px' }}>
                                                    ₹{cart.total}
                                                </td>
                                            </tr>

                                        </tbody>
                                    </table>

                                </div>



                                {/* Upload Receipt Section */}
                                <div style={{
                                    background: '#e8f5e9',
                                    border: '3px solid #27ae60',
                                    borderRadius: '8px',
                                    padding: '25px',
                                    marginTop: '20px'
                                }}>
                                    <div style={{ fontWeight: '600', marginBottom: '15px', fontSize: '16px', color: '#27ae60' }}>
                                        3️⃣ Upload Payment Receipt *
                                    </div>

                                    <label
                                        htmlFor="receipt-upload"
                                        style={{
                                            display: receiptFile ? 'none' : 'block',
                                            background: 'white',
                                            border: '3px dashed #27ae60',
                                            padding: '40px',
                                            textAlign: 'center',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        <div style={{ fontSize: '64px', marginBottom: '15px' }}>📸</div>
                                        <div style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '5px', fontSize: '15px' }}>
                                            {receiptFile ? receiptFile.name : 'Drag & Drop or Click to Upload'}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#555' }}>
                                            Payment screenshot / Bank transfer confirmation / UPI receipt
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '10px' }}>
                                            Accepted: PNG, JPG, PDF (Max 5MB)
                                        </div>
                                    </label>
                                    <input
                                        id="receipt-upload"
                                        type="file"
                                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                    />

                                    {/* Receipt Preview */}
                                    {receiptPreview && (
                                        <div style={{
                                            marginTop: '20px',
                                            padding: '15px',
                                            background: '#f0f9ff',
                                            border: '2px solid #3498db',
                                            borderRadius: '8px',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <p style={{ margin: 0, fontSize: '13px', color: '#2980b9', fontWeight: '600' }}>📷 Receipt Preview:</p>
                                                <button
                                                    onClick={() => {
                                                        document.getElementById('receipt-upload').click();
                                                    }}
                                                    style={{
                                                        padding: '5px 12px',
                                                        fontSize: '12px',
                                                        background: '#3498db',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    Change Receipt
                                                </button>
                                            </div>
                                            <img
                                                src={receiptPreview}
                                                alt="Receipt preview"
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '300px',
                                                    borderRadius: '6px',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                                }}
                                            />
                                        </div>
                                    )}

                                    {receiptFile && !receiptPreview && (
                                        <div style={{
                                            marginTop: '20px',
                                            padding: '12px',
                                            background: '#f5f5f5',
                                            border: '1px solid #ddd',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ fontSize: '13px', color: '#666' }}>📄 {receiptFile.name}</span>
                                            <button
                                                onClick={() => {
                                                    document.getElementById('receipt-upload').click();
                                                }}
                                                style={{
                                                    padding: '5px 12px',
                                                    fontSize: '12px',
                                                    background: '#3498db',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                Change
                                            </button>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>

                        {/* Order Summary Sidebar */}
                        <div style={{ flex: 1 }}>
                            {/* Order Summary */}
                            <div style={{
                                background: 'white',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                padding: '20px',
                                marginBottom: '15px'
                            }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: '#2c3e50' }}>
                                    Order Summary
                                </h3>
                                <div style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: '15px', marginBottom: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0', fontSize: '14px' }}>
                                        <span>Subtotal</span>
                                        <span>₹{cart.subtotal}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0', fontSize: '14px' }}>
                                        <span>Discount</span>
                                        <span style={{ color: '#27ae60' }}>-₹{cart.discount_total}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0', fontSize: '14px' }}>
                                        <span>Delivery Charge</span>
                                        <span style={{ color: '#27ae60' }}>FREE</span>
                                    </div>
                                </div>
                                <div style={{ paddingBottom: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold' }}>
                                        <span>Total Amount Due</span>
                                        <span style={{ color: '#27ae60', fontSize: '20px' }}>₹{cart.total}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Items Summary */}
                            <div style={{
                                background: 'white',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                padding: '15px',
                                marginBottom: '15px'
                            }}>
                                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#2c3e50' }}>
                                    Items in Order ({cart.items.length})
                                </div>
                                <div style={{ fontSize: '13px', lineHeight: '1.8', color: '#555' }}>
                                    {cart.items.map((item, index) => (
                                        <div key={index}>
                                            • {item.product?.name || 'Product'} (Qty: {item.quantity})
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Confirm Button */}
                            <button
                                onClick={handleCheckout}
                                disabled={submitting}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    background: submitting ? '#95a5a6' : '#27ae60',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    marginBottom: '12px'
                                }}
                            >
                                {submitting ? 'Processing...' : '📤 Upload Receipt & Confirm Order'}
                            </button>

                            {/* Support */}
                            <div style={{
                                background: '#f8f9fa',
                                padding: '12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#7f8c8d',
                                textAlign: 'center',
                                lineHeight: '1.6'
                            }}>
                                Need help? Contact us on WhatsApp<br />
                                <span style={{ color: '#27ae60', fontWeight: '600' }}>+91-8928765220</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
