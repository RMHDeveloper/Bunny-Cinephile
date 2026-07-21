import React, { useState, useEffect, useCallback, useRef } from 'react';
import PageLayout from '../components/PageLayout';
import MovieCard from '../components/MovieCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import { Movie, Recommendation } from '../types';
import { getInitialMovies, getFinalRecommendation, MOCK_MOVIES, shuffleArray } from '../services/geminiService';
import { PLACEHOLDER_STREAMING_PLATFORMS } from '../constants'; // Import from constants

interface QuickSwipeProps {
  languages: string[];
  onBack: () => void; // onBack is now always required for PageLayout's back button
  onRestart: () => void;
  previouslySeenCanonicalIds: Set<string>; // Updated prop: canonical IDs of all movies seen so far
  onMoviesProcessed: (newlySeenCanonicalIds: string[]) => void; // Updated prop: Callback to report processed canonical IDs
}

const SWIPE_THRESHOLD = 80; // pixels to trigger a swipe
const ROTATION_FACTOR = 0.1; // degrees per pixel of drag for subtle rotation

const QuickSwipe: React.FC<QuickSwipeProps> = ({ languages, onBack, onRestart, previouslySeenCanonicalIds, onMoviesProcessed }) => {
  const [movieStack, setMovieStack] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedMovies, setLikedMovies] = useState<Movie[]>([]);
  const [dislikedMovies, setDislikedMovies] = useState<Movie[]>([]);
  const [isLoadingMovies, setIsLoadingMovies] = useState(true);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Changed to an array for multiple final recommendations
  const [finalRecommendations, setFinalRecommendations] = useState<Recommendation[] | null>(null);
  const [showingFinalRecommendationsSection, setShowingFinalRecommendationsSection] = useState(false); // Controls visibility of the entire final recommendations section

  // New state for managing selected movie details from the final 5
  // If null, show the list of 5; if not null, show details for this movie.
  const [selectedRecommendedMovie, setSelectedRecommendedMovie] = useState<Recommendation | null>(null);
  
  // State for card fling animation after decision
  const [cardAnimation, setCardAnimation] = useState<'none' | 'swipeLeft' | 'swipeRight'>('none');

  // States for interactive drag animation (these will be updated by refs, then trigger re-render)
  const [swipeTranslateX, setSwipeTranslateX] = useState(0);
  const [swipeRotate, setSwipeRotate] = useState(0);

  // Refs to hold mutable values for global event listeners (prevent stale closures)
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef<number | null>(null);
  const cardAnimationRef = useRef<'none' | 'swipeLeft' | 'swipeRight'>('none'); // To check if animation is active
  
  // These refs will be used by global listeners to *read* the latest state without being in their dependencies
  const currentIndexRef = useRef(currentIndex); 
  const movieStackRef = useRef(movieStack);
  const likedMoviesRef = useRef(likedMovies);
  const dislikedMoviesRef = useRef(dislikedMovies);
  
  // Update refs when state changes
  useEffect(() => {
    cardAnimationRef.current = cardAnimation;
    currentIndexRef.current = currentIndex;
    movieStackRef.current = movieStack;
    likedMoviesRef.current = likedMovies;
    dislikedMoviesRef.current = dislikedMovies;
  }, [cardAnimation, currentIndex, movieStack, likedMovies, dislikedMovies]);


  const cardContainerRef = useRef<HTMLDivElement>(null); // Ref for the draggable div
  const fetchInFlightRef = useRef(false); // Guards against duplicate concurrent fetches (e.g. React dev-mode double-invoke)

  const fetchInitialMovies = useCallback(async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    setIsLoadingMovies(true);
    setError(null);
    try {
      // getInitialMovies calls our /api/openrouter serverless route and falls
      // back to MOCK_MOVIES internally if that call fails for any reason.
      const fetchedMovies = await getInitialMovies(languages, previouslySeenCanonicalIds);
      setMovieStack(fetchedMovies.slice(0, 10)); // Ensure exactly 10 movies
    } catch (err) {
      console.error("Failed to fetch initial movies:", err);
      setError("Failed to load movies. Please try again.");
      // Fallback to shuffled mock data on API error as well
      const availableMockMovies = MOCK_MOVIES.filter(movie => !previouslySeenCanonicalIds.has(movie.canonicalId));
      setMovieStack(shuffleArray(availableMockMovies).slice(0,10)); // Changed to 10 movies
    } finally {
      setIsLoadingMovies(false);
      fetchInFlightRef.current = false;
    }
  }, [languages, previouslySeenCanonicalIds]); // Dependency on previouslySeenCanonicalIds

  const fetchFinalRecommendation = useCallback(async () => {
    setIsLoadingRecommendation(true);
    setError(null);
    try {
      // getFinalRecommendation calls our /api/openrouter serverless route and
      // falls back to mock recommendations internally if that call fails.
      const fetchedRecommendations = await getFinalRecommendation(likedMoviesRef.current, dislikedMoviesRef.current, languages);
      setFinalRecommendations(fetchedRecommendations);
      setShowingFinalRecommendationsSection(true);

      // Report all movies from this quick swipe session as seen by their canonical ID
      const newlySeenCanonicalIds = [...likedMoviesRef.current.map(m => m.canonicalId), ...dislikedMoviesRef.current.map(m => m.canonicalId)];
      onMoviesProcessed(newlySeenCanonicalIds);

    } catch (err) {
      console.error("Failed to fetch final recommendation:", err);
      setError("Failed to get your movie match. Please try again or restart.");
      setFinalRecommendations([
        // Fallback to a single mock recommendation if all else fails
        {
          topMatch: "A Great Movie for You!",
          whyItMatches: "This is a fantastic pick that generally aligns with popular choices and broad appeal.",
          streamingPlatforms: PLACEHOLDER_STREAMING_PLATFORMS,
          matchPercentage: 90,
          imdbRating: '7.8/10',
          duration: '1h 50m',
          fullCasting: ['Lead Actor', 'Supporting Actor'],
          availableLanguages: ['English'],
          canonicalId: 'a-great-movie-for-you',
        },
      ]);
      setShowingFinalRecommendationsSection(true);

      // Report movies as seen even if recommendation failed, to prevent re-suggesting them
      const newlySeenCanonicalIds = [...likedMoviesRef.current.map(m => m.canonicalId), ...dislikedMoviesRef.current.map(m => m.canonicalId)];
      onMoviesProcessed(newlySeenCanonicalIds);
    } finally {
      setIsLoadingRecommendation(false);
    }
  }, [languages, onMoviesProcessed]); // Dependency on onMoviesProcessed

  useEffect(() => {
    fetchInitialMovies();
  }, [fetchInitialMovies]);

  useEffect(() => {
    // If all initial movies are swiped, fetch the final recommendation
    if (!isLoadingMovies && !error && movieStack.length > 0 && currentIndex === movieStack.length && !showingFinalRecommendationsSection && !isLoadingRecommendation) {
      fetchFinalRecommendation();
    }
  }, [currentIndex, movieStack.length, isLoadingMovies, error, showingFinalRecommendationsSection, isLoadingRecommendation, fetchFinalRecommendation]);

  // Unified swipe handler (stable function)
  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (currentIndexRef.current < movieStackRef.current.length) {
      const currentMovie = movieStackRef.current[currentIndexRef.current];
      setCardAnimation(direction === 'left' ? 'swipeLeft' : 'swipeRight');

      // Reset inline drag transforms explicitly when a button or final drag triggers a swipe
      setSwipeTranslateX(0);
      setSwipeRotate(0);

      setTimeout(() => {
        if (direction === 'right') {
          setLikedMovies((prev) => [...prev, currentMovie]);
        } else {
          setDislikedMovies((prev) => [...prev, currentMovie]);
        }
        setCurrentIndex((prev) => prev + 1);
        setCardAnimation('none'); // Reset animation
      }, 300); // Duration of the swipe animation (must match CSS animation duration)
    }
  }, []); // Empty dependencies to make handleSwipe stable

  // Global pointer move handler (stable function, uses refs)
  const onPointerMoveGlobal = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current || dragStartXRef.current === null || cardAnimationRef.current !== 'none') return;
    const deltaX = e.clientX - (dragStartXRef.current || 0);
    setSwipeTranslateX(deltaX); // Directly update state to trigger re-render
    setSwipeRotate(deltaX * ROTATION_FACTOR); // Directly update state to trigger re-render
    e.preventDefault(); // Prevent text selection/scrolling during drag
  }, []); // Empty dependencies, relies on useState setters and refs

  // Global pointer up handler (stable function, uses refs)
  const onPointerUpGlobal = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current || dragStartXRef.current === null) return;
    
    isDraggingRef.current = false;
    // Release pointer capture if it was set
    if (cardContainerRef.current) {
        cardContainerRef.current.releasePointerCapture(e.pointerId);
    }

    // Calculate final deltaX from the up event's clientX
    const finalDeltaX = e.clientX - (dragStartXRef.current || 0);

    if (Math.abs(finalDeltaX) > SWIPE_THRESHOLD) {
      const direction = finalDeltaX > 0 ? 'right' : 'left';
      handleSwipe(direction); // Use the stable handleSwipe
    } else {
      // Snap back if not swiped far enough
      setSwipeTranslateX(0);
      setSwipeRotate(0);
    }

    dragStartXRef.current = null; // Reset drag start position
    
    window.removeEventListener('pointermove', onPointerMoveGlobal);
    window.removeEventListener('pointerup', onPointerUpGlobal);
  }, [handleSwipe, onPointerMoveGlobal]); // Dependencies: handleSwipe and onPointerMoveGlobal are also stable

  // Pointer event handlers for drag interaction
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || cardAnimationRef.current !== 'none') return; // Only left click or touch, and not mid-animation
    
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    setSwipeTranslateX(0); // Ensure clean start for drag
    setSwipeRotate(0);     // Ensure clean start for drag
    e.currentTarget.setPointerCapture(e.pointerId); // Capture pointer events for consistent drag

    // Add global listeners
    window.addEventListener('pointermove', onPointerMoveGlobal);
    window.addEventListener('pointerup', onPointerUpGlobal);
  }, [onPointerMoveGlobal, onPointerUpGlobal]); // Dependencies for onPointerDown


  const handleSelectRecommendation = useCallback((recommendation: Recommendation) => {
    setSelectedRecommendedMovie(recommendation);
  }, []);

  // Dynamic onBack handler for PageLayout based on current view in QuickSwipe
  const pageLayoutOnBack = selectedRecommendedMovie
    ? () => setSelectedRecommendedMovie(null) // If a movie is selected, go back to the list of 5
    : onBack; // If on the list of 5, use the parent's onBack (to Language Selection)


  const currentMovie = movieStack[currentIndex];
  const isFinishedSwiping = currentIndex >= movieStack.length;

  // Calculate opacity for LIKE/DISLIKE overlays
  const likeOpacity = swipeTranslateX > 0 ? Math.min(swipeTranslateX / SWIPE_THRESHOLD, 1) : 0;
  const dislikeOpacity = swipeTranslateX < 0 ? Math.min(Math.abs(swipeTranslateX) / SWIPE_THRESHOLD, 1) : 0;

  // Determine if buttons should be disabled
  const areButtonsDisabled = isLoadingMovies || isFinishedSwiping || cardAnimation !== 'none';

  return (
    <PageLayout
      title={showingFinalRecommendationsSection ? "Your Perfect Movie Match!" : "Quick Swipe Refiner"}
      description={showingFinalRecommendationsSection
        ? (selectedRecommendedMovie
            ? "Dive deeper into the details of your selected movie match!"
            : "Drumroll, please! Based on your unique preferences, here are your personalized cinematic recommendations."
          )
        : "Review these 10 diverse movie choices and swipe right for 'Like/Seen' (✨) or left for 'Dislike/Not Interested' (❌)."
      }
      onBack={showingFinalRecommendationsSection ? pageLayoutOnBack : onBack} // Pass dynamic onBack
    >
      <style>{`
        @keyframes swipeLeft {
          from { transform: translateX(0) rotate(0deg); opacity: 1; }
          to { transform: translateX(-150%) rotate(-15deg); opacity: 0; }
        }
        @keyframes swipeRight {
          from { transform: translateX(0) rotate(0deg); opacity: 1; }
          to { transform: translateX(150%) rotate(15deg); opacity: 0; }
        }
        .swipe-left-animation {
          animation: swipeLeft 0.3s ease-out forwards;
        }
        .swipe-right-animation {
          animation: swipeRight 0.3s ease-out forwards;
        }
        .fade-in {
          animation: fadeIn 0.5s ease-in forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      
      {isLoadingMovies && !showingFinalRecommendationsSection && <LoadingSpinner />}
      {error && <p className="text-glow-red mb-4">{error}</p>}

      <div className="flex flex-col flex-grow justify-between items-center w-full">
        {/* Movie Swiping Section */}
        {!isLoadingMovies && !showingFinalRecommendationsSection && !error && movieStack.length === 0 && (
          <p className="text-white/70">No movies to display. Please go back and try again.</p>
        )}

        {!isLoadingMovies && !showingFinalRecommendationsSection && !isFinishedSwiping && currentMovie && (
          <>
            <div
              ref={cardContainerRef}
              className="relative w-full max-w-sm mx-auto flex-grow max-h-[50vh] min-h-[350px] mb-6 flex items-center justify-center"
              style={{
                transform: `translateX(${swipeTranslateX}px) rotate(${swipeRotate}deg)`,
                // Transition for snap-back (when not dragging or flinging off)
                transition: cardAnimation !== 'none' ? 'none' : 'transform 0.3s ease-out', // Only transition for snap-back
                cursor: isDraggingRef.current ? 'grabbing' : 'grab',
                touchAction: 'none', // Prevent browser scrolling during drag
              }}
              onPointerDown={onPointerDown}
            >
              {/* LIKE overlay */}
              <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                  style={{
                      opacity: likeOpacity,
                      transform: `scale(${1 + Math.min(swipeTranslateX / 300, 0.3)})`, // Grow slightly
                      transition: 'opacity 0.1s ease-out, transform 0.1s ease-out'
                  }}
              >
                  <span className="text-glow-green text-5xl font-extrabold drop-shadow-lg opacity-80">LIKE ✨</span>
              </div>
              {/* DISLIKE overlay */}
              <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                  style={{
                      opacity: dislikeOpacity,
                      transform: `scale(${1 + Math.min(Math.abs(swipeTranslateX) / 300, 0.3)})`, // Grow slightly
                      transition: 'opacity 0.1s ease-out, transform 0.1s ease-out'
                  }}
              >
                  <span className="text-glow-red text-5xl font-extrabold drop-shadow-lg opacity-80">DISLIKE ❌</span>
              </div>

              <div className={`absolute w-full h-full ${cardAnimation === 'swipeLeft' ? 'swipe-left-animation' : cardAnimation === 'swipeRight' ? 'swipe-right-animation' : ''}`}>
                <MovieCard movie={currentMovie} />
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex justify-center gap-6 w-full max-w-sm mb-8">
              <Button 
                onClick={() => handleSwipe('left')} 
                disabled={areButtonsDisabled}
                className="bg-red-700/60 border-red-500 text-white shadow-red-500/30 hover:bg-red-600/80 hover:shadow-red-500/50 flex-1"
              >
                ❌ Dislike
              </Button>
              <Button 
                onClick={() => handleSwipe('right')} 
                disabled={areButtonsDisabled}
                className="bg-green-700/60 border-green-500 text-white shadow-green-500/30 hover:bg-green-600/80 hover:shadow-green-500/50 flex-1"
              >
                LIKE ✨
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Final Recommendation Section */}
      {isFinishedSwiping && !showingFinalRecommendationsSection && isLoadingRecommendation && (
         <LoadingSpinner />
      )}

      {!isLoadingRecommendation && showingFinalRecommendationsSection && finalRecommendations && (
        <div className="flex flex-col items-center fade-in w-full max-w-lg mx-auto">
          {selectedRecommendedMovie ? (
            // Detailed View of a single selected recommendation
            <div className="w-full">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-neon-blue mb-4 drop-shadow-lg animate-pulse">
                🍿 {selectedRecommendedMovie.topMatch} — {selectedRecommendedMovie.matchPercentage}% Match!
              </h2>
              
              {/* IMDb Rating & Duration */}
              <div className="flex flex-row justify-center gap-4 w-full mb-6">
                {selectedRecommendedMovie.imdbRating && (
                  <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 flex-1 text-center border border-white/20 shadow-lg">
                    <h3 className="text-xl font-semibold mb-2">IMDb Rating:</h3>
                    <p className="text-glow-green text-2xl font-bold">{selectedRecommendedMovie.imdbRating}</p>
                  </div>
                )}
                {selectedRecommendedMovie.duration && (
                  <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 flex-1 text-center border border-white/20 shadow-lg">
                    <h3 className="text-xl font-semibold mb-2">Duration:</h3>
                    <p className="text-neon-blue text-2xl font-bold">{selectedRecommendedMovie.duration}</p>
                  </div>
                )}
              </div>

              {/* Why it fits */}
              <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 mb-6 w-full border border-white/20 shadow-lg">
                <h3 className="text-xl font-semibold mb-2">Why it fits:</h3>
                <p className="text-white/80 leading-relaxed">
                  {selectedRecommendedMovie.whyItMatches}
                </p>
              </div>

              {/* Full Casting */}
              {selectedRecommendedMovie.fullCasting && selectedRecommendedMovie.fullCasting.length > 0 && (
                <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 mb-6 w-full border border-white/20 shadow-lg">
                  <h3 className="text-xl font-semibold mb-2">Starring:</h3>
                  <p className="text-white/80">
                    {selectedRecommendedMovie.fullCasting.join(', ')}
                  </p>
                </div>
              )}

              {/* Available Languages */}
              {selectedRecommendedMovie.availableLanguages && selectedRecommendedMovie.availableLanguages.length > 0 && (
                <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 mb-6 w-full border border-white/20 shadow-lg">
                  <h3 className="text-xl font-semibold mb-2">Available in:</h3>
                  <p className="text-white/80">
                    {selectedRecommendedMovie.availableLanguages.join(', ')}
                  </p>
                </div>
              )}

              {/* Available on */}
              <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 mb-8 w-full border border-white/20 shadow-lg">
                <h3 className="text-xl font-semibold mb-2">📺 Available on:</h3>
                <ul className="list-disc list-inside text-left text-white/80">
                  {selectedRecommendedMovie.streamingPlatforms.length > 0 ? (
                    selectedRecommendedMovie.streamingPlatforms.map((platform, index) => (
                      <li key={index} className="py-1">
                        {platform}
                      </li>
                    ))
                  ) : (
                    <li>No streaming platforms suggested.</li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            // List of 5 recommendations
            <div className="w-full">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-neon-blue mb-6 drop-shadow-lg text-center">
                Your Top 5 Movie Matches!
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                {finalRecommendations.map((rec, index) => (
                  <button
                    key={rec.canonicalId || index} // Use canonicalId for key if available, fallback to index
                    onClick={() => handleSelectRecommendation(rec)}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl
                               bg-white/5 backdrop-blur-sm border border-white/20
                               transition-all duration-300 ease-in-out cursor-pointer text-center
                               hover:bg-white/10 hover:border-white/40 hover:scale-[1.02] active:scale-[0.98]
                               shadow-lg hover:shadow-neon-blue/20"
                  >
                    <h3 className="text-2xl font-bold text-white mb-2 leading-tight">
                      {rec.topMatch}
                    </h3>
                    <p className="text-glow-green text-xl font-semibold">
                      {rec.matchPercentage}% Match
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button onClick={onRestart} className="mt-8">
            Start Over: Find Another Movie!
          </Button>
        </div>
      )}
    </PageLayout>
  );
};

export default QuickSwipe;