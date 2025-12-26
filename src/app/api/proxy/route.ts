import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for API responses
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // time to live in milliseconds
}

const cache = new Map<string, CacheEntry>();
const requestQueue = new Map<string, { timestamp: number; count: number }>();

// Enhanced rate limiting for different API providers
const API_RATE_LIMITS = {
  'coingecko.com': { maxRequests: 3, windowMs: 60000 }, // 3 requests per minute for CoinGecko only
  'default': { maxRequests: 30, windowMs: 60000 } // 30 requests per minute for other APIs (much more lenient)
};

// Clean expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key);
    }
  }
  
  // Also clean old rate limit entries
  for (const [key, entry] of requestQueue.entries()) {
    if (now - entry.timestamp > 120000) { // Clean entries older than 2 minutes
      requestQueue.delete(key);
    }
  }
}, 60000); // Clean every minute

// Enhanced rate limiting with API-specific limits (only strict for CoinGecko)
function isRateLimited(url: string): boolean {
  // Only apply strict rate limiting to CoinGecko
  if (!url.includes('coingecko.com')) {
    return false; // No rate limiting for non-CoinGecko APIs
  }
  
  const now = Date.now();
  const rateLimit = API_RATE_LIMITS['coingecko.com'];
  
  const entry = requestQueue.get(url);

  if (!entry) {
    requestQueue.set(url, { timestamp: now, count: 1 });
    return false;
  }

  // If more than the window time has passed, reset the counter
  if (now - entry.timestamp > rateLimit.windowMs) {
    requestQueue.set(url, { timestamp: now, count: 1 });
    return false;
  }

  // If we've made more requests than allowed in the time window, rate limit
  if (entry.count >= rateLimit.maxRequests) {
    return true;
  }

  entry.count++;
  return false;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const skipCache = searchParams.get('skipCache') === 'true';

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Validate that the URL is a valid URL
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL provided' },
      { status: 400 }
    );
  }

  // Check cache first (only for CoinGecko, unless skipCache is true)
  if (!skipCache && url.includes('coingecko.com')) {
    const cached = cache.get(url);
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
  }

  // Check rate limiting with specific error message (only for CoinGecko)
  if (isRateLimited(url)) {
    return NextResponse.json(
      { error: 'CoinGecko API rate limit exceeded. Please wait 1 minute before making another request. The free tier allows only 3 requests per minute.' },
      { status: 429 }
    );
  }

  try {
    console.log('Fetching URL:', url);
    
    // Add specific headers for better compatibility with APIs like CoinGecko
    const headers: HeadersInit = {
      'User-Agent': 'Finboard-Dashboard/1.0',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // Add referer for certain APIs that check it
    if (url.includes('coingecko.com')) {
      headers['Referer'] = 'https://coingecko.com';
    }
    
    const response = await fetch(url, {
      headers,
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(15000), // 15 second timeout for external APIs
    });

    console.log('Response received:', response.status, response.statusText);

    if (response.status === 429) {
      return NextResponse.json(
        { error: 'The external API is rate limiting requests. Please try again later.' },
        { status: 429 }
      );
    }

    if (!response.ok) {
      console.error(`HTTP error for ${url}:`, response.status, response.statusText);
      return NextResponse.json(
        { error: `HTTP error! status: ${response.status} - ${response.statusText}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Non-JSON response received:', contentType);
      return NextResponse.json(
        { error: 'API did not return JSON data' },
        { status: 400 }
      );
    }

    const data = await response.json();

    // Only cache CoinGecko responses to reduce API calls
    const isCoingecko = url.includes('coingecko.com');
    if (isCoingecko) {
      const cacheTTL = 300000; // 5 minutes for CoinGecko
      cache.set(url, {
        data,
        timestamp: Date.now(),
        ttl: cacheTTL,
      });
    }

    return NextResponse.json(data, {
      headers: {
        'X-Cache': isCoingecko ? 'MISS' : 'NO-CACHE',
        'Cache-Control': isCoingecko ? 'public, max-age=300' : 'no-cache',
        // Add CORS headers to allow frontend access
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: any) {
    console.error('Proxy fetch error for URL:', url, error);
    
    let errorMessage = 'Failed to fetch the resource';
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      errorMessage = 'Request timed out. Please check if the API is accessible.';
    } else if (error.message?.includes('fetch')) {
      errorMessage = 'Network error. Please check the URL and your internet connection.';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Unable to connect to the API. Please check if the URL is correct and accessible.';
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
