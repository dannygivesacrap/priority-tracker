// Focus mode module

let focusState = {
    active: false,
    taskId: null,
    taskTitle: '',
    duration: 20 * 60, // 20 minutes in seconds
    remaining: 20 * 60,
    paused: false,
    intervalId: null,
    startTime: null
};

// Open focus mode for a task
function openFocusMode(taskId, taskTitle, duration = 20) {
    focusState.taskId = taskId;
    focusState.taskTitle = taskTitle;
    focusState.duration = duration * 60;
    focusState.remaining = duration * 60;
    focusState.paused = false;
    focusState.active = true;
    focusState.startTime = Date.now();

    // Update UI
    const overlay = document.getElementById('focusOverlay');
    const timerEl = document.getElementById('focusTimer');
    const taskEl = document.getElementById('focusTask');
    const progressEl = document.getElementById('focusProgress');
    const pauseBtn = document.querySelector('.focus-btn.secondary');

    taskEl.textContent = taskTitle;
    timerEl.textContent = formatTime(focusState.remaining);
    progressEl.style.width = '0%';
    pauseBtn.textContent = 'Pause';

    overlay.classList.add('active');

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Start the timer
    startTimer();
}

// Start/resume the timer
function startTimer() {
    if (focusState.intervalId) {
        clearInterval(focusState.intervalId);
    }

    focusState.paused = false;
    focusState.startTime = Date.now() - ((focusState.duration - focusState.remaining) * 1000);

    focusState.intervalId = setInterval(() => {
        if (focusState.paused) return;

        focusState.remaining--;

        // Update timer display
        const timerEl = document.getElementById('focusTimer');
        timerEl.textContent = formatTime(focusState.remaining);

        // Update progress bar
        const progressEl = document.getElementById('focusProgress');
        const progress = ((focusState.duration - focusState.remaining) / focusState.duration) * 100;
        progressEl.style.width = `${progress}%`;

        // Check if timer is complete
        if (focusState.remaining <= 0) {
            completeTimer();
        }
    }, 1000);
}

// Pause the timer
function pauseTimer() {
    focusState.paused = true;

    const pauseBtn = document.querySelector('.focus-btn.secondary');
    pauseBtn.textContent = 'Resume';
}

// Resume the timer
function resumeTimer() {
    focusState.paused = false;

    const pauseBtn = document.querySelector('.focus-btn.secondary');
    pauseBtn.textContent = 'Pause';
}

// Toggle pause/resume
function togglePause() {
    if (focusState.paused) {
        resumeTimer();
    } else {
        pauseTimer();
    }
}

// Complete the timer
function completeTimer() {
    clearInterval(focusState.intervalId);
    focusState.intervalId = null;

    // Show notification
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Focus Session Complete!', {
            body: `Great work on: ${focusState.taskTitle}`,
            icon: '/favicon.ico'
        });
    }

    // Play sound (optional - using Web Audio API)
    playCompletionSound();

    // Show completion UI
    const timerEl = document.getElementById('focusTimer');
    timerEl.textContent = 'Done!';

    // Trigger celebration
    triggerCelebration();

    // Auto close after delay
    setTimeout(() => {
        if (focusState.active) {
            closeFocusMode(true);
        }
    }, 3000);
}

// Close focus mode
function closeFocusMode(completed = false) {
    clearInterval(focusState.intervalId);
    focusState.intervalId = null;
    focusState.active = false;

    const overlay = document.getElementById('focusOverlay');
    overlay.classList.remove('active');

    // If completed, optionally mark the task as done
    if (completed && focusState.taskId) {
        // Find the task type
        const workTask = tasks.work.find(t => t.id === focusState.taskId);
        const personalTask = tasks.personal.find(t => t.id === focusState.taskId);

        if (workTask || personalTask) {
            const shouldComplete = confirm('Mark this task as completed?');
            if (shouldComplete) {
                const type = workTask ? 'work' : 'personal';
                completeTask(focusState.taskId, type);
            }
        }
    }

    // Reset state
    focusState.taskId = null;
    focusState.taskTitle = '';
}

// Complete task from focus mode
async function completeFocusTask() {
    if (!focusState.taskId) {
        closeFocusMode();
        return;
    }

    // Find the task type
    const workTask = tasks.work.find(t => t.id === focusState.taskId);
    const personalTask = tasks.personal.find(t => t.id === focusState.taskId);

    if (workTask || personalTask) {
        const type = workTask ? 'work' : 'personal';
        await completeTask(focusState.taskId, type);
        triggerCelebration();
    }

    closeFocusMode();
}

// Format seconds to MM:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Play a simple completion sound using Web Audio API
function playCompletionSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);

        // Play a second tone
        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();

            osc2.connect(gain2);
            gain2.connect(audioContext.destination);

            osc2.frequency.value = 1000;
            osc2.type = 'sine';

            gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            osc2.start(audioContext.currentTime);
            osc2.stop(audioContext.currentTime + 0.5);
        }, 200);
    } catch (e) {
        console.log('Could not play sound:', e);
    }
}

// Initialize focus mode controls
function initFocusControls() {
    const pauseBtn = document.querySelector('.focus-btn.secondary');
    const completeBtn = document.querySelector('.focus-btn.primary');
    const closeBtn = document.querySelector('.focus-close');

    if (pauseBtn) {
        pauseBtn.addEventListener('click', togglePause);
    }

    if (completeBtn) {
        completeBtn.addEventListener('click', completeFocusTask);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeFocusMode(false));
    }
}

// Handle keyboard shortcuts in focus mode
document.addEventListener('keydown', (e) => {
    if (!focusState.active) return;

    if (e.key === 'Escape') {
        closeFocusMode(false);
    } else if (e.key === ' ') {
        e.preventDefault();
        togglePause();
    }
});
