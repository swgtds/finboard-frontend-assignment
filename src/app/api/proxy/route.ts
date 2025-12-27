import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitConfig, shouldCacheApi, getCacheDuration } from '@/config/apiRateLimits';


interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // in milliseconds
}

const cache = new Map<string, CacheEntry>();
const requestQueue = new Map<string, { timestamp: number; count: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key);
    }
  }
  
  for (const [key, entry] of requestQueue.entries()) {
    if (now - entry.timestamp > 120000) { 
      requestQueue.delete(key);
    }
  }
}, 60000); 


function isRateLimited(url: string): boolean {
  const config = getRateLimitConfig(url);
  
  if (!config) {
    return false;
  }
  
  const now = Date.now();
  const entry = requestQueue.get(url);

  if (!entry) {
    requestQueue.set(url, { timestamp: now, count: 1 });
    return false;
  }

  if (now - entry.timestamp > config.windowMs) {
    requestQueue.set(url, { timestamp: now, count: 1 });
    return false;
  }

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
  const apiKey = searchParams.get('apiKey');

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL provided' },
      { status: 400 }
    );
  }

  if (!skipCache && shouldCacheApi(url)) {
    // Create a unique cache key that includes the API key if present
    const cacheKey = apiKey ? `${url}:${apiKey}` : url;
    const cached = cache.get(cacheKey);
    if (cached) {
      const cacheDuration = getCacheDuration(url) / 1000; 
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
    const headers: HeadersInit = {
      'User-Agent': 'Finboard-Dashboard/1.0',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // Add API key to headers if provided
    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }

    if (url.includes('coingecko.com')) {
      headers['Referer'] = 'https://coingecko.com';
    }
    
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000), 
    });

    if (response.status === 429) {
      return NextResponse.json(
        { error: 'The external API is rate limiting requests. Please try again later.' },
        { status: 429 }
      );
    }

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status} - ${response.statusText}`;
      
      // Enhanced error messages for common authentication issues
      if (response.status === 401) {
        errorMessage = "Unauthorized: API key required or invalid";
      } else if (response.status === 403) {
        errorMessage = "Forbidden: Invalid API key or insufficient permissions";
      } else if (response.status === 400) {
        const responseText = await response.text().catch(() => '');
        if (responseText.toLowerCase().includes('api key') || 
            responseText.toLowerCase().includes('authentication') ||
            responseText.toLowerCase().includes('unauthorized')) {
          errorMessage = "Bad Request: API key required for this endpoint";
        }
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'API did not return JSON data' },
        { status: 400 }
      );
    }

    const data = await response.json();

    const shouldCache = shouldCacheApi(url);
    if (shouldCache) {
      const cacheTTL = getCacheDuration(url);
      // Create a unique cache key that includes the API key if present
      const cacheKey = apiKey ? `${url}:${apiKey}` : url;
      cache.set(cacheKey, {
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
