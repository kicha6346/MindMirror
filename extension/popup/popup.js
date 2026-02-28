document.addEventListener('DOMContentLoaded', () => {
  const pauseToggle = document.getElementById('pause-toggle');
  const statusText = document.getElementById('status-text');
  const unauthView = document.getElementById('unauth-view');
  const authView = document.getElementById('auth-view');
  const loginBtn = document.getElementById('login-btn');
  const dashboardBtn = document.getElementById('dashboard-btn');

  // Load initial state
  chrome.storage.local.get(['isPaused', 'userId'], (result) => {
    if (result.userId) {
      unauthView.style.display = 'none';
      authView.style.display = 'block';
    } else {
      unauthView.style.display = 'block';
      authView.style.display = 'none';
    }

    const isPaused = result.isPaused || false;
    pauseToggle.checked = isPaused;
    updateStatusText(isPaused);
  });

  loginBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/auth' });
  });

  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/' });
  });

  // Handle toggle change
  pauseToggle.addEventListener('change', (e) => {
    const isPaused = e.target.checked;
    updateStatusText(isPaused);
    
    // Notify background script
    chrome.runtime.sendMessage({
      type: 'TOGGLE_PAUSE',
      isPaused: isPaused
    });
  });

  function updateStatusText(isPaused) {
    if (isPaused) {
      statusText.textContent = 'Paused';
      statusText.className = 'paused';
    } else {
      statusText.textContent = 'Active';
      statusText.className = 'active';
    }
  }
});
