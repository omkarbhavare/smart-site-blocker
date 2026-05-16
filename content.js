/**
 * content.js
 * -----------
 * Content script for Smart Site Blocker.
 * Runs at document_start on all pages. Listens for a DEEP_SCAN_REQUEST
 * from the background worker and responds with metadata analysis.
 *
 * Deep scan collects:
 *   - document.title
 *   - meta description, keywords
 *   - og:title, og:description, og:site_name
 *
 * Does NOT do heavy DOM traversal — only reads <head> meta tags and title.
 */

(function () {
  'use strict';

  /** Prevent the deep scan from running more than once per page load */
  let scanFired = false;

  /**
   * Safely read a meta tag's content attribute by name or property.
   *
   * @param {string} selector - CSS attribute selector value
   * @param {string} attr     - Attribute to query (name or property)
   * @returns {string}
   */
  function getMetaContent(selector, attr = 'name') {
    try {
      const el = document.querySelector(`meta[${attr}="${selector}"]`);
      return el?.getAttribute('content') || '';
    } catch {
      return '';
    }
  }

  /**
   * Collect all relevant metadata from the current page's <head>.
   * Called only after DOMContentLoaded or document.readyState check.
   *
   * @returns {{ title: string, metadata: Object }}
   */
  function collectPageData() {
    return {
      title: document.title || '',
      metadata: {
        description: getMetaContent('description'),
        keywords:    getMetaContent('keywords'),
        ogTitle:     getMetaContent('og:title', 'property'),
        ogDescription: getMetaContent('og:description', 'property'),
        ogSiteName:  getMetaContent('og:site_name', 'property'),
        twitterTitle: getMetaContent('twitter:title', 'name'),
      }
    };
  }

  /**
   * Inline normalizeText — duplicated here to avoid import issues
   * in content scripts (which don't always support ES modules).
   *
   * @param {string} text
   * @returns {string}
   */
  function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    let s = text.toLowerCase();
    s = s.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
         .replace(/4/g, 'a').replace(/5/g, 's').replace(/@/g, 'a').replace(/\$/g, 's');
    s = s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }

  /**
   * Inline Levenshtein distance for fuzzy matching.
   *
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function levenshtein(a, b) {
    if (!a) return b ? b.length : 0;
    if (!b) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    let curr = new Array(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }
    return prev[b.length];
  }

  /**
   * Inline exact + fuzzy keyword check for content script.
   *
   * @param {string} text
   * @param {string[]} keywords
   * @param {boolean} fuzzy
   * @returns {{ matched: boolean, keyword: string, method: string }}
   */
  function checkKeywords(text, keywords, fuzzy = true) {
    const norm = normalizeText(text);
    for (const kw of keywords) {
      const nkw = normalizeText(kw);
      if (!nkw) continue;
      if (norm.includes(nkw)) return { matched: true, keyword: kw, method: 'exact' };
    }
    if (fuzzy) {
      const tokens = norm.split(/\s+/);
      for (const kw of keywords) {
        const nkw = normalizeText(kw);
        if (nkw.length < 3) continue;
        for (const token of tokens) {
          if (Math.abs(token.length - nkw.length) <= 3 && levenshtein(token, nkw) <= 2) {
            return { matched: true, keyword: kw, method: 'fuzzy' };
          }
        }
      }
    }
    return { matched: false, keyword: '', method: '' };
  }

  /**
   * Parse a regex rule string into a RegExp.
   *
   * @param {string} ruleStr
   * @returns {RegExp|null}
   */
  function parseRegex(ruleStr) {
    try {
      const m = ruleStr.match(/^\/(.+)\/([gimsuy]*)$/);
      return m ? new RegExp(m[1], m[2] || 'i') : new RegExp(ruleStr, 'i');
    } catch { return null; }
  }

  /**
   * Run a full deep analysis on the current page using collected metadata.
   *
   * @param {Object} payload - Config from background: url, domain, keywords, regexRules, threshold, fuzzyEnabled
   * @returns {{ blocked: boolean, score: number, matchedRules: string[], reason: string }}
   */
  function runDeepAnalysis(payload) {
    const { url, keywords = [], regexRules = [], threshold = 40, fuzzyEnabled = true } = payload;
    const { title, metadata } = collectPageData();

    let score = 0;
    const matchedRules = [];

    // Title check
    const titleCheck = checkKeywords(title, keywords, fuzzyEnabled);
    if (titleCheck.matched) {
      score += 30;
      matchedRules.push(`Title (${titleCheck.method}): "${titleCheck.keyword}"`);
    }

    // Meta description
    if (metadata.description) {
      const descCheck = checkKeywords(metadata.description, keywords, false);
      if (descCheck.matched) {
        score += 25;
        matchedRules.push(`Meta description: "${descCheck.keyword}"`);
      }
    }

    // Meta keywords
    if (metadata.keywords) {
      const kwCheck = checkKeywords(metadata.keywords, keywords, false);
      if (kwCheck.matched) {
        score += 25;
        matchedRules.push(`Meta keywords: "${kwCheck.keyword}"`);
      }
    }

    // OpenGraph tags
    const ogText = [metadata.ogTitle, metadata.ogDescription, metadata.ogSiteName]
      .filter(Boolean).join(' ');
    if (ogText) {
      const ogCheck = checkKeywords(ogText, keywords, false);
      if (ogCheck.matched) {
        score += 20;
        matchedRules.push(`OpenGraph: "${ogCheck.keyword}"`);
      }
    }

    // Regex check on full URL
    for (const ruleStr of regexRules) {
      const regex = parseRegex(ruleStr);
      if (regex && regex.test(url)) {
        score += 50;
        matchedRules.push(`Regex: ${ruleStr}`);
        break;
      }
    }

    const blocked = score >= threshold;
    const reason = blocked
      ? `Deep scan blocked (score ${score}): ${matchedRules.slice(0, 2).join('; ')}`
      : `Suspicious but below threshold (score ${score})`;

    return { blocked, score, matchedRules, reason };
  }

  /**
   * Handle an incoming DEEP_SCAN_REQUEST from the background worker.
   *
   * @param {Object} message
   * @param {chrome.runtime.MessageSender} sender
   * @param {Function} sendResponse
   */
  function handleDeepScanRequest(message, sender, sendResponse) {
    if (message.type !== 'DEEP_SCAN_REQUEST') return false;
    if (scanFired) {
      sendResponse({ ok: false, reason: 'already_scanned' });
      return false;
    }
    scanFired = true;

    const run = () => {
      const result = runDeepAnalysis(message.payload);
      // Send result back to background
      chrome.runtime.sendMessage({
        type: 'DEEP_SCAN_RESULT',
        payload: { result, url: message.payload.url }
      });

      // Also redirect immediately if blocked (belt-and-suspenders)
      if (result.blocked) {
        const params = new URLSearchParams({
          url: message.payload.url,
          reason: result.reason,
          keyword: result.matchedRules?.[0] ?? '',
          score: String(result.score)
        });
        const blockedUrl = chrome.runtime.getURL(`blocked.html?${params.toString()}`);
        window.location.href = blockedUrl;
      }

      sendResponse({ ok: true, blocked: result.blocked });
    };

    // Wait for DOM if not yet ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }

    return true; // Keep message channel open for async sendResponse
  }

  chrome.runtime.onMessage.addListener(handleDeepScanRequest);

})();
