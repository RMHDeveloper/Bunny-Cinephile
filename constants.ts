import { GenrePill, VibeCard, LanguagePill } from './types';

export const GENRE_PILLS: GenrePill[] = [
  { id: 'sci-fi', name: 'Sci-Fi', emoji: '🚀' },
  { id: 'action', name: 'Action', emoji: '💥' },
  { id: 'comedy', name: 'Comedy', emoji: '😂' },
  { id: 'horror', name: 'Horror', emoji: '👻' },
  { id: 'animation', name: 'Animation', emoji: '🎨' },
  { id: 'romance', name: 'Romance', emoji: '💕' },
  { id: 'drama', name: 'Drama', emoji: '🎭' },
  { id: 'fantasy', name: 'Fantasy', emoji: '🪄' },
  { id: 'thriller', name: 'Thriller', emoji: '🔪' },
  { id: 'documentary', name: 'Documentary', emoji: '🎥' },
  { id: 'indie', name: 'Indie', emoji: '💡' },
];

// Removed SVG_LANGUAGE_ICON and emoji property from LANGUAGE_PILLS
export const LANGUAGE_PILLS: LanguagePill[] = [
  { id: 'tamil', name: 'Tamil' },
  { id: 'malayalam', name: 'Malayalam' },
  { id: 'telugu', name: 'Telugu' },
  { id: 'kannada', name: 'Kannada' },
  { id: 'hindi', name: 'Hindi' },
  { id: 'english', name: 'English' },
];


export const VIBE_CARDS: VibeCard[] = [
  { id: 'chill', name: 'Chill', emoji: '😌', description: 'Relaxed and easygoing.' },
  { id: 'intense', name: 'Intense', emoji: '⚡', description: 'Gripping and exciting.' },
  { id: 'heartwarming', name: 'Heartwarming', emoji: '🥰', description: 'Uplifting and comforting.' },
  { id: 'mind-bending', name: 'Mind-Bending', emoji: '🤯', description: 'Thought-provoking and complex.' },
];

export const PLACEHOLDER_STREAMING_PLATFORMS: string[] = [
  'Netflix',
  'Prime Video',
  'Disney+',
  'Max',
];