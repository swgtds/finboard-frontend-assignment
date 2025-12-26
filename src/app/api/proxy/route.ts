import { NextRequest, NextResponse } from 'next/server';

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
}, 60000); // Clean every minute

// Rate limiting: max 5 requests per URL per 60 seconds
function isRateLimited(url: string): boolean {
  const now = Date.now();
  const entry = requestQueue.get(url);

  if (!entry) {
    requestQueue.set(url, { timestamp: now, count: 1 });
    return false;
  }

  // If more than 60 seconds have passed, reset the counter
  if (now - entry.timestamp > 60000) {
    requestQueue.set(url, { timestamp: now, count: 1 });
    return false;
  }

  // If we've made more than 5 requests in the last 60 seconds, rate limit
  if (entry.count >= 5) {
    return true;
  }

  entry.count++;
  return false;
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
      return NextResponse.json(cached.data, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=60',
        },
      });
    }
  }

  // Check rate limiting
  if (isRateLimited(url)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before making another request.' },
      { status: 429 }
    );
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Finboard-Dashboard/1.0',
      },
    });

    if (response.status === 429) {
      return NextResponse.json(
        { error: 'The external API is rate limiting requests. Please try again later.' },
        { status: 429 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP error! status: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Cache successful responses for 60 seconds
    cache.set(url, {
      data,
      timestamp: Date.now(),
      ttl: 60000, // 60 seconds
    });

    return NextResponse.json(data, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error: any) {
    console.error('Proxy fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch the resource' },
      { status: 500 }
    );
  }
}
