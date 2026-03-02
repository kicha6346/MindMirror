// content.js
// Runs on mindmirror-amber.vercel.app to extract the Supabase auth token
function syncAuth() {
  // CRITICAL FIX: Only scrape localStorage if we are actually on the Dashboard
  // Otherwise, visiting youtube.com will find no token and instantly log you out of the extension!
  if (window.location.hostname !== 'mindmirror-amber.vercel.app' && window.location.hostname !== '127.0.0.1') {
    return; 
  }

  const keys = Object.keys(localStorage);
  const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  
  if (sbKey) {
    try {
      const data = JSON.parse(localStorage.getItem(sbKey));
      if (data && data.user && data.user.id) {
        chrome.runtime.sendMessage({ 
          type: 'SYNC_AUTH', 
          userId: data.user.id 
        });
      }
    } catch(e) {}
  } else {
    // We are on mindmirror-amber.vercel.app but no token exists -> User logged out of the dashboard
    chrome.runtime.sendMessage({ type: 'SYNC_AUTH', userId: null });
  }
}

// Check auth on load and interval
syncAuth();
setInterval(syncAuth, 5000);

// Request initial monochrome state immediately upon content script injection
try {
  chrome.runtime.sendMessage({ 
    type: 'CHECK_MONOCHROME', 
    domain: window.location.hostname.replace(/^www\./, '') 
  });
} catch(e) {}

// ============================================
// Advanced Doomscrolling Detection Algorithm
// ============================================
// Logic: scroll -> passive watch (3-15s) -> similar scroll -> passive watch.  Repeat 3+ times = Doomscrolling cycle.

let lastScrollPos = window.scrollY || 0;
let currentScrollChunk = 0; // Accumulated scroll distance in current movement
let isScrolling = false;
let scrollTimer = null;

// Pattern Tracking State
let scrollHistory = []; // Tracks relative distances of recent "jumps"
let consecutiveMisses = 0; // Fault tolerance for anomalous scrolls
let doomCyclesSession = 0; // Verified count of doomscrolling overall for this page
let doomPendingSync = 0; // Verified count waiting to sync to background
let passiveTimer = null;
let lastInteractionTime = Date.now();
const DOOM_THRESHOLD_CYCLES = 3;

// Reset passive timer on interaction
const resetInteraction = () => { lastInteractionTime = Date.now(); };
window.addEventListener('click', resetInteraction, { passive: true });
window.addEventListener('keydown', resetInteraction, { passive: true });

window.addEventListener('scroll', () => {
  const currentPos = window.scrollY;
  // Accumulate the current continuous movement
  currentScrollChunk += Math.abs(currentPos - lastScrollPos);
  lastScrollPos = currentPos;
  isScrolling = true;

  // Debounce the scroll to detect when the 'jump' finishes
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    isScrolling = false;
    evaluateScrollJump();
  }, 500); // 500ms pause means the scroll action is finished
}, { passive: true });

function evaluateScrollJump() {
  const vh = window.innerHeight;
  // Calculate relative distance (fraction of viewport)
  const relativeDistance = currentScrollChunk / vh;
  currentScrollChunk = 0; // Reset for next jump

  console.log(`[MindMirror Debug] Jump evaluated. Relative distance: ${relativeDistance.toFixed(2)}vH`);

  // Ignore tiny micro-scrolls (less than 10% of screen) or massive full-page anchor jumps
  if (relativeDistance >= 0.1 && relativeDistance <= 5.0) {
    
    // If we have history, calculate rolling average of up to the last 5 jumps for pattern matching
    if (scrollHistory.length > 0) {
      const recentHistory = scrollHistory.slice(-5);
      const averageJump = recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length;
      
      // Calculate tolerance band (+/- 40% difference from the running average)
      const diff = Math.abs(relativeDistance - averageJump);
      const isSimilar = diff <= (averageJump * 0.40);
      
      // Define "minor noise" dynamically: any scroll less than 40% of their established average
      const isMinorNoise = relativeDistance < (averageJump * 0.40);

      if (isSimilar) {
        scrollHistory.push(relativeDistance);
        consecutiveMisses = 0; // Reset misses on a successful match
        console.log(`[MindMirror Debug] Matched rolling average (${averageJump.toFixed(2)}vH). Cycle count: ${scrollHistory.length}`);
      } else if (isMinorNoise) {
        // Ignore minor scrolls relative to the user's current baseline
        console.log(`[MindMirror Debug] Ignored minor noise scroll (${relativeDistance.toFixed(2)}vH) relative to avg (${averageJump.toFixed(2)}vH). Cycle preserved.`);
      } else {
        // Significant deviation. Give them a "strike" before breaking the pattern
        consecutiveMisses++;
        if (consecutiveMisses > 1) {
          // Broke the pattern - reset
          console.log(`[MindMirror Debug] Pattern broken (2 strikes). Jump (${relativeDistance.toFixed(2)}vH) deviated too much from avg (${averageJump.toFixed(2)}vH). Restarting baseline.`);
          scrollHistory = [relativeDistance]; 
          consecutiveMisses = 0;
        } else {
          console.log(`[MindMirror Debug] Strike 1: Jump (${relativeDistance.toFixed(2)}vH) deviated from avg (${averageJump.toFixed(2)}vH). Cycle preserved for now.`);
        }
      }
    } else {
      scrollHistory.push(relativeDistance);
      consecutiveMisses = 0;
      console.log(`[MindMirror Debug] First jump recorded. Baseline set: ${relativeDistance.toFixed(2)}vH. Cycle: 1`);
    }

    // Reset interaction timer
    lastInteractionTime = Date.now();

    // Check if we hit the Doomscrolling Threshold
    if (scrollHistory.length >= DOOM_THRESHOLD_CYCLES) {
      doomCyclesSession++;
      doomPendingSync++;
      console.log(`[MindMirror] 🧟‍♂️ DOOMSCROLL CYCLE DETECTED! (${doomCyclesSession} total pattern matches this session)`);
      // We keep tracking, but pop history to require 3 MORE jumps to count another cycle
      scrollHistory.shift(); 
    }
  } else {
     console.log(`[MindMirror Debug] Ignored extreme scroll (${relativeDistance.toFixed(2)}vH) - either microscopic or a massive anchor jump.`);
     // Only penalize massive, impossible scrolls (like clicking 'Back to top') by resetting history
     if (relativeDistance > 5.0) {
       scrollHistory = [];
       consecutiveMisses = 0;
     }
     lastInteractionTime = Date.now();
  }
}

// Sync Verified Doom Cycles to background every 15 seconds
setInterval(() => {
  if (doomPendingSync > 0) {
    console.log(`[MindMirror Sync] Attempting to sync ${doomPendingSync} doomscroll cycles to background...`);
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        // Capture the exact amount we are trying to send
        const cyclesToSend = doomPendingSync;
        chrome.runtime.sendMessage({ 
          type: 'SYNC_SCROLL', 
          cycles: cyclesToSend, 
          domain: window.location.hostname.replace(/^www\./, '')
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(`[MindMirror Sync] Background script not ready. Will retry sending ${cyclesToSend} cycles next tick.`);
          } else {
            console.log(`[MindMirror Sync] Successfully synced ${cyclesToSend} cycles to background.`);
            doomPendingSync -= cyclesToSend; // Only deduct what was successfully sent
          }
        });
      }
    } catch(e) {
       console.error("[MindMirror Sync] Error:", e);
    }
  }
}, 15000);

// Ensure we don't lose data if the user closes the tab before the 15s interval hits
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === 'hidden' && doomPendingSync > 0) {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ 
          type: 'SYNC_SCROLL', 
          cycles: doomPendingSync, 
          domain: window.location.hostname.replace(/^www\./, '')
        });
        console.log(`[MindMirror Sync] Emergency flush of ${doomPendingSync} cycles on tab hide.`);
        doomPendingSync = 0; // Optimistic reset because tab is closing/hiding
      }
    } catch (e) {}
  }
});

// ============================================
// POMODORO SOFT BLOCK INJECTION
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_SOFT_BLOCK') {
    if (document.getElementById('mindmirror-soft-block')) return;

    const banner = document.createElement('div');
    banner.id = 'mindmirror-soft-block';
    Object.assign(banner.style, {
      position: 'fixed',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'auto',
      maxWidth: '680px',
      background: 'rgba(8, 12, 20, 0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(239, 68, 68, 0.4)',
      borderRadius: '14px',
      color: '#f1f5f9',
      textAlign: 'center',
      padding: '12px 20px',
      zIndex: '2147483647',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      fontSize: '14px',
      fontWeight: '600',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '16px',
      animation: 'mm-slide-down 0.35s cubic-bezier(0.34,1.56,0.64,1) both'
    });

    // Inject keyframes once
    if (!document.getElementById('mm-styles')) {
      const style = document.createElement('style');
      style.id = 'mm-styles';
      style.textContent = `
        @keyframes mm-slide-down { from { opacity:0; transform:translateX(-50%) translateY(-16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes mm-fade-in { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
      `;
      document.head.appendChild(style);
    }

    const icon = document.createElement('span');
    icon.textContent = '🍅';
    icon.style.cssText = 'font-size:16px; flex-shrink:0;';

    const text = document.createElement('span');
    text.style.cssText = 'color:#fca5a5; flex:1; text-align:left;';
    text.innerHTML = `<strong style="color:#f87171;">Focus Mode Active</strong> — Distraction logged for visiting <em>${message.domain}</em>.`;

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = 'Dismiss';
    Object.assign(dismissBtn.style, {
      padding: '5px 14px',
      background: 'rgba(239, 68, 68, 0.15)',
      color: '#f87171',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '700',
      fontSize: '12px',
      fontFamily: 'inherit',
      flexShrink: '0',
      transition: 'background 0.2s'
    });
    dismissBtn.onmouseover = () => { dismissBtn.style.background = 'rgba(239,68,68,0.28)'; };
    dismissBtn.onmouseout  = () => { dismissBtn.style.background = 'rgba(239,68,68,0.15)'; };
    dismissBtn.onclick = () => {
      banner.style.transition = 'opacity 0.25s, transform 0.25s';
      banner.style.opacity = '0';
      banner.style.transform = 'translateX(-50%) translateY(-12px)';
      setTimeout(() => banner.remove(), 280);
    };

    banner.appendChild(icon);
    banner.appendChild(text);
    banner.appendChild(dismissBtn);
    document.body.prepend(banner);

  } else if (message.type === 'SHOW_BURNOUT_POPUP') {
    // Phase 19: High Burnout Contextual Intervention
    if (document.getElementById('mindmirror-burnout-overlay')) return;
    
    // Attempt to pause any media playing on the page
    document.querySelectorAll('video, audio').forEach(media => {
      try { media.pause(); } catch(e){}
    });

    // Inject keyframes once
    if (!document.getElementById('mm-styles')) {
      const style = document.createElement('style');
      style.id = 'mm-styles';
      style.textContent = `
        @keyframes mm-slide-down { from { opacity:0; transform:translateX(-50%) translateY(-16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes mm-fade-in { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
      `;
      document.head.appendChild(style);
    }

    const overlay = document.createElement('div');
    overlay.id = 'mindmirror-burnout-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(4, 6, 15, 0.96)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: '2147483647',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    });

    // Frosted glass card
    const card = document.createElement('div');
    Object.assign(card.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      maxWidth: '520px',
      width: '90%',
      padding: '40px 36px',
      textAlign: 'center',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: '28px',
      boxShadow: '0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)',
      animation: 'mm-fade-in 0.5s cubic-bezier(0.16,1,0.3,1) both'
    });

    // Badge pill
    const badge = document.createElement('div');
    badge.style.cssText = 'display:inline-flex; align-items:center; gap:6px; padding:5px 14px; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:20px; color:#f87171; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:24px;';
    badge.innerHTML = '⚠ Critical Burnout Risk Detected';

    // Score display
    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'font-size:72px; font-weight:900; line-height:1; color:#f87171; margin-bottom:4px; text-shadow: 0 0 40px rgba(248,113,113,0.4);';
    scoreEl.textContent = `${message.score}`;

    const scoreLabel = document.createElement('p');
    scoreLabel.style.cssText = 'color:#475569; font-size:13px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; margin:0 0 28px;';
    scoreLabel.textContent = 'Burnout Risk Score / 100';

    // GIF (breathing exercise)
    const gif = document.createElement('img');
    gif.src = 'https://mindmirror-amber.vercel.app/Breathing%20Exercise.gif';
    Object.assign(gif.style, {
      width: '220px',
      height: '220px',
      borderRadius: '20px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
      marginBottom: '28px',
      objectFit: 'cover',
      border: '1px solid rgba(255,255,255,0.08)'
    });

    // Insight text
    const insightText = document.createElement('p');
    insightText.textContent = message.insight;
    Object.assign(insightText.style, {
      color: '#94a3b8',
      fontSize: '15px',
      lineHeight: '1.7',
      marginBottom: '32px',
      fontWeight: '400'
    });

    // Dismiss button
    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = '🌬 Take a Breath — Dismiss';
    Object.assign(dismissBtn.style, {
      padding: '14px 32px',
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      color: 'white',
      border: 'none',
      borderRadius: '14px',
      fontSize: '15px',
      fontWeight: '700',
      cursor: 'pointer',
      fontFamily: 'inherit',
      boxShadow: '0 8px 24px rgba(99,102,241,0.45)',
      transition: 'opacity 0.2s, transform 0.15s'
    });
    dismissBtn.onmouseover = () => { dismissBtn.style.opacity = '0.88'; dismissBtn.style.transform = 'translateY(-2px)'; };
    dismissBtn.onmouseout  = () => { dismissBtn.style.opacity = '1';    dismissBtn.style.transform = 'translateY(0)'; };
    dismissBtn.onclick = () => {
      overlay.style.transition = 'opacity 0.4s ease-out';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 420);
    };

    card.appendChild(dismissBtn);
    overlay.appendChild(card);
    document.body.prepend(overlay);
  } else if (message.type === 'UPDATE_MONOCHROME') {
    // Advanced Monochrome Mode Phase
    if (message.intensity !== undefined) {
      applyMonochromeFilter(message.intensity);
    }
  }
});

// ============================================
// ADVANCED MONOCHROME FILTER INJECTION
// ============================================
function applyMonochromeFilter(intensity) {
  // intensity is 0 to 100
  let styleEl = document.getElementById('mindmirror-monochrome-filter');
  
  if (intensity <= 0) {
    if (styleEl) styleEl.remove();
    return;
  }
  
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'mindmirror-monochrome-filter';
    document.head.appendChild(styleEl);
  }
  
  // Apply gradual transition to HTML tag
  // By using html, we ensure it covers the entire site.
  // We add a class or just override html css directly.
  const transitionRule = intensity === 100 ? 'none' : 'filter 3s ease-in-out';
  styleEl.textContent = `
    html {
      filter: grayscale(${intensity}%) !important;
      transition: ${transitionRule} !important;
    }
  `;
}
