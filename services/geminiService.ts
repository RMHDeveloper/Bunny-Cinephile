import { Movie, Recommendation } from '../types';
import { LANGUAGE_PILLS, GENRE_PILLS, VIBE_CARDS } from '../constants';

// `languages`/`genres` arrive as constants-file ids (e.g. 'tamil', 'sci-fi'),
// not display names - resolve to names the model can actually reason about.
function toLanguageNames(languageIds: string[]): string[] {
  return languageIds.map(id => LANGUAGE_PILLS.find(p => p.id === id)?.name ?? id);
}

function toGenreNames(genreIds: string[]): string[] {
  return genreIds.map(id => GENRE_PILLS.find(p => p.id === id)?.name ?? id);
}

// A mood id can in theory be null (e.g. called before Mood Check ever runs);
// App.tsx's flow guard makes that unreachable in practice, but handle it
// defensively rather than assume.
function toMoodDescriptor(moodId: string | null): string | null {
  if (!moodId) return null;
  const vibe = VIBE_CARDS.find(v => v.id === moodId);
  if (!vibe) return moodId;
  return `${vibe.name} (${vibe.description})`;
}

// The OpenRouter call and its API key now live server-side in api/openrouter.ts —
// calling OpenRouter directly from the browser was both stalling consistently
// (likely client-side network/proxy interference) and shipping the API key
// in the public JS bundle.
const API_ROUTE = '/api/openrouter';

// Pulls the first balanced JSON array/object out of a model response, tolerating
// markdown code fences or stray commentary that free-tier models sometimes add.
function parseJsonFromText<T>(text: string): T {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const start = candidate.search(/[[{]/);
  const end = Math.max(candidate.lastIndexOf(']'), candidate.lastIndexOf('}'));
  const jsonSlice = start !== -1 && end !== -1 ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(jsonSlice);
}

async function callOpenRouterJSON<T>(prompt: string): Promise<T> {
  const response = await fetch(API_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.content) {
    throw new Error(data?.error || `Request to ${API_ROUTE} failed (${response.status}).`);
  }

  return parseJsonFromText<T>(data.content);
}

// Utility function to generate a consistent, canonical ID from a movie title
export function generateCanonicalId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, '');
}

// Modified getInitialMovies to accept excludeCanonicalIds
export const getInitialMovies = async (
  languages: string[],
  genres: string[],
  mood: string | null,
  excludeCanonicalIds: Set<string>,
): Promise<Movie[]> => {
  // Kept deliberately short: combining language + genre + mood into one
  // request already gives free-tier reasoning models a lot to juggle, and a
  // verbose multi-sentence clause per constraint measurably increases how
  // long they spend "thinking" before answering. A rigid 5-category movie
  // breakdown (2 popular, 2 pre-2005, etc.) used to sit here too - dropped
  // because it was the single biggest driver of that reasoning time.
  const languageNames = toLanguageNames(languages);
  const languageClause = languageNames.length > 0
    ? `Language (required): every movie must be originally in ${languageNames.join(' or ')}.`
    : '';

  const genreNames = toGenreNames(genres);
  const genreClause = genreNames.length > 0
    ? `Genres (preference, not required): favor ${genreNames.join(', ')}.`
    : '';

  const moodDescriptor = toMoodDescriptor(mood);
  const moodClause = moodDescriptor
    ? `Mood (preference, not required): ${moodDescriptor}.`
    : '';

  // Modify exclude clause to target canonical IDs (titles)
  const excludeClause = excludeCanonicalIds.size > 0 ? `Exclude: ${Array.from(excludeCanonicalIds).join(', ')}.` : '';

  const promptHeader = [languageClause, genreClause, moodClause, excludeClause].filter(Boolean).join(' ');

  const prompt = `${promptHeader}

Suggest 10 movies with a good mix of well-known and lesser-known titles, spanning different eras and styles.

For each: title, primary genres, a plausible director, 3 main actors, IMDb rating (e.g. "8.2/10"), release year, original language.

Return ONLY a JSON array of exactly 10 objects, each with this exact shape:
{ "id": string, "title": string, "genres": string[], "director": string, "actors": string[], "imdbRating": string, "releaseYear": number, "language": string }
Ensure ids are unique.`;

  let movies: Movie[] = await callOpenRouterJSON<Movie[]>(prompt);

  // Add canonicalId and client-side filter to ensure no excluded movies are returned (robust fallback)
  movies = movies.map(movie => ({
    ...movie,
    canonicalId: generateCanonicalId(movie.title),
    id: movie.id || `movie-${generateCanonicalId(movie.title)}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, // Ensure a unique internal ID
  }));
  movies = movies.filter(movie => !excludeCanonicalIds.has(movie.canonicalId));

  if (languageNames.length > 0) {
    const languageMatched = movies.filter(movie =>
      languageNames.some(name => movie.language?.toLowerCase().includes(name.toLowerCase()))
    );
    if (languageMatched.length > 0) {
      movies = languageMatched;
    } else {
      console.warn(`getInitialMovies: model ignored the language requirement (${languageNames.join(', ')}); returning its response unfiltered.`);
    }
  }

  if (genreNames.length > 0) {
    const anyGenreOverlap = movies.some(movie =>
      movie.genres?.some(g => genreNames.some(name => g.toLowerCase().includes(name.toLowerCase())))
    );
    if (!anyGenreOverlap) {
      console.warn(`getInitialMovies: none of the returned movies overlap the requested genres (${genreNames.join(', ')}); this can be normal (adjacent genres) but flagging for visibility.`);
    }
  }

  return movies;
};

export const getFinalRecommendation = async (
  likedMovies: Movie[],
  dislikedMovies: Movie[],
  languages: string[],
  genres: string[],
  mood: string | null,
): Promise<Recommendation[]> => { // Changed return type to Promise<Recommendation[]>
  const likedTitles = likedMovies.map(m => m.title).join(', ');
  const dislikedTitles = dislikedMovies.map(m => m.title).join(', ');

  // Kept short for the same reason as getInitialMovies: verbose clauses
  // measurably increase how long free-tier reasoning models take to answer.
  const languageNames = toLanguageNames(languages);
  const languageClause = languageNames.length > 0
    ? `Language (required): every movie must be originally in ${languageNames.join(' or ')}.`
    : '';

  const explicitGenreNames = toGenreNames(genres);
  const explicitGenreClause = explicitGenreNames.length > 0
    ? `Genre picked up front (preference, not required): ${explicitGenreNames.join(', ')}.`
    : '';

  const moodDescriptor = toMoodDescriptor(mood);
  const moodClause = moodDescriptor
    ? `Mood picked up front (preference, not required): ${moodDescriptor}.`
    : '';

  // Extract unique genres, directors, and actors from liked/disliked movies
  const likedGenres = [...new Set(likedMovies.flatMap(m => m.genres))].join(', ') || 'none';
  const likedDirectors = [...new Set(likedMovies.map(m => m.director))].join(', ') || 'none';
  const likedActors = [...new Set(likedMovies.flatMap(m => m.actors))].join(', ') || 'none';

  const dislikedGenres = [...new Set(dislikedMovies.flatMap(m => m.genres))].join(', ') || 'none';
  const dislikedDirectors = [...new Set(dislikedMovies.map(m => m.director))].join(', ') || 'none';
  const dislikedActors = [...new Set(dislikedMovies.flatMap(m => m.actors))].join(', ') || 'none';

  const promptHeader = [languageClause, explicitGenreClause, moodClause].filter(Boolean).join(' ');

  const prompt = `${promptHeader}

Liked/seen: ${likedTitles || 'none'}. Disliked: ${dislikedTitles || 'none'}.
Liked genres: ${likedGenres}. Liked directors: ${likedDirectors}. Liked actors: ${likedActors}.
Avoid genres: ${dislikedGenres}. Avoid directors: ${dislikedDirectors}. Avoid actors: ${dislikedActors}.

Recommend 5 distinct movies that best fit the liked characteristics above and avoid the disliked ones, while respecting the language/genre/mood preferences at the top.

For each: TOP MATCH title, a short WHY IT MATCHES explanation (2-3 sentences, referencing specific liked/disliked traits), match percentage (number, e.g. 98.5), a placeholder list of streaming platforms (Netflix, Prime Video, Disney+, Max), IMDb rating (e.g. "8.2/10"), duration (e.g. "2h 30m"), 5-7 main cast, and 3-5 languages it's available in.

Return ONLY a JSON array of exactly 5 objects, each with this exact shape:
{ "topMatch": string, "whyItMatches": string, "matchPercentage": number, "streamingPlatforms": string[], "imdbRating": string, "duration": string, "fullCasting": string[], "availableLanguages": string[] }`;

  let recommendations: Recommendation[] = await callOpenRouterJSON<Recommendation[]>(prompt);
  recommendations = recommendations.map((rec) => ({
    ...rec,
    canonicalId: generateCanonicalId(rec.topMatch),
    id: rec.id || `rec-${generateCanonicalId(rec.topMatch)}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, // Ensure unique internal ID
  }));

  if (languageNames.length > 0) {
    const languageMatched = recommendations.filter(rec =>
      rec.availableLanguages?.some(lang => languageNames.some(name => lang.toLowerCase().includes(name.toLowerCase())))
    );
    if (languageMatched.length > 0) {
      recommendations = languageMatched;
    } else {
      console.warn(`getFinalRecommendation: model ignored the language requirement (${languageNames.join(', ')}); returning its response unfiltered.`);
    }
  }

  return recommendations;
};
