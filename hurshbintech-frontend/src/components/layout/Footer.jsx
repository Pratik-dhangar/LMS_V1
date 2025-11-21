import React from 'react';
import { Mail, Phone } from 'lucide-react';

/**
 * Footer Component
 * 
 * Displays contact information at the bottom of every page
 * Includes email and phone details with Lucide icons
 * Responsive design with adjusted spacing for mobile devices
 */
const Footer = () => {
  return (
    <footer className="bg-[#2c3e50] text-white py-8 mt-auto md:py-4">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center">
          <h3 className="m-0 mb-4 text-xl font-semibold md:text-base">CONTACT US</h3>
          
          {/* Contact information with icons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
            {/* Email */}
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#ecf0f1]" />
              <a 
                href="mailto:info@hurshbin.com" 
                className="text-[#ecf0f1] hover:text-white transition-colors text-[0.95rem] md:text-[0.85rem]"
              >
                info@hurshbin.com
              </a>
            </div>

            {/* Separator for desktop */}
            <span className="hidden sm:inline text-[#ecf0f1]">|</span>

            {/* Phone */}
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-[#ecf0f1]" />
              <a 
                href="tel:+91XXXXXXXXXX" 
                className="text-[#ecf0f1] hover:text-white transition-colors text-[0.95rem] md:text-[0.85rem]"
              >
                +91-XXXXXXXXXX
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
