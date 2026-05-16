# smart-site-blocker
A Chrome extension that blocks distracting or harmful websites using multi-layered intelligent detection — not just simple URL matching.

## What It Does

Smart Site Blocker watches every website you try to open and checks it in real time before the page loads. It uses multiple detection layers to decide whether a site should be blocked.

First, a fast scan checks the website URL for suspicious patterns. If the site still looks risky but not dangerous enough to block immediately, the extension performs a deeper scan by reading page metadata such as the title and OpenGraph tags.

Instead of relying on a simple blocklist, the extension uses a weighted scoring system. Different signals add points to the total risk score, including:

* Domain name keywords
* URL paths
* Page titles
* Meta descriptions
* OpenGraph metadata
* Regex pattern matches
* Fuzzy matching using Levenshtein distance

A website is blocked only when the final score passes a configurable threshold.

---

## Features

* **Multi-layer detection engine**
  Scans domains, URLs, page titles, meta tags, OpenGraph data, and fuzzy keyword matches using independent weighted scores.

* **Regex rule support**
  Create advanced custom matching rules using `/pattern/flags` syntax.

* **Whitelist & Blacklist**
  Always allow or always block specific domains, bypassing the scoring system completely.

* **Deep metadata scan**
  Reads `<head>` metadata for websites that appear suspicious after the initial fast-path check.

* **Enable/disable toggle**
  Turn blocking on or off instantly without losing settings.

* **Configurable blocking threshold**
  Adjust how strict or relaxed the blocking engine should be.

* **Tamper-resistant keyword removal**
  Removing keywords requires waiting through a 20-minute countdown. Closing the popup resets the timer, making impulsive bypass attempts harder.

* **Detailed blocked page**
  Shows the matched keyword, detection reason, and total score instead of displaying a generic browser error.

* **Cross-device sync**
  All settings are stored using `chrome.storage.sync` so preferences stay synced across devices.

* **Block counter**
  Tracks how many website navigations have been blocked.



Project Structure

<img width="1536" height="1024" alt="ChatGPT Image May 16, 2026, 06_05_24 PM" src="https://github.com/user-attachments/assets/defbbed9-29be-4832-98c0-482d3ae463b8" />


Architecture — 3 Moving Parts
1. Background Service Worker (background.js)
The brain. Always running in the background. Listens to every tab navigation using Chrome's webNavigation API.
2. Content Script (content.js)
Injected into every page. Can read the actual DOM — title, meta tags, OpenGraph data. Reports back to the background worker.
3. Popup + Options UI (popup.js, options.js)
Just the settings panel. Reads and writes to chrome.storage.sync.
These three talk to each other using chrome.runtime.sendMessage — Chrome's built-in messaging system.

The Flow — What Happens When You Open a Tab
Step 1 — Navigation is intercepted
chrome.webNavigation.onBeforeNavigate fires before the page even loads. The background worker catches it.
Step 2 — Skip junk URLs
If it starts with chrome://, about:, blob: etc. — ignore it immediately.
Step 3 — Load settings
Fetch keywords, regex rules, whitelist, blacklist, threshold — all from chrome.storage.sync in one batched call.
Step 4 — List checks (before any scoring)

Whitelist match → allow instantly, stop everything
Blacklist match → block instantly, score = 100, stop everything

Step 5 — Scoring engine runs (analyzer.js)
This is the core. Every layer adds points to a running score:
LayerWhat it checksPointsExact domainkeyword in "xvideos.com"40Subdomainkeyword in "live.cricket.stream.xyz"35Regexyour custom /pattern/flags rules50URL pathkeyword in /adult-content/video20Page titlekeyword in <title> tag30Meta descriptionkeyword in <meta name="description">25Meta keywordskeyword in <meta name="keywords">25OpenGraphkeyword in og:title, og:description20Fuzzy matchtypos, leet variants (max 2 edits)15
If score ≥ threshold (default 40) → block. Done.
Step 6 — Early exit
After layers 1–4 (URL and domain only), if the score already crosses the threshold, block immediately. The page never even loads. This is the fast path.
Step 7 — Deep scan (if suspicious but not blocked)
If score is between 20 and threshold, the background worker pings the content script: "go read the page metadata." The content script reads the <head> — title, meta tags, OpenGraph — sends it back. The scoring engine runs again with this extra data. Layers 5–9 now run.
Step 8 — Fuzzy matching (last resort)
If still not blocked and fuzzy is enabled, Levenshtein distance algorithm runs. It checks if any word in the URL or title is within 2 character edits of a keyword. Catches things like pr0n, streem, x-vidoes.
Step 9 — Final decision
Score ≥ threshold → redirect tab to blocked.html with the keyword, score and reason passed as URL query params. Block counter in storage incremented by 1.

Normalizer — Why It Matters
Before any matching happens, all text goes through normalizer.js:

Lowercase everything
Leetspeak map: 0→o, 1→i, 3→e, 4→a, 5→s, @→a, $→s
Strip all non-alphanumeric characters
Collapse spaces

So "X-V1DE0S.com" becomes "x videos com" before matching. This is what makes keyword matching reliable without needing a massive URL database.

The Tamper-Resistance Logic
Removing keywords starts a 20-minute countdown. If you close the popup or switch windows, window.addEventListener('blur') fires and resets it to zero. You can only remove keywords after 20 uninterrupted minutes. Adding keywords has no restriction — instant.

Key Technical Decisions You Can Defend
Why Manifest V3?
It's the current Chrome standard. Service workers replace persistent background pages, which is more memory-efficient.
Why chrome.storage.sync and not localStorage?
sync works across devices automatically. localStorage is tab/origin scoped and doesn't persist across Chrome profiles.
Why no framework?
Zero dependencies means nothing to break, no build step, no bundler. Load unpacked and it works. Also keeps the extension lightweight — the whole thing is plain JS files.
Why score-based instead of a blocklist?
A static blocklist needs constant updates and can't catch new sites or variations. A scoring engine generalizes — it can block a site it has never seen before if the URL, title, and metadata all contain matching signals.

