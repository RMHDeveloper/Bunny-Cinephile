import React from 'react';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
  onBack?: () => void; // Added optional onBack prop
}

const PageLayout: React.FC<PageLayoutProps> = ({ children, title, description, onBack }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 md:p-12">
      <div className="relative w-full max-w-4xl bg-white/10 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 px-6 sm:px-8 md:px-10 lg:px-12 pt-6 sm:pt-8 md:pt-10 lg:pt-12 pb-20 text-center"> {/* Ensure symmetric horizontal padding, back button will be absolute */}
        {/* Global Logo and Tagline */}
        <img
          src="https://rabbitmarketinghouse.in/webinar/assets/WhatsApp_Image_2026-01-09_at_12.32.11_PM-removebg-preview.png"
          alt="Bunny logo"
          className="w-28 h-auto sm:w-36 mb-2 mx-auto drop-shadow-lg" // Adjusted size for header, centered
          aria-label="Bunny Cinephile logo"
        />
        <p className="text-xl sm:text-2xl font-semibold text-white/80 mb-8">
          Bunny Cinephile
        </p>

        {onBack && ( // Conditionally render back button
          <button
            onClick={onBack}
            className="absolute top-6 left-6 text-white/70 hover:text-white transition-colors duration-200 focus:outline-none z-10"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
        )}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-neon-blue mb-4 drop-shadow-lg">
          {title}
        </h1>
        <p className="text-md sm:text-lg text-white/80 mb-8 max-w-2xl mx-auto">
          {description}
        </p>
        <div className="w-full flex flex-col flex-grow">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PageLayout;