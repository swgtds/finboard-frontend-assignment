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
    cacheMs: 600000, // 10 minutes (increased from 5 minutes)
    description: 'CoinGecko free tier: 3 requests per minute'
  },
  {
    domain: 'indianapi.in',
    maxRequests: 1,
    windowMs: 5400000, // 1.5 hours (90 minutes)
    cacheMs: 5400000, // 1.5 hours cache to match rate limit
    description: 'Indian API: 1 request per 1.5 hours (500/month limit)'
  },
];

export function getRateLimitConfig(url: string): ApiRateLimitConfig | null {
  return API_RATE_LIMITS.find(config => url.includes(config.domain)) || null;
}

export function shouldCacheApi(url: string): boolean {
  return getRateLimitConfig(url) !== null;
}

export function getCacheDuration(url: string): number {
  const config = getRateLimitConfig(url);
  return config ? config.cacheMs : 0;
}

export function getRateLimitedDomains(): string[] {
  return API_RATE_LIMITS.map(config => config.domain);
}