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
  'coingecko.com': { maxRequests: 3, windowMs: 60000 }, // 3 requests per minute for CoinGecko
  'default': { maxRequests: 10, windowMs: 60000 } // 10 requests per minute for other APIs
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

// Enhanced rate limiting with API-specific limits
function isRateLimited(url: string): boolean {
  const now = Date.now();
  
  // Determine rate limit based on API provider
  let rateLimit = API_RATE_LIMITS.default;
  for (const [domain, limit] of Object.entries(API_RATE_LIMITS)) {
    if (domain !== 'default' && url.includes(domain)) {
      rateLimit = limit;
      break;
    }
  }
  
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

  // Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cached = cache.get(url);
    if (cached) {
      const isCoingecko = url.includes('coingecko.com');
      const maxAge = isCoingecko ? 300 : 60; // 5 minutes for CoinGecko, 1 minute for others
      
      return NextResponse.json(cached.data, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': `public, max-age=${maxAge}`,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
  }

  // Check rate limiting with specific error message
  if (isRateLimited(url)) {
    const isCoingecko = url.includes('coingecko.com');
    const waitTime = isCoingecko ? '1 minute' : '60 seconds';
    const message = isCoingecko 
      ? `CoinGecko API rate limit exceeded. Please wait ${waitTime} before making another request. The free tier allows only 3 requests per minute.`
      : `Rate limit exceeded. Please wait ${waitTime} before making another request.`;
      
    return NextResponse.json(
      { error: message },
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

    // Enhanced caching with longer TTL for certain APIs
    const isCoingecko = url.includes('coingecko.com');
    const cacheTTL = isCoingecko ? 300000 : 60000; // 5 minutes for CoinGecko, 1 minute for others

    // Cache successful responses
    cache.set(url, {
      data,
      timestamp: Date.now(),
      ttl: cacheTTL,
    });

    return NextResponse.json(data, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': `public, max-age=${cacheTTL / 1000}`,
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
