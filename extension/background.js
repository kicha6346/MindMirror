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

function getCategory(domain) {
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
// Store usage locally before syncing: { domain: { duration: seconds, category: 'work' } }
let usageData = {}; 

// Initialize state
chrome.storage.local.get(['isPaused', 'usageData'], (result) => {
  if (result.isPaused !== undefined) isPaused = result.isPaused;
  if (result.usageData) usageData = result.usageData;
});

// Update the current duration before switching
function updateActiveDuration() {
  if (!activeTabDomain || isPaused) return;
  const now = Date.now();
  const duration = Math.floor((now - activeStartTime) / 1000);
  
  if (duration > 0) {
    if (!usageData[activeTabDomain]) {
      usageData[activeTabDomain] = {
        category: getCategory(activeTabDomain),
        duration: 0
      };
    }
    usageData[activeTabDomain].duration += duration;
    chrome.storage.local.set({ usageData });
  }
  activeStartTime = now;
}

// Listen to tab activation (switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  updateActiveDuration();
  const tab = await chrome.tabs.get(activeInfo.tabId);
  activeTabDomain = getDomain(tab.url);
  activeStartTime = Date.now();
});

// Listen to URL changes in the active tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    updateActiveDuration();
    activeTabDomain = getDomain(changeInfo.url);
    activeStartTime = Date.now();
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
  } else if (message.type === 'SYNC_USER') {
    if (message.userId) {
      chrome.storage.local.set({ userId: message.userId });
    } else {
      chrome.storage.local.remove('userId');
    }
  }
});

// Set up repeating alarm every 60 seconds to sync data
chrome.alarms.create('syncUsageData', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncUsageData') {
    syncDataToBackend();
  }
});

async function syncDataToBackend() {
  updateActiveDuration(); // Flush current active time
  
  chrome.storage.local.get(['usageData'], async (result) => {
    const dataToSync = result.usageData || {};
    const entries = Object.entries(dataToSync);
    
    if (entries.length === 0) return;

    // We will POST this to our Next.js backend
    // Format: [{ domain, category, duration_seconds }]
    const payload = entries.map(([domain, data]) => ({
        domain,
        category: data.category,
        duration_seconds: data.duration
    }));

    try {
      // Fetch actual user from storage synced from web app
      const userId = await getUserId(); 
      if (!userId) return; // Abort sync if not authenticated

      const response = await fetch('http://localhost:3000/api/ingest/browser', {
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
        console.log('Synced successfully!');
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
