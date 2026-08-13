const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

export function isSupportedPageUrl(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  try {
    return SUPPORTED_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}
