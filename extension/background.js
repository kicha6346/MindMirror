// Domain categorization mapping
const categoryMapping = {
  'github.com': 'work',
  'notion.so': 'work',
  'stackoverflow.com': 'work',
  'docs.google.com': 'work',
  'leetcode.com': 'learning',
  'coursera.org': 'learning',
  'udemy.com': 'learning',
  'instagram.com': 'social',
  'whatsapp.com': 'social',
  'web.whatsapp.com': 'social',
  'facebook.com': 'social',
  'twitter.com': 'social',
  'x.com': 'social',
  'youtube.com': 'entertainment',
  'netflix.com': 'entertainment',
  'spotify.com': 'entertainment'
};

let userCustomCategoriesGlobal = {}; // Keep a global cached map

function getCategory(domain) {
  // 1. First, check if the user has created a custom override for this exact domain
  if (userCustomCategoriesGlobal[domain]) {
    return userCustomCategoriesGlobal[domain];
  }

  // 2. Otherwise use the default smart mapping
  for (const [key, value] of Object.entries(categoryMapping)) {
    if (domain.includes(key)) return value;
  }
  return 'other';
}

function getDomain(url) {
  try {
    const obj = new URL(url);
    return obj.hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

let activeTabDomain = null;
let activeStartTime = Date.now();
let isPaused = false;
let totalTabsOpen = 1;
// Store usage locally before syncing: { domain: { duration: seconds, category: 'work' } }
let usageData = {}; 

let userBlocklistGlobal = []; // Keep a global cached copy of the active blocklist

// Pomodoro State Machine
let pomodoroState = {
  isActive: false,
  mode: 'focus', // 'focus' or 'break'
  startTime: null,
  targetDurationMinutes: 25,
  focusMinutesConfigured: 25,
  breakMinutesConfigured: 5,
  distractions: 0,
  doomscroll_cycles: 0,
  tab_switches: 0,
  final_focus_score: 100,
  detailed_action_log: [],
  userBlocklist: []
};

// Burnout State
let burnoutState = {
  score: 0,
  insight: '',
  lastInterventionTime: 0,
  sleepDebtPenalty: 0
};

// Initialize state
chrome.storage.local.get(['isPaused', 'usageData', 'pomodoroState', 'burnoutState', 'userBlocklistGlobal', 'userCustomCategoriesGlobal', 'userId'], (result) => {
  if (result.isPaused !== undefined) isPaused = result.isPaused;
  if (result.usageData) usageData = result.usageData;
  if (result.pomodoroState) pomodoroState = result.pomodoroState;
  if (result.burnoutState) burnoutState = result.burnoutState;
  if (result.userBlocklistGlobal) userBlocklistGlobal = result.userBlocklistGlobal;
  if (result.userCustomCategoriesGlobal) userCustomCategoriesGlobal = result.userCustomCategoriesGlobal;
  
  // Reload blocklist & custom categories from API if user is authenticated
  if (result.userId) {
     fetchUserBlocklist(result.userId);
     fetchUserCustomCategories(result.userId);
  }
});

// Helper: Get user's active custom blocklist from dashboard
async function fetchUserBlocklist(userId) {
  try {
    const res = await fetch(`https://mindmirror-amber.vercel.app/api/blocklist?userId=${userId}`);
    const json = await res.json();
    if (json.success && json.blocklist) {
      // Return array of active domains
      const list = json.blocklist.filter(b => b.is_active).map(b => b.domain);
      userBlocklistGlobal = list;
      chrome.storage.local.set({ userBlocklistGlobal: list });
      return list;
    }
  } catch (e) {
    console.error('[MindMirror] Failed to fetch custom blocklist', e);
  }
  return [];
}

// Helper: Get user's custom website categorization assignments
async function fetchUserCustomCategories(userId) {
  try {
    const res = await fetch(`https://mindmirror-amber.vercel.app/api/categories?userId=${userId}`);
    const json = await res.json();
    if (json.success && json.mappings) {
      // Build an explicit lookup map: { "reddit.com": "work" }
      const overrideMap = {};
      json.mappings.forEach(m => { overrideMap[m.domain] = m.category });
      
      userCustomCategoriesGlobal = overrideMap;
      chrome.storage.local.set({ userCustomCategoriesGlobal: overrideMap });
      return overrideMap;
    }
  } catch (e) {
    console.error('[MindMirror] Failed to fetch custom categories API', e);
  }
  return {};
}

// Track baseline tabs open
chrome.tabs.query({}, (tabs) => {
  totalTabsOpen = tabs.length;
});

// Update the current duration before switching
function updateActiveDuration() {
  if (!activeTabDomain || isPaused) return;
  const now = Date.now();
  const duration = Math.floor((now - activeStartTime) / 1000);
  
  if (duration > 0 || totalTabsOpen > 0) {
    if (!usageData[activeTabDomain]) {
      usageData[activeTabDomain] = {
        category: getCategory(activeTabDomain),
        duration: 0,
        scroll_depth_pixels: 0,
        max_concurrent_tabs: 1,
        doomscroll_cycles: 0
      };
    }
    usageData[activeTabDomain].duration += duration;
    usageData[activeTabDomain].max_concurrent_tabs = Math.max(
      usageData[activeTabDomain].max_concurrent_tabs || 1, 
      totalTabsOpen
    );
    chrome.storage.local.set({ usageData });
  }
  activeStartTime = now;
}

// Listen to tab activation (switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  updateActiveDuration();
  const tab = await chrome.tabs.get(activeInfo.tabId);
  const newDomain = getDomain(tab.url);
  
  // Track Tab Switch Distractions during Focus Mode
  if (pomodoroState.isActive && pomodoroState.mode === 'focus' && newDomain !== activeTabDomain) {
    pomodoroState.tab_switches++;
    
    // Log the exact switch
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    pomodoroState.detailed_action_log.push({
      time: nowTime,
      action: 'tab_switch',
      from: activeTabDomain || 'unknown',
      to: newDomain
    });
    
    recalculateFocusScore();
  }

  activeTabDomain = newDomain;
  activeStartTime = Date.now();
  checkPomodoroSoftBlock(activeTabDomain, activeInfo.tabId);
  evaluateAndSyncMonochrome(activeInfo.tabId, activeTabDomain);
});

// Tab Hoarding Tracking
chrome.tabs.onCreated.addListener(() => {
  totalTabsOpen++;
  console.log(`[MindMirror Tracker] ➕ Tab opened. Total active tabs across browser: ${totalTabsOpen}`);
  
  if (activeTabDomain && usageData[activeTabDomain]) {
    usageData[activeTabDomain].max_concurrent_tabs = Math.max(
      usageData[activeTabDomain].max_concurrent_tabs || 1, 
      totalTabsOpen
    );
    console.log(`[MindMirror Tracker] 📈 Max tabs tracked for ${activeTabDomain} is now: ${usageData[activeTabDomain].max_concurrent_tabs}`);
  }
});

chrome.tabs.onRemoved.addListener(() => {
  totalTabsOpen = Math.max(0, totalTabsOpen - 1);
  console.log(`[MindMirror Tracker] ➖ Tab closed. Total active tabs: ${totalTabsOpen}`);
});

// Listen to URL changes in the active tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    const oldDomain = activeTabDomain;
    updateActiveDuration();
    const newDomain = getDomain(changeInfo.url);
    activeTabDomain = newDomain;
    activeStartTime = Date.now();
    
    // Check for Pomodoro Distraction (Navigating to Custom Blocklist or Builtin Social)
    if (pomodoroState.isActive && pomodoroState.mode === 'focus') {
      const cat = getCategory(newDomain);
      const isCustomBlocked = pomodoroState.userBlocklist.includes(newDomain);
      
      if (isCustomBlocked || cat === 'social' || cat === 'entertainment') {
         pomodoroState.distractions++;
         
         const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
         pomodoroState.detailed_action_log.push({
           time: nowTime,
           action: 'blocked_visit',
           from: oldDomain || 'unknown',
           to: newDomain
         });
         
         recalculateFocusScore();
      }
    }
    checkPomodoroSoftBlock(activeTabDomain, tabId);
    evaluateAndSyncMonochrome(tabId, activeTabDomain);
    
    // Check if we need to show the Critical Burnout Intervention Popup
    if (burnoutState.score >= 75 && cat !== 'other') {
      const msSinceLastIntervention = Date.now() - burnoutState.lastInterventionTime;
      const ONE_HOUR = 60 * 60 * 1000;
      
      // Only show intervention once per hour to avoid complete annoyance
      if (msSinceLastIntervention > ONE_HOUR) {
        burnoutState.lastInterventionTime = Date.now();
        chrome.storage.local.set({ burnoutState });
        
        try {
          chrome.tabs.sendMessage(tabId, { 
            type: 'SHOW_BURNOUT_POPUP', 
            score: burnoutState.score,
            insight: burnoutState.insight || "Your Burnout Risk is dangerously high. It's time to step away and recover."
          });
        } catch(e) {}
      }
    }
  }
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    updateActiveDuration();
    activeTabDomain = null;
  } else {
    // Browser gained focus, find active tab
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      if (tabs.length > 0) {
        updateActiveDuration();
        activeTabDomain = getDomain(tabs[0].url);
        activeStartTime = Date.now();
      }
    });
  }
});

// Idle state (user walked away)
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'active') {
    // User is back
    activeStartTime = Date.now();
  } else {
    // User is idle or locked screen
    updateActiveDuration();
    activeTabDomain = null;
  }
});

// Listen for messages from popup (e.g. Pause toggle) or content script (auth sync)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_PAUSE') {
    updateActiveDuration();
    isPaused = message.isPaused;
    chrome.storage.local.set({ isPaused });
    activeStartTime = Date.now(); 
  } else if (message.type === 'SYNC_AUTH') {
    chrome.storage.local.set({ userId: message.userId });
    fetchUserBlocklist(message.userId);
    fetchUserCustomCategories(message.userId);
    sendResponse({ status: 'Auth registered locally' });
  } else if (message.type === 'CHECK_MONOCHROME') {
    // Initial load request from content script
    if (sender && sender.tab && message.domain) {
      evaluateAndSyncMonochrome(sender.tab.id, message.domain);
    }
  } else if (message.type === 'SYNC_USER') {
    if (message.userId) {
      chrome.storage.local.set({ userId: message.userId });
      // Fetch initial blocklist on user auth sync
      fetchUserBlocklist(message.userId);
    } else {
      chrome.storage.local.remove('userId');
      userBlocklistGlobal = [];
    }
  } else if (message.type === 'SYNC_SCROLL' && message.domain) {
    if (!usageData[message.domain]) {
      usageData[message.domain] = {
        category: getCategory(message.domain),
        duration: 0,
        scroll_depth_pixels: 0,
        max_concurrent_tabs: totalTabsOpen,
        doomscroll_cycles: 0
      };
    }
    
    // We are now sending actual "cycles" from the content script, not pixels
    if (message.cycles) {
       usageData[message.domain].doomscroll_cycles = (usageData[message.domain].doomscroll_cycles || 0) + message.cycles;
       console.log(`[MindMirror Tracker] 📥 Received Verified Doomscroll Cycle ping from ${message.domain}: +${message.cycles}. Total buffered: ${usageData[message.domain].doomscroll_cycles}`);
       
       // Add to Pomodoro Distractions if active
       if (pomodoroState.isActive && pomodoroState.mode === 'focus') {
          pomodoroState.doomscroll_cycles += message.cycles;
          recalculateFocusScore();
       }
    } else if (message.pixels) {
       // Legacy fallback or pure pixel tracking if needed
       usageData[message.domain].scroll_depth_pixels = (usageData[message.domain].scroll_depth_pixels || 0) + message.pixels;
    }
    
    // Acknowledge receipt so content.js clears its pending queue
    chrome.storage.local.set({ usageData }, () => {
      if (typeof sendResponse === 'function') {
         sendResponse({ success: true });
      }
    });
    return true; // Keep message channel open for async response
  } else if (message.type === 'POMODORO_COMMAND') {
    handlePomodoroCommand(message.command, message.payload);
  } else if (message.type === 'GET_POMODORO_STATE') {
    if (typeof sendResponse === 'function') {
       sendResponse(pomodoroState);
    }
    return true;
  }
});

// Set up repeating alarm every 60 seconds to sync data
chrome.alarms.create('syncUsageData', { periodInMinutes: 1 });
chrome.alarms.create('syncBurnoutScore', { periodInMinutes: 15 });
chrome.alarms.create('evalMonochrome', { periodInMinutes: 0.5 }); // Evaluate logic every 30 seconds

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncUsageData') {
    syncDataToBackend();
  } else if (alarm.name === 'syncBurnoutScore') {
    fetchBurnoutState();
  } else if (alarm.name === 'evalMonochrome') {
    if (activeTabDomain) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
         if (tabs.length > 0) {
            evaluateAndSyncMonochrome(tabs[0].id, activeTabDomain);
         }
      });
    }
  }
});

async function syncDataToBackend() {
  updateActiveDuration(); // Flush current active time
  
  chrome.storage.local.get(['usageData'], async (result) => {
    const dataToSync = result.usageData || {};
    const entries = Object.entries(dataToSync);
    
    if (entries.length === 0) return;

    // We will POST this to our Next.js backend
    // Format: [{ domain, category, duration_seconds, scroll_depth_pixels, max_concurrent_tabs, doomscroll_cycles }]
    const payload = entries.map(([domain, data]) => ({
        domain,
        category: data.category,
        duration_seconds: data.duration,
        scroll_depth_pixels: data.scroll_depth_pixels || 0,
        max_concurrent_tabs: data.max_concurrent_tabs || 1,
        doomscroll_cycles: data.doomscroll_cycles || 0
    }));

    try {
      // Fetch actual user from storage synced from web app
      let userId = await getUserId(); 
      if (!userId || userId.startsWith('mock-')) {
        chrome.storage.local.remove('userId'); // Purge stale mock token
        return; // Abort sync if not authenticated
      }

      console.log(`[MindMirror Tracker] 🚀 Syncing accumulated payload to Database:`, payload);

      const response = await fetch('https://mindmirror-amber.vercel.app/api/ingest/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          usage: payload
        })
      });

      if (response.ok) {
        // Clear synced data
        usageData = {};
        chrome.storage.local.set({ usageData: {} });
        console.log(`[MindMirror Tracker] ✅ Successfully flushed data to database!`);
      } else {
        console.error(`[MindMirror Tracker] ❌ API rejected payload:`, await response.text());
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  });
}

// Helper to get real user ID
async function getUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['userId'], (result) => {
      resolve(result.userId || null);
    });
  });
}

// Background poller for the Burnout Logic Score
async function fetchBurnoutState() {
  const userId = await getUserId();
  if (!userId || userId.startsWith('mock-')) return;
  
  try {
    const scoreRes = await fetch(`https://mindmirror-amber.vercel.app/api/score?userId=${userId}`);
    const scoreJson = await scoreRes.json();
    
    if (scoreJson.success && scoreJson.current) {
      burnoutState.score = scoreJson.current.score;
      burnoutState.sleepDebtPenalty = scoreJson.current.sleepDebtPenalty || 0;
      
      // If score is high, actively fetch a personalized insight for the popup
      if (burnoutState.score >= 75) {
        const insightRes = await fetch(`https://mindmirror-amber.vercel.app/api/insights`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ userId })
        });
        const insightJson = await insightRes.json();
        if (insightJson.insight) {
           burnoutState.insight = insightJson.insight;
        }
      } else {
        // Clear insight if we are healthy
        burnoutState.insight = '';
      }
      
      chrome.storage.local.set({ burnoutState });
      console.log(`[MindMirror] 🔄 Synced Burnout Risk: ${burnoutState.score}/100`);
      
      // Also sync blocklist silently
      fetchUserBlocklist(userId);
    }
  } catch(e) {
    console.error("[MindMirror] Failed to fetch burnout state", e);
  }
}

// ==========================================
// ADVANCED MONOCHROME MODE LOGIC
// ==========================================
function evaluateAndSyncMonochrome(tabId, domain) {
  if (!tabId || !domain) return;
  // Exclude system/dashboard pages
  if (domain === 'mindmirror-amber.vercel.app' || domain === '127.0.0.1' || domain.includes('mindmirror')) {
     chrome.tabs.sendMessage(tabId, { type: 'UPDATE_MONOCHROME', intensity: 0 }).catch(()=>{});
     return;
  }

  const isBlocked = userBlocklistGlobal.includes(domain);
  const cat = getCategory(domain);

  let intensity = 0;

  // The user requested that ONLY sites on the user_blocklists get monochrome, and it must be 100%.
  // Remove all other burnout/gradual desaturation logic.
  if (isBlocked) {
    intensity = 100; // Force immediate 100% grayscale for custom blocked sites
  }

  console.log(`[MindMirror Monochrome] Evaluating ${domain} - Burnout: ${burnoutState.score}, Blocked Mins: ${usageData[domain] ? Math.floor(usageData[domain].duration / 60) : 0}, Final Filter: ${intensity}% grayscale`);

  try {
    chrome.tabs.sendMessage(tabId, { type: 'UPDATE_MONOCHROME', intensity: intensity }).catch(()=>{});
  } catch(e) {}
}

// ==========================================
// POMODORO FOCUS ENGINE
// ==========================================

function recalculateFocusScore() {
  // Start at 100. Deduct 5 points per distraction (social media), 15 per doomscroll cycle, 2 per tab switch
  let penalty = (pomodoroState.distractions * 5) + 
                (pomodoroState.doomscroll_cycles * 15) + 
                (pomodoroState.tab_switches * 2);
  pomodoroState.final_focus_score = Math.max(0, 100 - penalty);
  chrome.storage.local.set({ pomodoroState });
}

function checkPomodoroSoftBlock(domain, tabId) {
  if (!pomodoroState.isActive || pomodoroState.mode !== 'focus') return;
  
  const cat = getCategory(domain);
  const isCustomBlocked = pomodoroState.userBlocklist.includes(domain);
  
  if (isCustomBlocked || cat === 'social' || cat === 'entertainment') {
    // Tell content script to inject the Soft Block UI Banner
    try {
      chrome.tabs.sendMessage(tabId, { type: 'SHOW_SOFT_BLOCK', domain });
    } catch(e) {}
  }
}

async function handlePomodoroCommand(cmd, payload) {
  if (cmd === 'START') {
    const userId = await getUserId();
    let blocklist = [];
    if (userId && !userId.startsWith('mock-')) {
      blocklist = await fetchUserBlocklist(userId);
    }
    
    // Parse inputs correctly (Popup might send focusMinutes or focusTime as strings)
    const targetMins = parseInt(payload.focusMinutes || payload.focusTime || 25, 10);
    let breakMins = parseInt(payload.breakMinutes || payload.breakTime || 5, 10);
    
    // Phase 20: Dynamic Pomodoro Override based on inferred Sleep Debt
    if (burnoutState && burnoutState.sleepDebtPenalty > 0) {
      console.log(`[MindMirror] 🛑 Overriding manual Pomodoro break config from ${breakMins}m -> 15m due to Sleep Debt Penalty.`);
      breakMins = 15;
    }
    
    pomodoroState = {
      isActive: true,
      mode: 'focus',
      startTime: Date.now(),
      targetDurationMinutes: targetMins,
      focusMinutesConfigured: targetMins,
      breakMinutesConfigured: breakMins,
      distractions: 0,
      doomscroll_cycles: 0,
      tab_switches: 0,
      final_focus_score: 100,
      detailed_action_log: [],
      userBlocklist: blocklist
    };
    chrome.storage.local.set({ pomodoroState });
    chrome.alarms.create('pomodoroTick', { periodInMinutes: 0.5 }); // Evaluate every 30s
  } else if (cmd === 'STOP') {
    // Force end the session immediately.
    syncPomodoroSession(); 
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoroTick') {
    tickPomodoro();
  }
});

function tickPomodoro() {
  if (!pomodoroState.isActive) {
    chrome.alarms.clear('pomodoroTick');
    return;
  }

  const elapsedMs = Date.now() - pomodoroState.startTime;
  const elapsedMinutes = elapsedMs / (1000 * 60);

  if (elapsedMinutes >= pomodoroState.targetDurationMinutes) {
    // Phase complete
    if (pomodoroState.mode === 'focus') {
      // Focus done, switch to break
      syncPomodoroSession(); // Save focus data safely
      pomodoroState.mode = 'break';
      pomodoroState.startTime = Date.now();
      pomodoroState.targetDurationMinutes = pomodoroState.breakMinutesConfigured;
      chrome.storage.local.set({ pomodoroState });
    } else {
      // Break done, wait for explicit restart
      pomodoroState.isActive = false;
      chrome.storage.local.set({ pomodoroState });
      chrome.alarms.clear('pomodoroTick');
    }
  }
}

async function syncPomodoroSession() {
  if (!pomodoroState.isActive || pomodoroState.mode !== 'focus') return;

  const userId = await getUserId();
  if (!userId || userId.startsWith('mock-')) return;

  // Calculate actual elapsed minutes up to exactly when they halted
  const elapsedMs = Date.now() - pomodoroState.startTime;
  const actualFocusMinutes = Math.floor(elapsedMs / (1000 * 60));
  
  const status = actualFocusMinutes >= pomodoroState.targetDurationMinutes ? 'completed' : 'aborted';

  const payload = {
    userId: userId,
    startTime: pomodoroState.startTime,
    endTime: Date.now(),
    status: status,
    targetMinutes: pomodoroState.targetDurationMinutes,
    completedMinutes: actualFocusMinutes,
    breakMinutes: pomodoroState.breakMinutesConfigured,
    tabSwitches: pomodoroState.tab_switches,
    blockedVisits: pomodoroState.distractions,
    doomscrollCycles: pomodoroState.doomscroll_cycles,
    distractionLog: pomodoroState.detailed_action_log,
    focusScore: pomodoroState.final_focus_score
  };

  try {
    const res = await fetch('https://mindmirror-amber.vercel.app/api/pomodoro/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
       console.log(`[MindMirror Pomodoro] ✅ Synced session scoring ${payload.focusScore} to completely new DB schema.`);
    }
  } catch (e) {
    console.error("[MindMirror Pomodoro] Failed to sync session", e);
  }

  // Deactivate if STOP was pressed manually
  pomodoroState.isActive = false;
  chrome.storage.local.set({ pomodoroState });
  chrome.alarms.clear('pomodoroTick');
}
