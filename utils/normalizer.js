/**
 * utils/normalizer.js
 * ---------------------
 * Text normalization utility for Smart Site Blocker.
 * Converts raw text into a cleaned, canonical form before
 * keyword matching — handles case, punctuation, and leetspeak.
 */

/**
 * Normalize a text string for consistent keyword matching.
 * - Converts to lowercase
 * - Replaces common leetspeak substitutions
 * - Strips non-alphanumeric characters (except spaces)
 * - Collapses repeated whitespace
 *
 * @param {string} text - The raw input string to normalize.
 * @returns {string} The normalized string.
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';

  let s = text.toLowerCase();

  // Leetspeak substitution map
  s = s
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');

  // Remove all non-alphanumeric characters except spaces
  s = s.replace(/[^a-z0-9 ]/g, ' ');

  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Normalize a domain string specifically — strips www, TLDs,
 * hyphens, and subdomains for cleaner matching.
 *
 * @param {string} domain - Hostname from a URL.
 * @returns {string} Cleaned domain string.
 */
export function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') return '';
  // Remove www. prefix
  let d = domain.toLowerCase().replace(/^www\./, '');
  // Replace hyphens and dots with spaces for keyword splitting
  d = d.replace(/[-_.]/g, ' ');
  // Apply leet normalization
  return normalizeText(d);
}

/**
 * Extract the URL path components as a normalized string.
 *
 * @param {string} url - Full URL string.
 * @returns {string} Normalized path + query string.
 */
export function normalizeUrlPath(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const combined = parsed.pathname + ' ' + parsed.search + ' ' + parsed.hash;
    return normalizeText(combined);
  } catch {
    return normalizeText(url);
  }
}
