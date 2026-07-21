import { Movie, Recommendation } from '../types';
import { PLACEHOLDER_STREAMING_PLATFORMS } from '../constants';

// Ensure API_KEY is set in your environment (an OpenRouter key, e.g. sk-or-v1-...)
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable is not set.");
  // In a real app, you might want to throw an error or handle this more gracefully
  // For this example, we'll proceed but operations will fail.
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Pinned to specific free models instead of the "openrouter/free" auto-router,
// which was inconsistently routing requests to slow reasoning models and even
// a content-safety classifier unsuited for generating movie data. Listed in
// priority order; OpenRouter fails over to the next one automatically.
const OPENROUTER_MODELS = [
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

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

const REQUEST_TIMEOUT_MS = 15000;

async function callOpenRouterJSON<T>(prompt: string): Promise<T> {
  if (!API_KEY) {
    throw new Error("OpenRouter API Key is missing. Please ensure process.env.API_KEY is set.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
        'X-Title': 'Bunny Cinephile',
      },
      body: JSON.stringify({
        models: OPENROUTER_MODELS,
        messages: [
          {
            role: 'system',
            content: 'You are a JSON API. Respond with ONLY valid JSON matching the shape requested by the user. No markdown, no code fences, no commentary before or after the JSON.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`OpenRouter request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenRouter API.');
  }

  return parseJsonFromText<T>(content);
}

// Utility function to generate a consistent, canonical ID from a movie title
export function generateCanonicalId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, '');
}

// Utility function to shuffle an array
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Swap elements
  }
  return shuffled;
}

// Modified getInitialMovies to accept excludeCanonicalIds
export const getInitialMovies = async (languages: string[], excludeCanonicalIds: Set<string>): Promise<Movie[]> => {
  try {
    const languageClause = languages.length > 0 ? `with a strong preference for content in ${languages.join(' or ')} languages` : 'with no specific language preference';
    // Modify exclude clause to target canonical IDs (titles)
    const excludeClause = excludeCanonicalIds.size > 0 ? `Also, explicitly exclude any movies with the following titles or very similar titles that match these canonical IDs (e.g., from previously seen films): ${Array.from(excludeCanonicalIds).join(', ')}. Do not suggest these titles.` : '';

    const prompt = `Suggest a list of 10 movies based on the following criteria, ${languageClause}. ${excludeClause}
1.  **2 Popular Movies**: Widely recognized and highly acclaimed.
2.  **2 Unpopular but Good Movies**: Lesser-known gems with strong critical reception but perhaps limited mainstream appeal.
3.  **2 Movies Released Before 2005**: Classic or influential films from an earlier era.
4.  **2 Movies Released Before 2000**: Older, significant films that stood the test of time.
5.  **2 Movies from Different, Distinct Categories**: These should offer unique genres or storytelling approaches, ensuring diversity from the above categories.

    For each movie, provide its title, primary genres, a plausible director, a list of 3 main actors, an IMDb rating (e.g., "8.2/10"), and its release year.

    Return ONLY a JSON array of exactly 10 objects, each with this exact shape:
    { "id": string, "title": string, "genres": string[], "director": string, "actors": string[], "imdbRating": string, "releaseYear": number }
    Ensure ids are unique.`;

    let movies: Movie[] = await callOpenRouterJSON<Movie[]>(prompt);

    // Add canonicalId and client-side filter to ensure no excluded movies are returned (robust fallback)
    movies = movies.map(movie => ({
      ...movie,
      canonicalId: generateCanonicalId(movie.title),
      id: movie.id || `movie-${generateCanonicalId(movie.title)}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, // Ensure a unique internal ID
    }));
    movies = movies.filter(movie => !excludeCanonicalIds.has(movie.canonicalId));

    return movies;
  } catch (error) {
    console.error("Error fetching initial movies from OpenRouter API:", error);
    // You could return mock data or re-throw the error for UI to handle
    const availableMockMovies = MOCK_MOVIES.filter(movie => !excludeCanonicalIds.has(movie.canonicalId));
    return shuffleArray(availableMockMovies).slice(0,10);
  }
};

export const getFinalRecommendation = async (
  likedMovies: Movie[],
  dislikedMovies: Movie[],
  languages: string[],
): Promise<Recommendation[]> => { // Changed return type to Promise<Recommendation[]>
  try {
    const likedTitles = likedMovies.map(m => m.title).join(', ');
    const dislikedTitles = dislikedMovies.map(m => m.title).join(', ');
    const languageClause = languages.length > 0 ? `with a strong preference for content in ${languages.join(' or ')} languages` : 'with no specific language preference';

    // Extract unique genres, directors, and actors from liked/disliked movies
    const likedGenres = [...new Set(likedMovies.flatMap(m => m.genres))].join(', ') || 'none';
    const likedDirectors = [...new Set(likedMovies.map(m => m.director))].join(', ') || 'none';
    const likedActors = [...new Set(likedMovies.flatMap(m => m.actors))].join(', ') || 'none';

    const dislikedGenres = [...new Set(dislikedMovies.flatMap(m => m.genres))].join(', ') || 'none';
    const dislikedDirectors = [...new Set(dislikedMovies.map(m => m.director))].join(', ') || 'none';
    const dislikedActors = [...new Set(dislikedMovies.flatMap(m => m.actors))].join(', ') || 'none';


    const prompt = `Based on the user's explicit preferences and cinematic history:
    - Liked/Seen Movies: ${likedTitles || 'None'}
    - Disliked/Not Interested Movies: ${dislikedTitles || 'None'}
    - Language preference: ${languageClause}.

    Aggregated characteristics from liked movies to strongly consider for the recommendation:
    - Genres: ${likedGenres}
    - Directors: ${likedDirectors}
    - Main Actors/Key Talent: ${likedActors}

    Aggregated characteristics from disliked movies to consciously avoid in the recommendation:
    - Genres to avoid: ${dislikedGenres}
    - Directors to avoid: ${dislikedDirectors}
    - Main Actors/Key Talent to avoid: ${dislikedActors}

    Recommend the 5 *best and most distinct* movies that deeply align with the 'liked' characteristics (genres, directors, or actors/themes) and explicitly avoids the 'disliked' characteristics. Ensure each recommendation also respects the specified language preferences. Provide a variety in these 5 recommendations (e.g., from different genres, eras, or styles) while still fitting the overall taste.

    For *each* of the 5 recommended movies, provide:
    1. The title of the TOP MATCH movie.
    2. A short explanation (2-3 sentences) of WHY IT MATCHES the user's specific choices. This explanation MUST explicitly reference the alignment with liked genres, directors, or actors/themes, and/or the avoidance of disliked traits.
    3. A match percentage, e.g., 98.5 (as a number, not string).
    4. A placeholder list of WHERE TO STREAM from major platforms (Netflix, Prime Video, Disney+, Max).
    5. The IMDb rating of the movie (e.g., "8.2/10").
    6. The movie's duration in hours and minutes (e.g., "2h 30m").
    7. A list of the top 5-7 main actors/key casting for the movie.
    8. A list of 3-5 major languages the movie is available in.

    Return ONLY a JSON array of exactly 5 objects, each with this exact shape:
    { "topMatch": string, "whyItMatches": string, "matchPercentage": number, "streamingPlatforms": string[], "imdbRating": string, "duration": string, "fullCasting": string[], "availableLanguages": string[] }`;

    const recommendations: Recommendation[] = await callOpenRouterJSON<Recommendation[]>(prompt);
    return recommendations.map((rec, index) => ({
      ...rec,
      canonicalId: generateCanonicalId(rec.topMatch),
      id: rec.id || `rec-${generateCanonicalId(rec.topMatch)}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, // Ensure unique internal ID
    }));

  } catch (error) {
    console.error("Error fetching final recommendation from OpenRouter API:", error);
    // Return mock data for 5 recommendations on error
    return [
      {
        topMatch: "The Cinematic Gem!",
        whyItMatches: "A placeholder movie that perfectly fits your language preferences and swipe history.",
        streamingPlatforms: PLACEHOLDER_STREAMING_PLATFORMS,
        matchPercentage: 98,
        imdbRating: '8.5/10',
        duration: '2h 15m',
        fullCasting: ['Actor A', 'Actor B', 'Actor C'],
        availableLanguages: ['English', 'Spanish'],
        canonicalId: generateCanonicalId("The Cinematic Gem!"),
        id: `rec-${generateCanonicalId("The Cinematic Gem!")}-${Date.now()}-1`,
      },
      {
        topMatch: "Another Great Pick!",
        whyItMatches: "This one has themes and actors you enjoyed, with a fresh twist.",
        streamingPlatforms: PLACEHOLDER_STREAMING_PLATFORMS,
        matchPercentage: 92,
        imdbRating: '7.9/10',
        duration: '1h 55m',
        fullCasting: ['Actor D', 'Actor E', 'Actor F'],
        availableLanguages: ['English', 'French'],
        canonicalId: generateCanonicalId("Another Great Pick!"),
        id: `rec-${generateCanonicalId("Another Great Pick!")}-${Date.now()}-2`,
      },
      {
        topMatch: "Hidden Gem Discovery!",
        whyItMatches: "An underrated masterpiece aligning with your preferred genres and directors.",
        streamingPlatforms: PLACEHOLDER_STREAMING_PLATFORMS,
        matchPercentage: 88,
        imdbRating: '7.6/10',
        duration: '2h 05m',
        fullCasting: ['Actor G', 'Actor H'],
        availableLanguages: ['English', 'German'],
        canonicalId: generateCanonicalId("Hidden Gem Discovery!"),
        id: `rec-${generateCanonicalId("Hidden Gem Discovery!")}-${Date.now()}-3`,
      },
      {
        topMatch: "A Classic You'll Love!",
        whyItMatches: "Recalling your appreciation for older films, this timeless classic fits the bill.",
        streamingPlatforms: PLACEHOLDER_STREAMING_PLATFORMS,
        matchPercentage: 90,
        imdbRating: '8.1/10',
        duration: '2h 20m',
        fullCasting: ['Classic Actor X', 'Classic Actor Y'],
        availableLanguages: ['English'],
        canonicalId: generateCanonicalId("A Classic You'll Love!"),
        id: `rec-${generateCanonicalId("A Classic You'll Love!")}-${Date.now()}-4`,
      },
      {
        topMatch: "Unexpected Delight!",
        whyItMatches: "Based on subtle patterns in your likes, this offers a unique and enjoyable experience.",
        streamingPlatforms: PLACEHOLDER_STREAMING_PLATFORMS,
        matchPercentage: 85,
        imdbRating: '7.2/10',
        duration: '1h 40m',
        fullCasting: ['New Talent P', 'New Talent Q'],
        availableLanguages: ['English', 'Japanese'],
        canonicalId: generateCanonicalId("Unexpected Delight!"),
        id: `rec-${generateCanonicalId("Unexpected Delight!")}-${Date.now()}-5`,
      },
    ];
  }
};

// Mock data for development if API calls are not desired or fail
export const MOCK_MOVIES: Movie[] = [
  { id: '1', canonicalId: generateCanonicalId('Inception'), title: 'Inception', genres: ['Sci-Fi', 'Action', 'Thriller'], director: 'Christopher Nolan', actors: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page'], imdbRating: '8.8/10', releaseYear: 2010 },
  { id: '2', canonicalId: generateCanonicalId('Parasite'), title: 'Parasite', genres: ['Thriller', 'Drama', 'Comedy'], director: 'Bong Joon-ho', actors: ['Song Kang-ho', 'Choi Woo-shik', 'Park So-dam'], imdbRating: '8.5/10', releaseYear: 2019 },
  { id: '3', canonicalId: generateCanonicalId('Dune: Part Two'), title: 'Dune: Part Two', genres: ['Sci-Fi', 'Adventure', 'Drama'], director: 'Denis Villeneuve', actors: ['Timothée Chalamet', 'Zendaya', 'Rebecca Ferguson'], imdbRating: '8.7/10', releaseYear: 2024 },
  { id: '4', canonicalId: generateCanonicalId('Spirited Away'), title: 'Spirited Away', genres: ['Animation', 'Fantasy', 'Adventure'], director: 'Hayao Miyazaki', actors: ['Rumi Hiiragi', 'Miyu Irino', 'Mari Natsuki'], imdbRating: '8.6/10', releaseYear: 2001 },
  { id: '5', canonicalId: generateCanonicalId('Eternal Sunshine of the Spotless Mind'), title: 'Eternal Sunshine of the Spotless Mind', genres: ['Romance', 'Sci-Fi', 'Drama'], director: 'Michel Gondry', actors: ['Jim Carrey', 'Kate Winslet', 'Kirsten Dunst'], imdbRating: '8.3/10', releaseYear: 2004 },
  { id: '6', canonicalId: generateCanonicalId('Pulp Fiction'), title: 'Pulp Fiction', genres: ['Crime', 'Drama'], director: 'Quentin Tarantino', actors: ['John Travolta', 'Uma Thurman', 'Samuel L. Jackson'], imdbRating: '8.9/10', releaseYear: 1994 },
  { id: '7', canonicalId: generateCanonicalId('The Matrix'), title: 'The Matrix', genres: ['Sci-Fi', 'Action'], director: 'The Wachowskis', actors: ['Keanu Reeves', 'Laurence Fishburn', 'Carrie-Anne Moss'], imdbRating: '8.7/10', releaseYear: 1999 },
  { id: '8', canonicalId: generateCanonicalId('Forrest Gump'), title: 'Forrest Gump', genres: ['Drama', 'Romance'], director: 'Robert Zemeckis', actors: ['Tom Hanks', 'Robin Wright', 'Gary Sinise'], imdbRating: '8.8/10', releaseYear: 1994 },
  { id: '9', canonicalId: generateCanonicalId('Interstellar'), title: 'Interstellar', genres: ['Sci-Fi', 'Drama', 'Adventure'], director: 'Christopher Nolan', actors: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'], imdbRating: '8.7/10', releaseYear: 2014 },
  { id: '10', canonicalId: generateCanonicalId('La La Land'), title: 'La La Land', genres: ['Musical', 'Drama', 'Romance'], director: 'Damien Chazelle', actors: ['Ryan Gosling', 'Emma Stone', 'John Legend'], imdbRating: '7.9/10', releaseYear: 2016 },
  { id: '11', canonicalId: generateCanonicalId('The Lord of the Rings: The Fellowship of the Ring'), title: 'The Lord of the Rings: The Fellowship of the Ring', genres: ['Fantasy', 'Adventure'], director: 'Peter Jackson', actors: ['Elijah Wood', 'Ian McKellen', 'Orlando Bloom'], imdbRating: '8.8/10', releaseYear: 2001 },
  { id: '12', canonicalId: generateCanonicalId('Arrival'), title: 'Arrival', genres: ['Sci-Fi', 'Drama', 'Mystery'], director: 'Denis Villeneuve', actors: ['Amy Adams', 'Jeremy Renner', 'Forest Whitaker'], imdbRating: '7.9/10', releaseYear: 2016 },
  { id: '13', canonicalId: generateCanonicalId('Get Out'), title: 'Get Out', genres: ['Horror', 'Thriller', 'Mystery'], director: 'Jordan Peele', actors: ['Daniel Kaluuya', 'Allison Williams', 'Bradley Whitford'], imdbRating: '7.7/10', releaseYear: 2017 },
  { id: '14', canonicalId: generateCanonicalId('Coco'), title: 'Coco', genres: ['Animation', 'Family', 'Fantasy'], director: 'Lee Unkrich', actors: ['Anthony Gonzalez', 'Gael García Bernal', 'Benjamin Bratt'], imdbRating: '8.4/10', releaseYear: 2017 },
  { id: '15', canonicalId: generateCanonicalId('The Grand Budapest Hotel'), title: 'The Grand Budapest Hotel', genres: ['Comedy', 'Adventure', 'Drama'], director: 'Wes Anderson', actors: ['Ralph Fiennes', 'Tony Revolori', 'F. Murray Abraham'], imdbRating: '8.1/10', releaseYear: 2014 },
  { id: '16', canonicalId: generateCanonicalId('Blade Runner 2049'), title: 'Blade Runner 2049', genres: ['Sci-Fi', 'Drama', 'Mystery'], director: 'Denis Villeneuve', actors: ['Ryan Gosling', 'Harrison Ford', 'Ana de Armas'], imdbRating: '8.0/10', releaseYear: 2017 },
  { id: '17', canonicalId: generateCanonicalId('Amelie'), title: 'Amelie', genres: ['Comedy', 'Romance'], director: 'Jean-Pierre Jeunet', actors: ['Audrey Tautou', 'Mathieu Kassovitz', 'Jamel Debbouze'], imdbRating: '8.3/10', releaseYear: 2001 },
  { id: '18', canonicalId: generateCanonicalId('Shawshank Redemption'), title: 'Shawshank Redemption', genres: ['Drama'], director: 'Frank Darabont', actors: ['Tim Robbins', 'Morgan Freeman', 'Bob Gunton'], imdbRating: '9.3/10', releaseYear: 1994 },
  { id: '19', canonicalId: generateCanonicalId('Before Sunrise'), title: 'Before Sunrise', genres: ['Romance', 'Drama'], director: 'Richard Linklater', actors: ['Ethan Hawke', 'Julie Delpy'], imdbRating: '8.1/10', releaseYear: 1995 },
  { id: '20', canonicalId: generateCanonicalId('Moonlight'), title: 'Moonlight', genres: ['Drama'], director: 'Barry Jenkins', actors: ['Mahershala Ali', 'Naomie Harris', 'Trevante Rhodes'], imdbRating: '7.4/10', releaseYear: 2016 },
  { id: '21', canonicalId: generateCanonicalId('Whiplash'), title: 'Whiplash', genres: ['Drama', 'Music'], director: 'Damien Chazelle', actors: ['Miles Teller', 'J.K. Simmons', 'Melissa Benoist'], imdbRating: '8.5/10', releaseYear: 2014 },
  { id: '22', canonicalId: generateCanonicalId('Eternal Sunshine'), title: 'Eternal Sunshine', genres: ['Romance', 'Sci-Fi'], director: 'Michel Gondry', actors: ['Jim Carrey', 'Kate Winslet', 'Kirsten Dunst'], imdbRating: '8.3/10', releaseYear: 2004 },
];
