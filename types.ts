export interface GenrePill {
  id: string;
  name: string;
  emoji: string;
}

export interface LanguagePill {
  id: string;
  name: string;
  // emoji: string; // Removed emoji property for language pills
}

export interface VibeCard {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

export interface Movie {
  id: string; // Original ID from Gemini (if any)
  canonicalId: string; // Client-generated, consistent ID for tracking (e.g., "movie-title-lowercase")
  title: string;
  // posterUrl: string; // Removed as per request
  genres: string[];
  director: string;
  actors: string[]; // Added: List of main actors
  imdbRating: string; // Added: IMDb rating, e.g., "8.2/10"
  releaseYear: number; // Added: Release year for the movie
}

export interface Recommendation {
  id?: string; // Optional: Retain Gemini's ID if provided, but canonicalId is for tracking
  canonicalId: string; // Client-generated, consistent ID for tracking
  topMatch: string;
  matchPercentage: number; // Added for the final recommendation output
  whyItMatches: string;
  streamingPlatforms: string[];
  imdbRating: string; // Added: IMDb rating for the final recommendation
  duration: string;    // Added: Movie duration for the final recommendation
  fullCasting: string[]; // Added: Full list of main actors for the final recommendation
  availableLanguages: string[]; // Added: Available languages for the final recommendation
  // posterUrl?: string; // Optional: for the real movie poster from Google Search - REMOVED
}

export enum AppPages {
  LanguageSelection,
  QuickSwipeRefiner,
  FinalRecommendationDisplay,
}