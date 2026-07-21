import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const AppLoadingScreen: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-deep-navy to-cosmic-purple text-white p-4">
      {/* Re-added logo for loading screen */}
      <img
        src="https://rabbitmarketinghouse.in/webinar/assets/WhatsApp_Image_2026-01-09_at_12.32.11_PM-removebg-preview.png"
        alt="Bunny logo"
        className="w-64 h-auto sm:w-80 mb-2 drop-shadow-lg" // Larger size for prominent display on loading screen
        aria-label="Bunny Cinephile logo"
      />
      <p className="text-3xl sm:text-4xl font-semibold text-white/80 mb-8">
        Bunny Cinephile
      </p>
      <LoadingSpinner />
      <p className="mt-6 text-lg text-white/70">Hopping into recommendations...</p>
    </div>
  );
};

export default AppLoadingScreen;