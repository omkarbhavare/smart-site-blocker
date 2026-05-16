/**
 * options.js
 * -----------
 * Options page controller for Smart Site Blocker.
 *
 * Security rules:
 *  - Keywords and regex rules textareas are READ-ONLY until a 15-minute
 *    on-page countdown completes.
 *  - The countdown resets if the user navigates away or the page loses focus.
 *  - Saving is blocked until unlocked (for keyword/regex changes).
 *  - Whitelist / blacklist / threshold / toggles can always be saved.
 *  - Export, Import, and Reset also require unlock.
 *
 * PROTECTED DEFAULTS:
 *  - The built-in keyword and regex rule lists are never loaded into, shown
 *    in, or saveable from the UI. They are enforced silently in the engine.
 *  - The textareas only show user-added custom entries.
 */

(function () {
  'use strict';

  // ── Storage helpers ───────────────────────────────────────────────────────────

  const get = (keys) => new Promise((res) => chrome.storage.sync.get(keys, res));
  const set = (items) => new Promise((res) => chrome.storage.sync.set(items, res));

  // NOTE: No DEFAULT_KEYWORDS or DEFAULT_REGEX_RULES here — those are
  // protected constants in utils/storage.js and are NEVER shown in the UI.

  const DEFAULT_SETTINGS = {
    enabled: true,
    threshold: 40,
    fuzzyEnabled: true,
    deepScanEnabled: true
  };

  async function loadAll() {
    return get(['keywords', 'regexRules', 'whitelist', 'blacklist', 'settings']);
  }

  // ── 15-minute unlock countdown ────────────────────────────────────────────────

  const UNLOCK_SECONDS = 20 * 60;

  let unlockSecondsLeft = UNLOCK_SECONDS;
  let unlockIntervalId  = null;
  let unlocked          = false;

  function fmtTime(s) {
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function applyLockState() {
    const keywordsArea = document.getElementById('keywordsArea');
    const regexArea    = document.getElementById('regexArea');
    const lockBanner   = document.getElementById('lockBanner');
    const lockTimer    = document.getElementById('lockTimer');
    const saveBtn      = document.getElementById('saveBtn');
    const resetBtn     = document.getElementById('resetBtn');
    const importBtn    = document.getElementById('importBtn');

    if (unlocked) {
      keywordsArea.readOnly = false;
      regexArea.readOnly    = false;
      keywordsArea.classList.remove('locked-field');
      regexArea.classList.remove('locked-field');
      lockBanner.classList.add('hidden');
      saveBtn.disabled   = false;
      resetBtn.disabled  = false;
      importBtn.disabled = false;
    } else {
      keywordsArea.readOnly = true;
      regexArea.readOnly    = true;
      keywordsArea.classList.add('locked-field');
      regexArea.classList.add('locked-field');
      lockBanner.classList.remove('hidden');
      lockTimer.textContent = fmtTime(unlockSecondsLeft);
      saveBtn.disabled   = false; // save allowed for whitelist/blacklist/settings
      resetBtn.disabled  = true;
      importBtn.disabled = true;
    }
  }

  function tickUnlock() {
    unlockSecondsLeft--;
    const lockTimer = document.getElementById('lockTimer');
    if (lockTimer) lockTimer.textContent = fmtTime(unlockSecondsLeft);
    if (unlockSecondsLeft <= 0) {
      clearInterval(unlockIntervalId);
      unlockIntervalId = null;
      unlocked = true;
      applyLockState();
      showToast('🔓 Keywords editing unlocked');
    }
  }

  function startUnlockCountdown() {
    if (unlocked || unlockIntervalId !== null) return;
    unlockIntervalId = setInterval(tickUnlock, 1000);
  }

  function resetUnlockCountdown() {
    if (unlocked) return;
    clearInterval(unlockIntervalId);
    unlockIntervalId  = null;
    unlockSecondsLeft = UNLOCK_SECONDS;
    applyLockState();
  }

  // Reset if user navigates away / loses focus
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetUnlockCountdown();
  });

  window.addEventListener('blur', resetUnlockCountdown);

  // ── DOM refs ──────────────────────────────────────────────────────────────────

  const keywordsArea    = document.getElementById('keywordsArea');
  const regexArea       = document.getElementById('regexArea');
  const whitelistArea   = document.getElementById('whitelistArea');
  const blacklistArea   = document.getElementById('blacklistArea');
  const thresholdSlider = document.getElementById('thresholdSlider');
  const thresholdDisplay= document.getElementById('thresholdDisplay');
  const fuzzyToggle     = document.getElementById('fuzzyToggle');
  const deepScanToggle  = document.getElementById('deepScanToggle');
  const saveBtn         = document.getElementById('saveBtn');
  const exportBtn       = document.getElementById('exportBtn');
  const importBtn       = document.getElementById('importBtn');
  const importInput     = document.getElementById('importInput');
  const resetBtn        = document.getElementById('resetBtn');
  const toast           = document.getElementById('toast');

  // ── Toast ─────────────────────────────────────────────────────────────────────

  let toastTimer;

  function showToast(message, type = 'success') {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast${type === 'error' ? ' error' : ''} visible`;
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
  }

  // ── Textarea helpers ──────────────────────────────────────────────────────────

  const toText  = (arr) => (Array.isArray(arr) ? arr : []).join('\n');
  const toArray = (text) => text.split('\n').map(s => s.trim()).filter(Boolean);

  // ── Load ──────────────────────────────────────────────────────────────────────

  async function loadSettings() {
    const data = await loadAll();

    // Only show user-defined custom entries — protected defaults are never displayed
    keywordsArea.value  = toText(data.keywords  ?? []);
    regexArea.value     = toText(data.regexRules ?? []);
    whitelistArea.value = toText(data.whitelist  ?? []);
    blacklistArea.value = toText(data.blacklist  ?? []);

    const settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
    thresholdSlider.value        = settings.threshold;
    thresholdDisplay.textContent = settings.threshold;
    fuzzyToggle.checked          = settings.fuzzyEnabled;
    deepScanToggle.checked       = settings.deepScanEnabled;
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function saveSettings() {
    // Always allow whitelist/blacklist/settings to be saved
    const whitelist = toArray(whitelistArea.value);
    const blacklist = toArray(blacklistArea.value);

    const settings = {
      threshold:       parseInt(thresholdSlider.value, 10),
      fuzzyEnabled:    fuzzyToggle.checked,
      deepScanEnabled: deepScanToggle.checked
    };

    const { settings: current = {} } = await get('settings');
    settings.enabled = current.enabled !== false;

    const toSave = { whitelist, blacklist, settings };

    // Only save user custom keywords/regex if unlocked
    // Protected defaults are never touched — they live only in utils/storage.js
    if (unlocked) {
      toSave.keywords   = toArray(keywordsArea.value);
      toSave.regexRules = toArray(regexArea.value);
    }

    await set(toSave);
    showToast(unlocked ? '✓ All settings saved' : '✓ Saved (keywords locked — not changed)');
  }

  // ── Export ────────────────────────────────────────────────────────────────────

  async function exportSettings() {
    if (!unlocked) { showToast('Wait for unlock to export', 'error'); return; }
    const data = await loadAll();
    // Export only user-defined entries; protected defaults are intentionally excluded
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `smart-site-blocker-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast('⬇ Settings exported');
  }

  // ── Import ────────────────────────────────────────────────────────────────────

  async function importSettings(file) {
    if (!unlocked) { showToast('Wait for unlock to import', 'error'); return; }
    if (!file) return;
    try {
      const data   = JSON.parse(await file.text());
      const toSet  = {};
      // Only import user-defined entries; protected defaults cannot be overwritten
      if (Array.isArray(data.keywords))   toSet.keywords   = data.keywords;
      if (Array.isArray(data.regexRules)) toSet.regexRules = data.regexRules;
      if (Array.isArray(data.whitelist))  toSet.whitelist  = data.whitelist;
      if (Array.isArray(data.blacklist))  toSet.blacklist  = data.blacklist;
      if (data.settings) toSet.settings = { ...DEFAULT_SETTINGS, ...data.settings };
      if (!Object.keys(toSet).length) { showToast('Invalid file', 'error'); return; }
      await set(toSet);
      await loadSettings();
      showToast('⬆ Imported successfully');
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error');
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────────

  async function resetDefaults() {
    if (!unlocked) { showToast('Wait for unlock to reset', 'error'); return; }
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;
    // Clear user-added custom keywords/regex only; protected defaults always apply silently
    await set({
      keywords: [],
      regexRules: [],
      whitelist: [],
      blacklist: [],
      settings: DEFAULT_SETTINGS
    });
    await loadSettings();
    showToast('↺ Reset to defaults');
  }

  // ── Event listeners ──────────────────────────────────────────────────────────

  thresholdSlider.addEventListener('input', () => {
    thresholdDisplay.textContent = thresholdSlider.value;
  });

  saveBtn.addEventListener('click',   saveSettings);
  exportBtn.addEventListener('click', exportSettings);
  resetBtn.addEventListener('click',  resetDefaults);
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    importSettings(e.target.files?.[0]);
    importInput.value = '';
  });

  // ── Boot ─────────────────────────────────────────────────────────────────────

  async function init() {
    await loadSettings();
    applyLockState();
    startUnlockCountdown();
  }

  init();

})();
