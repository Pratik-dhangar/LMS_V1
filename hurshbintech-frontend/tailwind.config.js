/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Custom breakpoints matching our responsive system
      screens: {
        'mobile': { 'max': '812px' },           // Mobile Landscape
        'tablet': { 'min': '813px', 'max': '1366px' },  // Tablet Landscape
        'desktop': { 'min': '1367px' },         // Desktop
      },
      // Custom colors matching our CSS variables
      colors: {
        primary: {
          DEFAULT: '#db9d32',
          dark: '#b8790a',
          light: '#f0c566',
        },
        secondary: {
          DEFAULT: '#667eea',
          dark: '#764ba2',
        },
      },
      // Custom spacing that matches our design system
      spacing: {
        'xs': '0.25rem',
        'sm': '0.5rem',
        'md': '1rem',
        'lg': '1.5rem',
        'xl': '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
      },
      // Custom border radius
      borderRadius: {
        'sm': '0.25rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      // Custom max-width for containers
      maxWidth: {
        'content': '1400px',
      },
      // Custom animations
      keyframes: {
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.5s ease-out',
      },
    },
  },
  plugins: [],
}


