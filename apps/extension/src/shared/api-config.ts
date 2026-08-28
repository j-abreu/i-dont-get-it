export const DEVELOPMENT_API_BASE_URL = 'http://127.0.0.1:8787';
export const PRODUCTION_API_BASE_URL = 'https://context-explain-api.jere-lab.workers.dev';

export function resolveApiBaseUrl(mode: string, configuredValue?: string): string {
  const apiBaseUrl = configuredValue?.trim();
  if (apiBaseUrl === undefined || apiBaseUrl.length === 0) {
    throw new Error(`WXT_API_BASE_URL is required for ${mode} builds.`);
  }

  const url = new URL(apiBaseUrl);

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('The API base URL must not contain credentials.');
  }

  if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
    throw new Error('The API base URL must contain only an origin.');
  }

  if (mode === 'production') {
    if (url.protocol !== 'https:') {
      throw new Error('Production API requests must use HTTPS.');
    }

    if (isLoopbackHostname(url.hostname)) {
      throw new Error('Production API requests must not target a loopback address.');
    }
  } else if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The API base URL must use HTTP or HTTPS.');
  }

  return url.origin;
}

export function getApiHostPermission(apiBaseUrl: string): string {
  return `${new URL(apiBaseUrl).origin}/*`;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname === '::1' ||
    normalizedHostname === '0:0:0:0:0:0:0:1' ||
    normalizedHostname.startsWith('127.')
  );
}
