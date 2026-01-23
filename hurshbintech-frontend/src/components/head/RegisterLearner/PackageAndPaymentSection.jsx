import React, { useState, useEffect } from 'react';
import subscriptionService from '../../../api/services/subscriptionService';

const PackageAndPaymentSection = ({ formData, handleChange, onPackageChange, errors }) => {
    const [packages, setPackages] = useState([]);
    const [loadingPackages, setLoadingPackages] = useState(false);
    const [receiptFile, setReceiptFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        try {
            setLoadingPackages(true);
            const response = await subscriptionService.getAllPackages(true);
            setPackages(Array.isArray(response) ? response : response.packages || []);
            console.log('Packages loaded:', response);
        } catch (error) {
            console.error('Error fetching packages:', error);
            setPackages([]);
        } finally {
            setLoadingPackages(false);
        }
    };

    const handlePackageChange = (e) => {
        const packageId = parseInt(e.target.value);
        const selectedPackage = packages.find(p => p.id === packageId);
        handleChange(e);
        if (onPackageChange) {
            onPackageChange(selectedPackage);
        }
    };

    const handleReceiptChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
            if (!validTypes.includes(file.type)) {
                alert('Please upload JPG, PNG, or PDF file');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert('File size should not exceed 5MB');
                return;
            }
            setReceiptFile(file);
            // Create preview URL
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const removeReceipt = () => {
        setReceiptFile(null);
        setPreviewUrl(null);
        setShowPreview(false);
    };

    const handleViewReceipt = () => {
        if (previewUrl) {
            setShowPreview(true);
        }
    };

    // Store receipt file in formData (as a blob or file reference)
    React.useEffect(() => {
        if (receiptFile) {
            // Store file in window for submission
            window.paymentReceipt = receiptFile;
        }
    }, [receiptFile]);

    const getSelectedPackageDetails = () => {
        const selectedId = parseInt(formData.package_id);
        return packages.find(p => p.id === selectedId);
    };

    const selectedPackage = getSelectedPackageDetails();

    return (
        <section className="form-section">
            <h2 className="form-section-heading">📦 Package & Payment Details</h2>
            <p className="form-section-description">Select a subscription package and upload payment receipt</p>

            <div className="form-grid form-grid-2">
                {/* Package Selection */}
                <div className="form-group">
                    <label htmlFor="package_id" className="form-label">
                        Select Package *
                        {loadingPackages && <span className="ml-2 text-xs text-gray-500">(Loading...)</span>}
                    </label>
                    <select
                        id="package_id"
                        name="package_id"
                        value={formData.package_id || ''}
                        onChange={handlePackageChange}
                        className={`form-input ${errors.package_id ? 'error' : ''}`}
                        disabled={loadingPackages}
                    >
                        <option value="">-- Select a Package --</option>
                        {packages.map(pkg => (
                            <option key={pkg.id} value={pkg.id}>
                                {pkg.package_name} ({pkg.sessions_count} sessions)
                            </option>
                        ))}
                    </select>
                    {errors.package_id && (
                        <span className="form-error">{errors.package_id}</span>
                    )}
                </div>

                {/* Package Price Display */}
                <div className="form-group">
                    <label htmlFor="package_price" className="form-label">Package Price</label>
                    <div className="form-input-display">
                        {selectedPackage ? (
                            <div className="package-price-display">
                                <span className="price">Rs. {parseFloat(selectedPackage.price).toFixed(2)}</span>
                                <span className="validity">Valid for {selectedPackage.validity_days} days</span>
                            </div>
                        ) : (
                            <span className="text-gray-500">Select a package to see price</span>
                        )}
                    </div>
                </div>

                {/* Sessions Count Display */}
                {selectedPackage && (
                    <div className="form-group">
                        <label className="form-label">Total Sessions</label>
                        <div className="form-input-display">
                            <span className="sessions-count">{selectedPackage.sessions_count} sessions</span>
                        </div>
                    </div>
                )}

                {/* Discount Code */}
                <div className="form-group">
                    <label htmlFor="discount_code" className="form-label">
                        Discount Code (Optional)
                    </label>
                    <input
                        id="discount_code"
                        type="text"
                        name="discount_code"
                        value={formData.discount_code || ''}
                        onChange={handleChange}
                        placeholder="Enter discount code if applicable"
                        className="form-input"
                    />
                </div>
            </div>

            {/* Payment Receipt Upload */}
            <div className="form-group full-width">
                <label className="form-label">
                    Upload Payment Receipt *
                    <span className="text-xs text-gray-500 ml-2">(JPG, PNG, or PDF)</span>
                </label>

                {!receiptFile ? (
                    <div className="form-file-upload">
                        <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={handleReceiptChange}
                            className="form-file-input"
                            id="payment_receipt"
                        />
                        <label htmlFor="payment_receipt" className="form-file-upload-label">
                            <svg className="icon-lg upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <div className="text-center">
                                <p className="font-semibold text-gray-700">Click to upload or drag and drop</p>
                                <p className="text-xs text-gray-500">PNG, JPG, or PDF up to 5MB</p>
                            </div>
                        </label>
                    </div>
                ) : (
                    <div className="form-file-selected">
                        <div className="file-selected-content">
                            <svg className="icon-sm success-icon" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="file-selected-info">
                                <p className="font-semibold text-gray-800">{receiptFile.name}</p>
                                <p className="text-xs text-gray-500">{(receiptFile.size / 1024).toFixed(2)} KB</p>
                            </div>
                            <div className="file-action-buttons">
                                <button
                                    type="button"
                                    onClick={handleViewReceipt}
                                    className="btn-primary"
                                    title="View receipt"
                                >
                                    👁️ View
                                </button>
                                <button
                                    type="button"
                                    onClick={removeReceipt}
                                    className="file-remove-btn"
                                    title="Remove file"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {errors.payment_receipt && (
                    <span className="form-error">{errors.payment_receipt}</span>
                )}
            </div>

            {/* Info Box */}
            <div className="form-info-box">
                <svg className="icon-sm info-icon" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zM8 9a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                </svg>
                <div>
                    <p className="font-semibold text-sm text-gray-800">Payment Receipt Information</p>
                    <p className="text-xs text-gray-600 mt-1">Upload a clear copy of your payment receipt. This will be verified by the admin and the subscription will be activated upon approval.</p>
                </div>
            </div>

            {/* Receipt Preview Modal */}
            {showPreview && previewUrl && receiptFile && (
                <div className="app-modal-overlay" onClick={() => setShowPreview(false)}>
                    <div className="app-modal-container app-modal-container--md" onClick={(e) => e.stopPropagation()}>
                        <div className="app-modal-header">
                            <div className="app-modal-header-content">
                                <h2 className="app-modal-title">Payment Receipt Preview</h2>
                            </div>
                            <button
                                type="button"
                                className="app-modal-close"
                                onClick={() => setShowPreview(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="app-modal-content app-modal-content--no-padding">
                            {receiptFile.type === 'application/pdf' ? (
                                <div className="receipt-pdf-placeholder">
                                    <div className="pdf-icon">📄</div>
                                    <p className="font-semibold text-gray-700">PDF File: {receiptFile.name}</p>
                                    <p className="text-sm text-gray-500 mt-2">Size: {(receiptFile.size / 1024).toFixed(2)} KB</p>
                                    <a
                                        href={previewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="receipt-download-btn"
                                    >
                                        📥 Open in New Tab
                                    </a>
                                </div>
                            ) : (
                                <img
                                    src={previewUrl}
                                    alt="Payment Receipt"
                                    className="receipt-preview-image"
                                />
                            )}
                        </div>
                        
                    </div>
                </div>
            )}
        </section>
    );
};

export default PackageAndPaymentSection;
