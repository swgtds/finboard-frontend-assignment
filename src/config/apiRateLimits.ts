export interface ApiRateLimitConfig {
  domain: string;
  maxRequests: number;
  windowMs: number;
  cacheMs: number;
  description: string;
}

export const API_RATE_LIMITS: ApiRateLimitConfig[] = [
  {
    domain: 'coingecko.com',
    maxRequests: 3,
    windowMs: 60000, // 1 minute
    cacheMs: 300000, // 5 minutes
    description: 'CoinGecko free tier: 3 requests per minute'
  },
  // Add more APIs here as needed
  // {
  //   domain: 'some-other-api.com',
  //   maxRequests: 10,
  //   windowMs: 60000, // 1 minute
  //   cacheMs: 120000, // 2 minutes
  //   description: 'Some API: 10 requests per minute'
  // }
];

/**
 * Check if a URL matches any rate-limited API domain
 */
export function getRateLimitConfig(url: string): ApiRateLimitConfig | null {
  return API_RATE_LIMITS.find(config => url.includes(config.domain)) || null;
}

/**
 * Check if an API should be cached
 */
export function shouldCacheApi(url: string): boolean {
  return getRateLimitConfig(url) !== null;
}

/**
 * Get cache duration for an API
 */
export function getCacheDuration(url: string): number {
  const config = getRateLimitConfig(url);
  return config ? config.cacheMs : 0; // 0 means no caching
}

/**
 * Get all configured API domains for display purposes
 */
export function getRateLimitedDomains(): string[] {
  return API_RATE_LIMITS.map(config => config.domain);
}