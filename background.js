/**
 * background.js
 * --------------
 * Background service worker for Smart Site Blocker (Manifest V3).
 * Handles navigation events, runs the fast-path detection engine,
 * and coordinates with content scripts for deep metadata scans.
 *
 * Flow:
 *   onBeforeNavigate / onCommitted →
 *     check whitelist → check blacklist →
 *     fast-path analysis (URL + domain) →
 *     redirect OR request deep scan from content script
 */

import { analyzeWebsite } from './utils/analyzer.js';
import {
  initializeDefaults,
  getEffectiveKeywords,
  getEffectiveRegexRules,
  getWhitelist,
  getBlacklist,
  getSettings,
  incrementBlockedCount
} from './utils/storage.js';

/** URLs that must never be blocked or processed */
const SKIP_URL_PREFIXES = [
  'chrome://', 'chrome-extension://', 'about:', 'edge://',
  'moz-extension://', 'devtools://', 'blob:', 'data:'
];

/** Cached blocked.html URL for redirect */
const BLOCKED_PAGE_URL = chrome.runtime.getURL('blocked.html');

/**
 * Determine if a URL should be skipped entirely (internal/system pages).
 *
 * @param {string} url
 * @returns {boolean}
 */
function isSkippedUrl(url) {
  if (!url) return true;
  return SKIP_URL_PREFIXES.some(prefix => url.startsWith(prefix));
}

/**
 * Check whether any entry in a list matches the given domain.
 * Supports exact match and wildcard prefix (*.domain.com not supported yet,
 * but "domain.com" matches "sub.domain.com" via endsWith).
 *
 * @param {string} domain
 * @param {string[]} list
 * @returns {boolean}
 */
function domainInList(domain, list) {
  const d = domain.toLowerCase();
  return list.some(entry => {
    const e = entry.toLowerCase().trim();
    return d === e || d.endsWith(`.${e}`);
  });
}

/**
 * Redirect a tab to the blocked page, encoding reason details in query params.
 *
 * @param {number} tabId
 * @param {string} originalUrl
 * @param {Object} result - Analysis result from analyzeWebsite.
 * @returns {Promise<void>}
 */
async function redirectToBlockedPage(tabId, originalUrl, result) {
  await incrementBlockedCount();

  const keyword = result.matchedRules?.[0] ?? 'policy';
  const params = new URLSearchParams({
    url: originalUrl,
    reason: result.reason || 'Content policy violation',
    keyword,
    score: String(result.score)
  });

  const blockedUrl = `${BLOCKED_PAGE_URL}?${params.toString()}`;

  try {
    await chrome.tabs.update(tabId, { url: blockedUrl });
  } catch (err) {
    // Tab may have closed or navigated away — silently ignore
    console.warn('[SmartSiteBlocker] Could not redirect tab:', err.message);
  }
}

/**
 * Core navigation handler — runs fast-path analysis on URL and domain.
 * Called on both onBeforeNavigate and onCommitted.
 *
 * @param {chrome.webNavigation.WebNavigationParentedCallbackDetails} details
 */
async function handleNavigation(details) {
  const { tabId, url, frameId } = details;

  // Only process the main frame
  if (frameId !== 0) return;

  if (isSkippedUrl(url)) return;
  if (url.startsWith(BLOCKED_PAGE_URL)) return;

  let domain;
  try {
    domain = new URL(url).hostname;
  } catch {
    return; // Malformed URL
  }

  // ── Load config from storage (batched) ──────────────────────────────────────
  const [settings, keywords, regexRules, whitelist, blacklist] = await Promise.all([
    getSettings(),
    getEffectiveKeywords(),
    getEffectiveRegexRules(),
    getWhitelist(),
    getBlacklist()
  ]);

  // If extension is disabled, do nothing
  if (!settings.enabled) return;

  const { threshold, fuzzyEnabled, deepScanEnabled } = settings;

  // ── Whitelist check (fast exit) ──────────────────────────────────────────────
  // FIX
const isWhitelisted = domainInList(domain, whitelist);

// Whitelisted domains skip blacklist check and get a higher threshold
// but keyword scoring still runs on the full URL
if (isWhitelisted) {
    // Only do a URL/query keyword check — no deep scan needed
    const result = analyzeWebsite(
        { url, domain, title: '', metadata: {} },
        { keywords, regexRules, threshold, fuzzyEnabled }
    );
    if (result.blocked) {
        await redirectToBlockedPage(tabId, url, result);
    }
    return; // allow if no keyword found in URL
}

  // ── Blacklist check (immediate block) ────────────────────────────────────────
  if (domainInList(domain, blacklist)) {
    await redirectToBlockedPage(tabId, url, {
      score: 100,
      reason: 'Domain is on the blacklist',
      matchedRules: [`Blacklisted domain: ${domain}`]
    });
    return;
  }

  // ── Fast-path analysis (URL + domain only, no metadata) ──────────────────────
  const result = analyzeWebsite(
    { url, domain, title: '', metadata: {} },
    { keywords, regexRules, threshold, fuzzyEnabled }
  );

  if (result.blocked) {
    await redirectToBlockedPage(tabId, url, result);
    return;
  }

  // ── Suspicious: request deep scan from content script ────────────────────────
  if (deepScanEnabled && result.score >= 20) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'DEEP_SCAN_REQUEST',
        payload: { url, domain, threshold, keywords, regexRules, fuzzyEnabled }
      });
    } catch {
      // Content script may not be ready yet (about:blank, etc.) — ignore
    }
  }
}

/**
 * Handle the result of a deep scan from the content script.
 * If the site is blocked, redirect the tab.
 *
 * @param {Object} message
 * @param {chrome.runtime.MessageSender} sender
 */
async function handleDeepScanResult(message, sender) {
  if (message.type !== 'DEEP_SCAN_RESULT') return;
  const { result, url } = message.payload;
  if (!result?.blocked || !sender.tab?.id) return;
  await redirectToBlockedPage(sender.tab.id, url, result);
}

// ── Event listeners ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await initializeDefaults();
  console.log('[SmartSiteBlocker] Installed and initialized.');
});

chrome.webNavigation.onBeforeNavigate.addListener(handleNavigation);
chrome.webNavigation.onCommitted.addListener(handleNavigation);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DEEP_SCAN_RESULT') {
    handleDeepScanResult(message, sender);
    sendResponse({ ok: true });
  }
  // Return false to indicate synchronous handling (no promise kept open)
  return false;
});
