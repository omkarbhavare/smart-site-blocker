/**
 * popup.js
 * ---------
 * Popup controller for Smart Site Blocker.
 *
 * Security rules:
 *  - Adding new keywords: immediate.
 *  - Removing / modifying existing keywords: requires surviving a 15-minute
 *    countdown that resets if the popup is closed or loses focus.
 *  - While locked, the × buttons are disabled and a countdown is shown.
 *  - No intermediate hints or confirmation dialogs — just wait.
 */

(function () {
  'use strict';

  // ── Storage helpers ──────────────────────────────────────────────────────────

  const get = (keys) => new Promise((res) => chrome.storage.sync.get(keys, res));
  const set = (items) => new Promise((res) => chrome.storage.sync.set(items, res));

  async function getKeywords()          { const { keywords = [] } = await get('keywords'); return keywords; }
  async function saveKeywords(kw)       { await set({ keywords: kw }); }
  async function getSettings()          { const { settings = { enabled: true } } = await get('settings'); return settings; }
  async function saveSettings(patch)    { const c = await getSettings(); await set({ settings: { ...c, ...patch } }); }
  async function getBlockedCount()      { const { blockedCount = 0 } = await get('blockedCount'); return blockedCount; }

  // ── 15-minute unlock countdown ───────────────────────────────────────────────

  const UNLOCK_SECONDS = 20 * 60;

  let unlockSecondsLeft = UNLOCK_SECONDS;
  let unlockIntervalId  = null;
  let unlocked          = false;

  function fmtTime(s) {
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function updateLockUI() {
    const lockEl = document.getElementById('lockCountdown');
    if (!lockEl) return;
    if (unlocked) {
      lockEl.textContent = '🔓 Editing unlocked';
      lockEl.classList.add('unlocked');
      // Enable all remove buttons
      document.querySelectorAll('.btn-remove').forEach(b => b.disabled = false);
    } else {
      lockEl.textContent = `🔒 Removal locked — ${fmtTime(unlockSecondsLeft)}`;
      lockEl.classList.remove('unlocked');
      document.querySelectorAll('.btn-remove').forEach(b => b.disabled = true);
    }
  }

  function tickUnlock() {
    unlockSecondsLeft--;
    if (unlockSecondsLeft <= 0) {
      clearInterval(unlockIntervalId);
      unlockIntervalId = null;
      unlocked = true;
    }
    updateLockUI();
  }

  function startUnlockCountdown() {
    if (unlocked || unlockIntervalId !== null) return;
    unlockIntervalId = setInterval(tickUnlock, 1000);
  }

  /** Reset the unlock countdown completely. Called when popup loses focus. */
  function resetUnlockCountdown() {
    if (unlocked) return; // Already unlocked — don't reset
    clearInterval(unlockIntervalId);
    unlockIntervalId  = null;
    unlockSecondsLeft = UNLOCK_SECONDS;
    updateLockUI();
  }

  // Reset if popup window blurs (user switches away)
  window.addEventListener('blur', resetUnlockCountdown);

  // ── DOM refs ─────────────────────────────────────────────────────────────────

  const enableToggle = document.getElementById('enableToggle');
  const statusLabel  = document.getElementById('statusLabel');
  const blockedCount = document.getElementById('blockedCount');
  const keywordList  = document.getElementById('keywordList');
  const newKeyword   = document.getElementById('newKeyword');
  const addBtn       = document.getElementById('addBtn');
  const optionsLink  = document.getElementById('optionsLink');

  // ── Render ───────────────────────────────────────────────────────────────────

  function renderKeywords(keywords) {
    keywordList.innerHTML = '';

    if (!keywords.length) {
      keywordList.innerHTML = '<div class="empty-state">No keywords added yet.</div>';
      return;
    }

    keywords.forEach((kw, idx) => {
      const item = document.createElement('div');
      item.className = 'keyword-item';

      const text = document.createElement('span');
      text.className   = 'keyword-text';
      text.textContent = kw;
      text.title       = kw;

      const removeBtn = document.createElement('button');
      removeBtn.className   = 'btn-remove';
      removeBtn.textContent = '×';
      removeBtn.title       = unlocked ? `Remove "${kw}"` : 'Locked — wait for countdown';
      removeBtn.disabled    = !unlocked;
      removeBtn.addEventListener('click', () => {
        if (!unlocked) return;
        removeKeyword(idx);
      });

      item.appendChild(text);
      item.appendChild(removeBtn);
      keywordList.appendChild(item);
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function addKeyword() {
    const value = newKeyword.value.trim().toLowerCase();
    if (!value) return;
    const keywords = await getKeywords();
    if (keywords.includes(value)) { newKeyword.value = ''; return; }
    const updated = [...keywords, value];
    await saveKeywords(updated);
    newKeyword.value = '';
    renderKeywords(updated);
    updateLockUI();
  }

  async function removeKeyword(idx) {
    if (!unlocked) return;
    const keywords = await getKeywords();
    const updated  = keywords.filter((_, i) => i !== idx);
    await saveKeywords(updated);
    renderKeywords(updated);
    updateLockUI();
  }

  // async function handleToggle() {
  //   const enabled = enableToggle.checked;
  //   statusLabel.textContent = enabled ? 'ON' : 'OFF';
  //   await saveSettings({ enabled });
  // }

  // ── Init ─────────────────────────────────────────────────────────────────────

  async function init() {
    const [settings, keywords, count] = await Promise.all([
      getSettings(),
      getKeywords(),
      getBlockedCount()
    ]);

    enableToggle.checked    = settings.enabled !== false;
    statusLabel.textContent = enableToggle.checked ? 'ON' : 'OFF';
    blockedCount.textContent = count.toLocaleString();

    renderKeywords(keywords);
    updateLockUI();
    startUnlockCountdown();
  }

  // ── Event listeners ──────────────────────────────────────────────────────────

  // enableToggle.addEventListener('change', handleToggle);
  addBtn.addEventListener('click', addKeyword);
  newKeyword.addEventListener('keydown', (e) => { if (e.key === 'Enter') addKeyword(); });
  optionsLink.addEventListener('click', () => { chrome.runtime.openOptionsPage(); window.close(); });

  init();

})();
