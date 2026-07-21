import React from 'react';
import { Movie } from '../types';

interface MovieCardProps {
  movie: Movie;
  // onSwipe: (direction: 'left' | 'right') => void; // Removed unused prop
}

// FIX: Removed onSwipe from component props as it's no longer used.
const MovieCard: React.FC<MovieCardProps> = ({ movie }) => {
  return (
    <div
      className="relative w-full h-full bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden
                 shadow-2xl border border-white/20 p-6 transition-all duration-300 ease-in-out
                 flex flex-col justify-center items-center text-center h-full" // Changed justify-between to justify-center, removed max-w-sm mx-auto
    >
      <div className="w-full flex flex-col items-center justify-center flex-grow">
        <h3 className="text-3xl font-extrabold text-neon-blue mb-3 leading-tight drop-shadow-lg">
          {movie.title}
        </h3>
        <p className="text-lg text-white/80 mb-2 font-medium">{movie.director}</p>
        <p className="text-sm text-white/60 italic mb-4">{movie.genres.join(', ')}</p>

        <div className="border-t border-b border-white/10 py-4 w-full mb-4">
          <h4 className="text-md font-semibold text-white mb-2">Starring:</h4>
          <ul className="text-white/70 text-sm space-y-1">
            {movie.actors.map((actor, index) => (
              <li key={index}>{actor}</li>
            ))}
          </ul>
        </div>

        <div className="bg-white/10 rounded-full px-4 py-2 text-lg font-bold text-glow-green shadow-md shadow-glow-green/20">
          IMDb: {movie.imdbRating}
        </div>
      </div>
    </div>
  );
};

export default MovieCard;