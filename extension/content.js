// content.js
// Runs on localhost:3000 to extract the Supabase auth token
function syncAuth() {
  const keys = Object.keys(localStorage);
  const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  
  if (sbKey) {
    try {
      const data = JSON.parse(localStorage.getItem(sbKey));
      if (data && data.user && data.user.id) {
        chrome.runtime.sendMessage({ 
          type: 'SYNC_USER', 
          userId: data.user.id 
        });
      }
    } catch(e) {}
  } else {
    chrome.runtime.sendMessage({ type: 'SYNC_USER', userId: null });
  }
}

// Check auth on load and interval
syncAuth();
setInterval(syncAuth, 5000);
