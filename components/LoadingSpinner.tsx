import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
      <p className="ml-3 text-neon-blue">Loading...</p>
    </div>
  );
};

export default LoadingSpinner;