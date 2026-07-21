import React, { useState, useEffect, useCallback } from 'react';
import LanguageSelection from './pages/LanguageSelection';
import QuickSwipe from './pages/QuickSwipe';
import AppLoadingScreen from './components/AppLoadingScreen'; // Import the new loading screen
import { AppPages } from './types';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<AppPages>(AppPages.LanguageSelection);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [appLoading, setAppLoading] = useState(true); // New loading state
  
  // New state to keep track of all movie canonical IDs seen across multiple QuickSwipe sessions
  const [allSeenMovieIds, setAllSeenMovieIds] = useState<Set<string>>(new Set());

  // Simulate app loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppLoading(false);
    }, 1500); // Reduced to 1.5-second simulated loading time for quicker startup

    return () => clearTimeout(timer);
  }, []);

  // Set the document title
  useEffect(() => {
    document.title = "Bunny Cinephile";
  }, []);

  const handleLanguageSelection = (languages: string[]) => {
    setSelectedLanguages(languages);
    setCurrentPage(AppPages.QuickSwipeRefiner);
  };

  const handleRestart = () => {
    setCurrentPage(AppPages.LanguageSelection);
    setSelectedLanguages([]);
    setAllSeenMovieIds(new Set()); // Clear all seen canonical IDs on a full restart
  };

  const handleBack = () => {
    setCurrentPage((prevPage) => {
      switch (prevPage) {
        case AppPages.QuickSwipeRefiner:
          return AppPages.LanguageSelection;
        case AppPages.LanguageSelection: // No back action for the first page
        default:
          return prevPage;
      }
    });
  };

  // Callback to update the set of all seen movie canonical IDs
  const handleMoviesProcessed = useCallback((newlySeenCanonicalIds: string[]) => {
    setAllSeenMovieIds((prevIds) => {
      const newSet = new Set(prevIds);
      newlySeenCanonicalIds.forEach(id => newSet.add(id));
      return newSet;
    });
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case AppPages.LanguageSelection:
        return (
          <LanguageSelection
            onNext={handleLanguageSelection}
            initialSelection={selectedLanguages}
            // No onBack prop as this is the first page. Handled internally by PageLayout.
          />
        );
      case AppPages.QuickSwipeRefiner:
        if (selectedLanguages.length === 0) {
          // Should ideally not happen if language selection is a prerequisite
          return <p className="text-red-500">Error: Language not selected. Please restart.</p>;
        }
        return (
          <QuickSwipe
            languages={selectedLanguages}
            onBack={handleBack}
            onRestart={handleRestart}
            previouslySeenCanonicalIds={allSeenMovieIds} // Pass the set of all seen movie canonical IDs
            onMoviesProcessed={handleMoviesProcessed} // Pass the callback to update seen canonical IDs
          />
        );
      default:
        // Fallback to LanguageSelection if somehow in an unknown state
        return <LanguageSelection onNext={handleLanguageSelection} initialSelection={selectedLanguages} />;
    }
  };

  return (
    <div className="min-h-screen">
      {appLoading ? <AppLoadingScreen /> : renderPage()}
    </div>
  );
};

export default App;