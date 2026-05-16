/**
 * utils/fuzzy.js
 * ---------------
 * Fuzzy matching utility for Smart Site Blocker.
 * Implements Levenshtein distance and substring fuzzy matching
 * to catch typos, alternate spellings, and leet variants.
 */

/**
 * Compute the Levenshtein (edit) distance between two strings.
 * Uses dynamic programming with O(n*m) time and O(n) space.
 *
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @returns {number} Edit distance (0 = identical).
 */
export function levenshtein(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;

  const lenA = a.length;
  const lenB = b.length;

  // Use two rows to keep space at O(n)
  let prev = Array.from({ length: lenB + 1 }, (_, i) => i);
  let curr = new Array(lenB + 1);

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,       // insertion
        prev[j] + 1,           // deletion
        prev[j - 1] + cost     // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[lenB];
}

/**
 * Test whether any contiguous substring (token) within `text`
 * is within `threshold` edits of `keyword`.
 * Splits text into tokens and checks each against the keyword.
 *
 * @param {string} text - Normalized source text.
 * @param {string} keyword - Normalized keyword to match.
 * @param {number} [threshold=2] - Maximum edit distance to consider a match.
 * @returns {boolean} True if a fuzzy match was found.
 */
export function fuzzyMatch(text, keyword, threshold = 2) {
  if (!text || !keyword) return false;

  const kLen = keyword.length;

  // Short keywords (1-2 chars) should only exact-match to avoid false positives
  if (kLen <= 2) return text.includes(keyword);

  // Split text into tokens for word-level fuzzy matching
  const tokens = text.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    // Skip very short tokens vs long keywords (unlikely match)
    if (Math.abs(token.length - kLen) > threshold + 1) continue;

    const dist = levenshtein(token, keyword);
    if (dist <= threshold) return true;
  }

  // Also try sliding window for compound words (no spaces)
  if (kLen >= 4) {
    for (let start = 0; start <= text.length - kLen; start++) {
      const sub = text.slice(start, start + kLen + threshold);
      if (Math.abs(sub.length - kLen) > threshold) continue;
      if (levenshtein(sub.slice(0, kLen), keyword) <= threshold) return true;
    }
  }

  return false;
}

/**
 * Check a normalized text against an array of keywords using fuzzy matching.
 * Returns on the first match found for performance.
 *
 * @param {string} normalizedText - Pre-normalized source text.
 * @param {string[]} keywords - Array of normalized keywords.
 * @param {number} [threshold=2] - Levenshtein threshold.
 * @returns {{ matched: boolean, keyword: string }} Result of fuzzy check.
 */
export function isFuzzyMatch(normalizedText, keywords, threshold = 2) {
  if (!normalizedText || !keywords?.length) {
    return { matched: false, keyword: '' };
  }

  for (const keyword of keywords) {
    if (!keyword || keyword.length < 3) continue;
    if (fuzzyMatch(normalizedText, keyword, threshold)) {
      return { matched: true, keyword };
    }
  }

  return { matched: false, keyword: '' };
}
