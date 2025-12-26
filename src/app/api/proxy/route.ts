import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitConfig, shouldCacheApi, getCacheDuration } from '@/config/apiRateLimits';

// In-memory cache for API responses
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // time to live in milliseconds
}

const cache = new Map<string, CacheEntry>();
const requestQueue = new Map<string, { timestamp: number; count: number }>();

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

// Enhanced rate limiting based on configuration
function isRateLimited(url: string): boolean {
  const config = getRateLimitConfig(url);
  
  // If no rate limit config found, allow unlimited requests
  if (!config) {
    return false;
  }
  
  const now = Date.now();
  const entry = requestQueue.get(url);

  if (!entry) {
    requestQueue.set(url, { timestamp: now, count: 1 });
    return false;
  }

  // If more than the window time has passed, reset the counter
  if (now - entry.timestamp > config.windowMs) {
    requestQueue.set(url, { timestamp: now, count: 1 });
    return false;
  }

  // If we've made more requests than allowed in the time window, rate limit
  if (entry.count >= config.maxRequests) {
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

  // Check cache first (only for configured APIs, unless skipCache is true)
  if (!skipCache && shouldCacheApi(url)) {
    const cached = cache.get(url);
    if (cached) {
      const cacheDuration = getCacheDuration(url) / 1000; // Convert to seconds
      return NextResponse.json(cached.data, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': `public, max-age=${cacheDuration}`,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
  }

  // Check rate limiting based on configuration
  if (isRateLimited(url)) {
    const config = getRateLimitConfig(url);
    const errorMessage = config 
      ? `${config.description}. Please wait before making another request.`
      : 'Rate limit exceeded. Please wait before making another request.';
      
    return NextResponse.json(
      { error: errorMessage },
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

    // Only cache responses for configured APIs
    const shouldCache = shouldCacheApi(url);
    if (shouldCache) {
      const cacheTTL = getCacheDuration(url);
      cache.set(url, {
        data,
        timestamp: Date.now(),
        ttl: cacheTTL,
      });
    }

    const cacheSeconds = shouldCache ? getCacheDuration(url) / 1000 : 0;
    
    return NextResponse.json(data, {
      headers: {
        'X-Cache': shouldCache ? 'MISS' : 'NO-CACHE',
        'Cache-Control': shouldCache ? `public, max-age=${cacheSeconds}` : 'no-cache',
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
