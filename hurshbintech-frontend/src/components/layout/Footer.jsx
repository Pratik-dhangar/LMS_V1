import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import '../../styles/components/layout/Footer.css';

/**
 * Footer Component
 * 
 * Displays contact information at the bottom of every page
 * Includes email and phone details with Lucide icons
 * Responsive design with adjusted spacing for mobile devices
 */
const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <h3 className="footer-title">CONTACT US</h3>

          {/* Contact information with icons */}
          <div className="footer-contact">
            {/* Email */}
            <div className="footer-contact-item">
              <Mail />
              <a href="mailto:info@hurshbin.com">
                info@hurshbin.com
              </a>
            </div>

            {/* Separator for desktop */}
            <span className="footer-separator">|</span>

            {/* Phone */}
            <div className="footer-contact-item">
              <Phone />
              <a href="tel:+91XXXXXXXXXX">
                +91-XXXXXXXXXX
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-links" style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Link to="/about" style={{ color: 'white', textDecoration: 'none', marginRight: '1rem' }}>
              About Us
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>|</span>
            <Link to="/blogs" style={{ color: 'white', textDecoration: 'none', marginLeft: '1rem' }}>
              Blogs
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
