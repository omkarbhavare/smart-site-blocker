/**
 * utils/analyzer.js
 * ------------------
 * Core multi-layered detection engine for Smart Site Blocker.
 * Analyzes URLs, domains, page titles, metadata, and content
 * using a weighted scoring system to determine if a site should be blocked.
 *
 * Detection priority (fast-path first):
 *   1. Exact domain keyword match
 *   2. Regex match against full URL
 *   3. URL path / slug / query params
 *   4. Page title
 *   5. Meta description, keywords, OpenGraph tags
 *   6. Fuzzy matching (Levenshtein) as fallback
 */

import { normalizeText, normalizeDomain, normalizeUrlPath } from './normalizer.js';
import { isFuzzyMatch } from './fuzzy.js';

/** Scoring weights for each detection layer */
const WEIGHTS = {
  EXACT_DOMAIN:        40,
  REGEX_MATCH:         50,
  URL_PATH:            20,
  PAGE_TITLE:          30,
  META_DESCRIPTION:    25,
  META_KEYWORDS:       25,
  OG_TAGS:             20,
  FUZZY_MATCH:         15,
  SUBDOMAIN:           35
};

/**
 * Parse a regex string in the format /(pattern)/flags into a RegExp object.
 * Returns null if the string is not a valid regex literal.
 *
 * @param {string} ruleStr - Regex string, e.g. "/(porn|xxx)/i"
 * @returns {RegExp|null}
 */
function parseRegexRule(ruleStr) {
  if (!ruleStr) return null;
  try {
    const match = ruleStr.trim().match(/^\/(.+)\/([gimsuy]*)$/);
    if (match) return new RegExp(match[1], match[2] || 'i');
    // Fallback: treat as plain regex without delimiters
    return new RegExp(ruleStr, 'i');
  } catch {
    return null;
  }
}

/**
 * Check if a normalized text includes any keyword as a whole word or substring.
 *
 * @param {string} normalizedText
 * @param {string[]} normalizedKeywords
 * @returns {{ matched: boolean, keyword: string }}
 */
function exactKeywordMatch(normalizedText, normalizedKeywords) {
  for (const kw of normalizedKeywords) {
    if (!kw) continue;
    if (normalizedText.includes(kw)) {
      return { matched: true, keyword: kw };
    }
  }
  return { matched: false, keyword: '' };
}

/**
 * Analyze subdomain parts separately (everything before the registrable domain).
 *
 * @param {string} hostname - e.g. "live.cricket.watch.xyz"
 * @param {string[]} normalizedKeywords
 * @returns {{ matched: boolean, keyword: string }}
 */
function checkSubdomains(hostname, normalizedKeywords) {
  const parts = hostname.toLowerCase().split('.');
  // Strip TLD and second-level domain (last two parts)
  const subdomainParts = parts.slice(0, Math.max(0, parts.length - 2));
  if (!subdomainParts.length) return { matched: false, keyword: '' };

  const subdomainText = normalizeText(subdomainParts.join(' '));
  return exactKeywordMatch(subdomainText, normalizedKeywords);
}

/**
 * Main analysis function. Accepts page data and a configuration object,
 * returns a scored blocking decision with matched rules and a human-readable reason.
 *
 * @param {Object} pageData
 * @param {string} pageData.url              - Full URL of the page.
 * @param {string} pageData.domain           - Hostname extracted from the URL.
 * @param {string} [pageData.title]          - Page title (optional, from deep scan).
 * @param {Object} [pageData.metadata]       - Page metadata (optional, from deep scan).
 * @param {string} [pageData.metadata.description]
 * @param {string} [pageData.metadata.keywords]
 * @param {string} [pageData.metadata.ogTitle]
 * @param {string} [pageData.metadata.ogDescription]
 * @param {Object} config
 * @param {string[]} config.keywords         - Raw keyword list from storage.
 * @param {string[]} config.regexRules       - Raw regex rule strings from storage.
 * @param {number}  config.threshold         - Block score threshold (default 40).
 * @param {boolean} config.fuzzyEnabled      - Whether to run fuzzy matching.
 *
 * @returns {{ blocked: boolean, score: number, matchedRules: string[], reason: string }}
 */
export function analyzeWebsite(pageData, config) {
  const {
    url = '',
    domain = '',
    title = '',
    metadata = {}
  } = pageData;

  const {
    keywords = [],
    regexRules = [],
    threshold = 40,
    fuzzyEnabled = true
  } = config;

  let score = 0;
  const matchedRules = [];

  // Pre-normalize all keywords once
  const normalizedKeywords = keywords.map(k => normalizeText(k)).filter(Boolean);

  // ── LAYER 1: Exact domain keyword match ─────────────────────────────────────
  const normalizedDomain = normalizeDomain(domain);
  const domainMatch = exactKeywordMatch(normalizedDomain, normalizedKeywords);
  if (domainMatch.matched) {
    score += WEIGHTS.EXACT_DOMAIN;
    matchedRules.push(`Domain match: "${domainMatch.keyword}" in "${domain}"`);
  }

  // ── LAYER 1b: Subdomain check ────────────────────────────────────────────────
  const subMatch = checkSubdomains(domain, normalizedKeywords);
  if (subMatch.matched && subMatch.keyword !== domainMatch.keyword) {
    score += WEIGHTS.SUBDOMAIN;
    matchedRules.push(`Subdomain match: "${subMatch.keyword}" in "${domain}"`);
  }

  // ── LAYER 2: Regex match against full URL ────────────────────────────────────
  for (const ruleStr of regexRules) {
    const regex = parseRegexRule(ruleStr);
    if (!regex) continue;
    if (regex.test(url) || regex.test(domain)) {
      score += WEIGHTS.REGEX_MATCH;
      matchedRules.push(`Regex match: ${ruleStr}`);
      break; // One regex hit is enough for this layer
    }
  }

  // ── LAYER 3: URL path / slug / query params ──────────────────────────────────
  const normalizedPath = normalizeUrlPath(url);
  const pathMatch = exactKeywordMatch(normalizedPath, normalizedKeywords);
  if (pathMatch.matched) {
    score += WEIGHTS.URL_PATH;
    matchedRules.push(`URL path match: "${pathMatch.keyword}"`);
  }

  // Early exit if fast-path already exceeds threshold
  if (score >= threshold) {
    return buildResult(true, score, matchedRules, 'Fast-path URL/domain block');
  }

  // ── LAYER 4: Page title ──────────────────────────────────────────────────────
  if (title) {
    const normalizedTitle = normalizeText(title);
    const titleMatch = exactKeywordMatch(normalizedTitle, normalizedKeywords);
    if (titleMatch.matched) {
      score += WEIGHTS.PAGE_TITLE;
      matchedRules.push(`Title match: "${titleMatch.keyword}" in "${title}"`);
    }
  }

  // ── LAYER 5: Meta description ────────────────────────────────────────────────
  if (metadata.description) {
    const normDesc = normalizeText(metadata.description);
    const descMatch = exactKeywordMatch(normDesc, normalizedKeywords);
    if (descMatch.matched) {
      score += WEIGHTS.META_DESCRIPTION;
      matchedRules.push(`Meta description match: "${descMatch.keyword}"`);
    }
  }

  // ── LAYER 5b: Meta keywords tag ──────────────────────────────────────────────
  if (metadata.keywords) {
    const normKw = normalizeText(metadata.keywords);
    const kwMatch = exactKeywordMatch(normKw, normalizedKeywords);
    if (kwMatch.matched) {
      score += WEIGHTS.META_KEYWORDS;
      matchedRules.push(`Meta keywords match: "${kwMatch.keyword}"`);
    }
  }

  // ── LAYER 5c: OpenGraph tags ─────────────────────────────────────────────────
  const ogCombined = [metadata.ogTitle, metadata.ogDescription]
    .filter(Boolean)
    .join(' ');
  if (ogCombined) {
    const normOg = normalizeText(ogCombined);
    const ogMatch = exactKeywordMatch(normOg, normalizedKeywords);
    if (ogMatch.matched) {
      score += WEIGHTS.OG_TAGS;
      matchedRules.push(`OpenGraph match: "${ogMatch.keyword}"`);
    }
  }

  // ── LAYER 6: Fuzzy matching (fallback) ───────────────────────────────────────
  if (fuzzyEnabled && score < threshold) {
    // Combine all available text for fuzzy check
    const allText = [normalizedDomain, normalizedPath, normalizeText(title)]
      .filter(Boolean)
      .join(' ');

    const fuzzyResult = isFuzzyMatch(allText, normalizedKeywords, 2);
    if (fuzzyResult.matched) {
      score += WEIGHTS.FUZZY_MATCH;
      matchedRules.push(`Fuzzy match: "${fuzzyResult.keyword}" (Levenshtein ≤ 2)`);
    }
  }

  const blocked = score >= threshold;
  const reason = blocked
    ? buildReason(matchedRules)
    : matchedRules.length > 0
      ? `Suspicious (score ${score} < threshold ${threshold})`
      : 'No violations found';

  return buildResult(blocked, score, matchedRules, reason);
}

/**
 * Build the standard result object.
 *
 * @param {boolean} blocked
 * @param {number} score
 * @param {string[]} matchedRules
 * @param {string} reason
 * @returns {{ blocked: boolean, score: number, matchedRules: string[], reason: string }}
 */
function buildResult(blocked, score, matchedRules, reason) {
  return { blocked, score, matchedRules, reason };
}

/**
 * Build a human-readable reason string from the matched rules.
 *
 * @param {string[]} matchedRules
 * @returns {string}
 */
function buildReason(matchedRules) {
  if (!matchedRules.length) return 'Blocked by policy';
  if (matchedRules.length === 1) return matchedRules[0];
  return `${matchedRules.length} rules matched: ${matchedRules.slice(0, 2).join('; ')}${matchedRules.length > 2 ? ` (+${matchedRules.length - 2} more)` : ''}`;
}
