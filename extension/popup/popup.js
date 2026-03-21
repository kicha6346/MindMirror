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

  document.getElementById('login-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://mindmirror-amber.vercel.app/auth' });
  });

  document.getElementById('dashboard-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://mindmirror-amber.vercel.app/' });
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

  // ==========================================
  // POMODORO UI CONTROLLER
  // ==========================================
  const pomoSetup = document.getElementById('pomo-setup');
  const pomoActive = document.getElementById('pomo-active');
  const pomoStartBtn = document.getElementById('pomo-start-btn');
  const pomoStopBtn = document.getElementById('pomo-stop-btn');
  const pomoFocusMin = document.getElementById('pomo-focus-min');
  const pomoBreakMin = document.getElementById('pomo-break-min');
  const pomoTimerDisplay = document.getElementById('pomo-timer-display');
  const pomoModeLabel = document.getElementById('pomo-mode-label');
  const pomoScore = document.getElementById('pomo-score');
  const pomoDistractions = document.getElementById('pomo-distractions');
  const pomoDoom = document.getElementById('pomo-doom');

  let uiTickInterval = null;

  function refreshPomodoroUI() {
    chrome.runtime.sendMessage({ type: 'GET_POMODORO_STATE' }, (state) => {
      if (!state) return;

      if (state.isActive) {
        pomoSetup.style.display = 'none';
        pomoActive.style.display = 'block';

        pomoModeLabel.textContent = state.mode.toUpperCase() + " MODE";
        pomoModeLabel.style.color = state.mode === 'focus' ? '#6366f1' : '#10b981';

        pomoScore.textContent = state.final_focus_score;
        pomoDistractions.textContent = state.distractions + state.tab_switches;
        pomoDoom.textContent = state.doomscroll_cycles;

        // Calculate visual time remaining
        const elapsedMs = Date.now() - state.startTime;
        const totalMs = state.targetDurationMinutes * 60 * 1000;
        let remainingMs = totalMs - elapsedMs;
        if (remainingMs < 0) remainingMs = 0;

        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        pomoTimerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      } else {
        pomoSetup.style.display = 'block';
        pomoActive.style.display = 'none';
      }
    });
  }

  pomoStartBtn.addEventListener('click', () => {
    const focusVal = parseInt(pomoFocusMin.value, 10) || 25;
    const breakVal = parseInt(pomoBreakMin.value, 10) || 5;
    
    chrome.runtime.sendMessage({
      type: 'POMODORO_COMMAND',
      command: 'START',
      payload: {
        focusMinutes: focusVal,
        breakMinutes: breakVal
      }
    });
    refreshPomodoroUI();
  });

  pomoStopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'POMODORO_COMMAND',
      command: 'STOP'
    });
    setTimeout(refreshPomodoroUI, 100);
  });

  // Start the UI tick
  refreshPomodoroUI();
  uiTickInterval = setInterval(refreshPomodoroUI, 1000);
});
