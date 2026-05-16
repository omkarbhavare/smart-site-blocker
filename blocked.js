/**
 * blocked.js
 * ----------
 * Powers the Smart Site Blocker interception page.
 *
 * Rules:
 *  - 10-minute countdown that only ticks while this tab is ACTIVE and FOCUSED.
 *  - Switching tabs, minimizing, or losing window focus RESETS the timer to 10:00.
 *  - Timer does NOT start ticking until the user is actually looking at the page.
 *  - Rotating stoic quotes — no reason for the block is shown.
 *  - No "request unblock" button.
 */

(function () {
  'use strict';

  const TOTAL_SECONDS  = 20 * 60;
  const CIRCUMFERENCE  = 2 * Math.PI * 66; // r=66

  const QUOTES = [
  { text: "Back again? Pathetic. Go study, loser." },
  { text: "You chose porn over your future. Again." },
  { text: "Bro really thought scrolling builds success. Clown." },
  { text: "Your competitor just studied. You watched reels." },
  { text: "Another session wasted. Proud of yourself?" },
  { text: "You're literally choosing failure right now. Idiot." },
  { text: "Instagram won't pay your bills. Get out." },
  { text: "You came back. Pathetic doesn't cover it." },
  { text: "Jerking off won't make you successful. Leave." },
  { text: "They're grinding. You're here. That's why you'll lose." },
  { text: "Close this. You're embarrassing your future self." },
  { text: "Back again? You actually deserve to fail." },
  { text: "No discipline. No future. Simple math, dumbass." },
  { text: "Your dreams died the moment you clicked here." },
  { text: "Cricbuzz won't clear your exam. Get lost." },
  { text: "You're soft. That's why you keep losing." },
  { text: "Fucking loser. Close this and open your books." },
  { text: "This site is for quitters. Are you one?" },
  { text: "You chose this over your goals. Shameful." },
  { text: "Another wasted hour. Another lost opportunity. Clown." },
  { text: "Bro you're actually cooked if you stay." },
  { text: "You want success but act like a bum." },
  { text: "Your rival doesn't even know this site exists." },
  { text: "Every minute here is a win for your enemy." },
  { text: "You won't make it. This proves it." },
  { text: "Weak mind. Weak future. Get the fuck out." },
  { text: "Still here? You don't want it enough." },
  { text: "Success doesn't visit people watching cricket highlights." },
  { text: "You're wasting the one life you got. Moron." },
  { text: "Go back to studying or stay a loser." },
  { text: "This is exactly why nobody believes in you." },
  { text: "Sucker. You don't have what it takes. Leave." },
  { text: "You had time. You blew it. Again. Idiot." },
  { text: "Your parents are sacrificing. You're watching reels. Disgusting." },
  { text: "Close this tab or accept being average forever." },
  { text: "You think winners scroll Instagram at 2am? Leave." },
  { text: "You're not tired. You're just fucking weak." },
  { text: "Back here again? You deserve every L coming." },
  { text: "This is a losers' waiting room. Don't sit." },
  { text: "Another day wasted. Another dream quietly dying. Loser." },
  { text: "You clicked here. Your competitor clicked 'next chapter.'" },
  { text: "You're not relaxing. You're surrendering. Big difference, idiot." },
  { text: "Bro really thought one more scroll won't hurt." },
  { text: "You're broke in the future because of right now." },
  { text: "Stop watching others live. Go build your shit." },
  { text: "You could've studied. You chose this. Coward." },
  { text: "Nobody respects a man with no self-control. Leave." },
  { text: "You think this is a break? It's a grave." },
  { text: "Your excuses are loud. Your results are silent." },
  { text: "Fucking hell, close this. Your future hates you right now." },
];

  // ── State ────────────────────────────────────────────────────────────────────

  let secondsLeft  = TOTAL_SECONDS;
  let intervalId   = null;
  let quoteIndex   = Math.floor(Math.random() * QUOTES.length);
  let bannerTimer  = null;
  /** Whether the page currently has both visibility and window focus */
  let isActive     = false;

  // ── DOM ──────────────────────────────────────────────────────────────────────

  const timerEl   = document.getElementById('timerDisplay');
  const ringEl    = document.getElementById('ringFill');
  const quoteEl   = document.getElementById('quoteText');
  const authorEl  = document.getElementById('quoteAuthor');
  const urlEl     = document.getElementById('blockedUrl');
  const goBackBtn = document.getElementById('goBackBtn');
  const banner    = document.getElementById('resetBanner');

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function fmt(s) {
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function updateRing() {
    const fraction = secondsLeft / TOTAL_SECONDS;
    const offset   = CIRCUMFERENCE * (1 - fraction);
    ringEl.style.strokeDasharray  = CIRCUMFERENCE;
    ringEl.style.strokeDashoffset = offset;
    const urgent = secondsLeft <= 60;
    timerEl.classList.toggle('urgent', urgent);
    ringEl.classList.toggle('urgent', urgent);
  }

  function cycleQuote() {
    quoteEl.classList.add('exit');
    authorEl.classList.add('exit');
    setTimeout(() => {
      quoteIndex = (quoteIndex + 1) % QUOTES.length;
      const q = QUOTES[quoteIndex];
      quoteEl.classList.remove('exit');
      quoteEl.classList.add('enter');
      authorEl.classList.remove('exit');
      quoteEl.textContent  = q.text;
      authorEl.textContent = `— ${q.author}`;
      void quoteEl.offsetHeight;
      quoteEl.classList.remove('enter');
    }, 520);
  }

  function showResetBanner() {
    banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('show'), 3500);
  }

  // ── Countdown ────────────────────────────────────────────────────────────────

  function tick() {
    secondsLeft--;
    timerEl.textContent = fmt(secondsLeft);
    updateRing();
    if (secondsLeft <= 0) {
      stopCountdown();
      timerEl.textContent = '00:00';
      goBackBtn.classList.add('visible');
    }
  }

  function startCountdown() {
    if (intervalId !== null || secondsLeft <= 0) return;
    intervalId = setInterval(tick, 1000);
  }

  function stopCountdown() {
    clearInterval(intervalId);
    intervalId = null;
  }

  /**
   * Full reset: stop ticking, restore to 10:00, hide the go-back button.
   * Called whenever the user tries to leave the page.
   * @param {boolean} [showBanner=true]
   */
  function resetCountdown(showBanner = true) {
    stopCountdown();
    secondsLeft = TOTAL_SECONDS;
    timerEl.textContent = fmt(secondsLeft);
    goBackBtn.classList.remove('visible');
    updateRing();
    if (showBanner) showResetBanner();
  }

  // ── Visibility / focus management ────────────────────────────────────────────

  /**
   * Recompute whether the page is both visible and focused.
   * If active → start ticking (if not already).
   * If inactive → reset and stop ticking.
   * @param {boolean} triggeredByLeave — true when called because user LEFT
   */
  function syncActive(triggeredByLeave) {
    const visible = !document.hidden;
    const focused = document.hasFocus();
    const nowActive = visible && focused;

    if (nowActive === isActive) return; // No change
    isActive = nowActive;

    if (isActive) {
      // User returned — just resume, no reset (reset already happened on leave)
      startCountdown();
    } else {
      // User left — reset
      resetCountdown(triggeredByLeave);
    }
  }

  document.addEventListener('visibilitychange', () => {
    syncActive(document.hidden); // hidden = they left
  });

  window.addEventListener('blur', () => {
    syncActive(true);
  });

  window.addEventListener('focus', () => {
    syncActive(false);
  });

  // ── Quote rotation ───────────────────────────────────────────────────────────

  setInterval(cycleQuote, 30_000);

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    const params = new URLSearchParams(window.location.search);
    const rawUrl = params.get('url') || '';
    if (rawUrl && urlEl) {
      urlEl.textContent = rawUrl.length > 80 ? rawUrl.slice(0, 80) + '…' : rawUrl;
    }

    const first = QUOTES[quoteIndex];
    quoteEl.textContent  = first.text;
    authorEl.textContent = `— ${first.author}`;

    timerEl.textContent = fmt(secondsLeft);
    updateRing();

    // Only start ticking if the page is already active when it loads
    isActive = !document.hidden && document.hasFocus();
    if (isActive) startCountdown();
    // If not active yet (e.g. opened in background tab), wait for focus event
  }

  document.addEventListener('DOMContentLoaded', init);

})();
