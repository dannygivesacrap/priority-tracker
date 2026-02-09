// Main application module

// Current view state
let currentView = 'dashboard';

// Morning jokes
const jokes = [
    { setup: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs." },
    { setup: "Why did the developer go broke?", punchline: "Because he used up all his cache." },
    { setup: "What's a programmer's favorite hangout place?", punchline: "Foo Bar." },
    { setup: "Why do Java developers wear glasses?", punchline: "Because they can't C#." },
    { setup: "What do you call a developer who doesn't comment their code?", punchline: "A mystery writer." },
    { setup: "Why was the JavaScript developer sad?", punchline: "Because he didn't Node how to Express himself." },
    { setup: "What's a computer's least favorite food?", punchline: "Spam." },
    { setup: "Why did the functions stop calling each other?", punchline: "Because they had too many arguments." },
    { setup: "What do you call 8 hobbits?", punchline: "A hobbyte." },
    { setup: "Why do programmers always mix up Halloween and Christmas?", punchline: "Because Oct 31 == Dec 25." },
    { setup: "How do trees access the internet?", punchline: "They log in." },
    { setup: "Why was the computer cold?", punchline: "It left its Windows open." },
    { setup: "What's a computer's favorite snack?", punchline: "Microchips." },
    { setup: "Why did the PowerPoint presentation cross the road?", punchline: "To get to the other slide." },
    { setup: "What do you call a computer that sings?", punchline: "A-Dell." }
];

// Celebration types and messages - more variety!
const celebrationTypes = ['confetti', 'champagne', 'cat', 'emoji', 'stars', 'rainbow', 'fireworks', 'dance', 'rocket'];
const toastMessages = [
    "Nice work! \u2728", "You're on fire! \ud83d\udd25", "Crushed it! \ud83d\udcaa",
    "Boom! \ud83d\udca5", "Nailed it! \ud83c\udfaf", "Amazing! \ud83c\udf1f",
    "Keep going! \ud83d\ude80", "Unstoppable! \u26a1", "Legend! \ud83d\udc51",
    "Yes! \ud83c\udf89", "Woohoo! \ud83c\udf8a", "Awesome! \ud83d\udc4f"
];

// Load all data
async function loadAllData() {
    loadTasks();
    loadPriorities();
    loadAnalytics();

    // Check greeting status
    checkGreeting();

    // Initialize calendar (after DOM is ready)
    if (typeof gapi !== 'undefined') {
        initCalendarAPI();
    }
}

// Check if greeting should be shown
async function checkGreeting() {
    const greetingEl = document.getElementById('greeting');
    if (!greetingEl) return;

    try {
        const userDoc = getUserDoc();
        const doc = await userDoc.get();
        const settings = doc.data()?.settings || {};

        const today = new Date().toDateString();
        const dismissedDate = settings.greetingDismissedDate;

        if (dismissedDate === today) {
            greetingEl.classList.add('hidden');
        } else {
            greetingEl.classList.remove('hidden');
            showRandomJoke();
        }
    } catch (error) {
        console.error('Error checking greeting:', error);
        showRandomJoke();
    }
}

// Show a random joke
function showRandomJoke() {
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    const setupEl = document.querySelector('.greeting p:not(.punchline)');
    const punchlineEl = document.querySelector('.greeting .punchline');

    if (setupEl) setupEl.textContent = joke.setup;
    if (punchlineEl) punchlineEl.textContent = joke.punchline;
}

// Dismiss greeting for today
async function dismissGreeting() {
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) {
        greetingEl.classList.add('hidden');
    }

    try {
        const userDoc = getUserDoc();
        await userDoc.update({
            'settings.greetingDismissedDate': new Date().toDateString()
        });
    } catch (error) {
        console.error('Error dismissing greeting:', error);
    }
}

// Switch between views
function showView(viewName) {
    currentView = viewName;

    // Update sidebar active state
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.sidebar-item[data-view="${viewName}"]`)?.classList.add('active');

    // Update view visibility
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}View`)?.classList.add('active');
}

// Toggle sidebar
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('expanded');
}

// Add task handlers
function initAddTaskHandlers() {
    // Remove old handlers by cloning elements
    document.querySelectorAll('.add-task').forEach(btn => {
        const type = btn.dataset.type;
        if (!type) return;

        // Clone to remove old event listeners
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => showAddTaskInput(type, newBtn));
    });
}

// Show inline add task input
function showAddTaskInput(type, button) {
    // Check if already showing input
    if (button.previousElementSibling?.classList.contains('add-task-input')) {
        return;
    }

    const inputContainer = document.createElement('div');
    inputContainer.className = 'task-item add-task-input';
    inputContainer.innerHTML = `
        <div class="task-checkbox" style="visibility: hidden;"></div>
        <div class="task-content">
            <input type="text" class="task-title-input" placeholder="What needs to be done?" autofocus />
        </div>
    `;

    button.before(inputContainer);

    const input = inputContainer.querySelector('input');
    input.focus();

    const saveTask = async () => {
        const title = input.value.trim();
        inputContainer.remove();

        if (title) {
            await addTask(type, title);
        }
    };

    input.addEventListener('blur', saveTask);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            inputContainer.remove();
        }
    });
}

// Celebration system
function triggerCelebration() {
    const type = celebrationTypes[Math.floor(Math.random() * celebrationTypes.length)];
    const overlay = document.getElementById('celebrationOverlay');

    switch (type) {
        case 'confetti': createConfetti(overlay); break;
        case 'champagne': createChampagne(overlay); break;
        case 'cat': createCatPopup(); break;
        case 'emoji': createEmojiBurst(overlay); break;
        case 'stars': createStarBurst(overlay); break;
        case 'rainbow': createRainbow(overlay); break;
        case 'fireworks': createFireworks(overlay); break;
        case 'dance': createDanceParty(overlay); break;
        case 'rocket': createRocket(overlay); break;
    }

    showToast(toastMessages[Math.floor(Math.random() * toastMessages.length)]);
}

function createConfetti(overlay) {
    const colors = ['#6366f1', '#ec4899', '#f97316', '#10b981', '#fbbf24', '#8b5cf6'];
    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = (6 + Math.random() * 8) + 'px';
        confetti.style.height = (6 + Math.random() * 8) + 'px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (2 + Math.random()) + 's';
        overlay.appendChild(confetti);
    }
    setTimeout(() => overlay.innerHTML = '', 3500);
}

function createChampagne(overlay) {
    const container = document.createElement('div');
    container.className = 'champagne-container';
    container.innerHTML = '\ud83c\udf7e';
    overlay.appendChild(container);
    createConfetti(overlay);
    setTimeout(() => container.remove(), 2000);
}

function createCatPopup() {
    const popup = document.createElement('div');
    popup.className = 'cat-celebration';
    popup.innerHTML = `
        <img src="https://cataas.com/cat/gif?width=200&height=150&t=${Date.now()}"
             alt="Celebration cat"
             onerror="this.src='https://placekitten.com/200/150'">
        <p>Purrfect! \ud83d\udc31</p>
    `;
    document.body.appendChild(popup);
    popup.addEventListener('click', () => popup.remove());
    setTimeout(() => popup.remove(), 3000);
}

function createEmojiBurst(overlay) {
    const emojis = ['\ud83c\udf89', '\ud83c\udf8a', '\u2b50', '\ud83d\udcab', '\u2728', '\ud83c\udf1f', '\ud83d\udd25', '\ud83d\udcaa', '\ud83d\udc4f', '\ud83d\ude4c'];
    for (let i = 0; i < 15; i++) {
        const emoji = document.createElement('div');
        emoji.className = 'emoji-burst';
        emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        emoji.style.left = 30 + Math.random() * 40 + '%';
        emoji.style.top = 40 + Math.random() * 20 + '%';
        emoji.style.animationDelay = Math.random() * 0.3 + 's';
        overlay.appendChild(emoji);
    }
    setTimeout(() => overlay.innerHTML = '', 2500);
}

function createStarBurst(overlay) {
    for (let i = 0; i < 30; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.textContent = '\u2b50';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 0.5 + 's';
        star.style.fontSize = (16 + Math.random() * 24) + 'px';
        overlay.appendChild(star);
    }
    setTimeout(() => overlay.innerHTML = '', 2000);
}

function createRainbow(overlay) {
    const wave = document.createElement('div');
    wave.className = 'rainbow-wave';
    overlay.appendChild(wave);
    createEmojiBurst(overlay);
    setTimeout(() => wave.remove(), 2500);
}

function createFireworks(overlay) {
    const fireworks = ['\ud83c\udf86', '\ud83c\udf87', '\u2728', '\ud83d\udca5'];
    for (let i = 0; i < 20; i++) {
        const fw = document.createElement('div');
        fw.className = 'emoji-burst';
        fw.textContent = fireworks[Math.floor(Math.random() * fireworks.length)];
        fw.style.left = Math.random() * 100 + '%';
        fw.style.top = Math.random() * 60 + '%';
        fw.style.animationDelay = Math.random() * 0.8 + 's';
        fw.style.fontSize = (24 + Math.random() * 32) + 'px';
        overlay.appendChild(fw);
    }
    setTimeout(() => overlay.innerHTML = '', 3000);
}

function createDanceParty(overlay) {
    const dancers = ['\ud83d\udd7a', '\ud83d\udc83', '\ud83c\udf89', '\ud83c\udf8a', '\ud83d\udcaf'];
    for (let i = 0; i < 12; i++) {
        const dancer = document.createElement('div');
        dancer.className = 'emoji-burst';
        dancer.textContent = dancers[Math.floor(Math.random() * dancers.length)];
        dancer.style.left = 10 + Math.random() * 80 + '%';
        dancer.style.top = 30 + Math.random() * 40 + '%';
        dancer.style.animationDelay = Math.random() * 0.4 + 's';
        dancer.style.fontSize = '40px';
        overlay.appendChild(dancer);
    }
    setTimeout(() => overlay.innerHTML = '', 2500);
}

function createRocket(overlay) {
    const rocket = document.createElement('div');
    rocket.style.cssText = `
        position: fixed;
        bottom: -50px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 60px;
        animation: rocket-launch 1.5s ease-out forwards;
        z-index: 10000;
    `;
    rocket.textContent = '\ud83d\ude80';
    overlay.appendChild(rocket);

    // Add trail
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const spark = document.createElement('div');
            spark.className = 'confetti';
            spark.style.left = (45 + Math.random() * 10) + '%';
            spark.style.top = (70 + Math.random() * 30) + '%';
            spark.style.background = ['#ff6b6b', '#ffd93d', '#ff9f43'][Math.floor(Math.random() * 3)];
            spark.style.width = spark.style.height = '8px';
            overlay.appendChild(spark);
        }, i * 50);
    }

    setTimeout(() => overlay.innerHTML = '', 2500);
}

// Toast notification
function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// Mobile navigation
function initMobileNav() {
    // Tab navigation
    const tabs = document.querySelectorAll('.mobile-tab');
    const panels = document.querySelectorAll('.mobile-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const panelId = tab.dataset.panel;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show corresponding panel
            panels.forEach(p => p.classList.remove('active'));
            const targetPanel = document.getElementById(`mobile${panelId.charAt(0).toUpperCase() + panelId.slice(1)}Panel`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });

    // Menu toggle
    const menuBtn = document.getElementById('mobileMenuBtn');
    const menuOverlay = document.getElementById('mobileMenuOverlay');
    const menuClose = document.getElementById('mobileMenuClose');

    if (menuBtn && menuOverlay) {
        menuBtn.addEventListener('click', () => {
            menuOverlay.classList.add('active');
        });

        menuClose?.addEventListener('click', () => {
            menuOverlay.classList.remove('active');
        });

        menuOverlay.addEventListener('click', (e) => {
            if (e.target === menuOverlay) {
                menuOverlay.classList.remove('active');
            }
        });
    }

    // Mobile sign out
    const mobileSignOut = document.getElementById('mobileSignOut');
    if (mobileSignOut) {
        mobileSignOut.addEventListener('click', () => {
            signOut();
        });
    }

    // Mobile add task buttons
    document.querySelectorAll('.mobile-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            showMobileAddTask(type, btn);
        });
    });
}

// Show mobile add task input
function showMobileAddTask(type, button) {
    // Check if already showing input
    const existingInput = button.previousElementSibling?.querySelector('.mobile-task-input');
    if (existingInput) return;

    const container = button.previousElementSibling;
    if (!container) return;

    const inputEl = document.createElement('div');
    inputEl.className = 'task-item mobile-task-input';
    inputEl.innerHTML = `
        <div class="task-checkbox" style="visibility: hidden;"></div>
        <div class="task-content" style="flex: 1;">
            <input type="text" class="task-title-input" placeholder="What needs to be done?" style="width: 100%; font-size: 15px; padding: 8px 0;" autofocus />
        </div>
    `;

    container.appendChild(inputEl);

    const input = inputEl.querySelector('input');
    input.focus();

    const saveTask = async () => {
        const title = input.value.trim();
        inputEl.remove();

        if (title) {
            await addTask(type, title);
        }
    };

    input.addEventListener('blur', saveTask);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            inputEl.remove();
        }
    });
}

// Update mobile user info
function updateMobileUserInfo(user) {
    const avatar = document.getElementById('mobileUserAvatar');
    const name = document.getElementById('mobileUserName');

    if (avatar && user?.photoURL) {
        avatar.src = user.photoURL;
    }
    if (name && user?.displayName) {
        name.textContent = user.displayName;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Set up sidebar navigation
    document.querySelectorAll('.sidebar-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            showView(item.dataset.view);
        });
    });

    // Sidebar toggle
    document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);

    // Greeting dismiss
    document.getElementById('greetingClose')?.addEventListener('click', dismissGreeting);

    // Initialize focus mode controls
    initFocusControls();

    // Initialize mobile navigation
    initMobileNav();

    // Sign out button
    document.getElementById('signOutBtn')?.addEventListener('click', signOut);

    // Initialize global drag and drop (event delegation)
    if (typeof initGlobalDragAndDrop === 'function') {
        initGlobalDragAndDrop();
    }

    // Initialize FAB (Floating Action Button)
    initFAB();

    // Initialize dark mode
    initDarkMode();

    // Initialize add task handlers after a short delay (to ensure DOM is ready)
    setTimeout(initAddTaskHandlers, 100);
});

// Floating Action Button
function initFAB() {
    const fab = document.getElementById('fabButton');
    const fabMenu = document.getElementById('fabMenu');

    if (!fab || !fabMenu) return;

    fab.addEventListener('click', () => {
        fab.classList.toggle('active');
        fabMenu.classList.toggle('active');
    });

    // Close FAB menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!fab.contains(e.target) && !fabMenu.contains(e.target)) {
            fab.classList.remove('active');
            fabMenu.classList.remove('active');
        }
    });

    // FAB options
    fabMenu.querySelectorAll('.fab-option').forEach(option => {
        option.addEventListener('click', () => {
            const type = option.dataset.type;
            fab.classList.remove('active');
            fabMenu.classList.remove('active');
            showQuickAddTask(type);
        });
    });
}

// Quick add task from FAB
function showQuickAddTask(type) {
    const title = prompt(`Add ${type} task:`);
    if (title && title.trim()) {
        addTask(type, title.trim());
    }
}

// Dark Mode
function initDarkMode() {
    // Check saved preference
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
        updateDarkModeIcons(true);
    }

    // Desktop toggle
    const desktopToggle = document.getElementById('darkModeToggle');
    if (desktopToggle) {
        desktopToggle.addEventListener('click', toggleDarkMode);
    }

    // Mobile toggle
    const mobileToggle = document.getElementById('mobileDarkMode');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            toggleDarkMode();
            // Close mobile menu
            document.getElementById('mobileMenuOverlay')?.classList.remove('active');
        });
    }
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark);
    updateDarkModeIcons(isDark);
}

function updateDarkModeIcons(isDark) {
    const icons = document.querySelectorAll('.dark-mode-icon');
    icons.forEach(icon => {
        icon.textContent = isDark ? '☀️' : '🌙';
    });
}

// Re-initialize add task handlers when tasks render
// This runs after all scripts are loaded
window.addEventListener('load', () => {
    if (typeof renderTasks === 'function') {
        const originalRenderTasks = renderTasks;
        window.renderTasks = function() {
            originalRenderTasks();
            setTimeout(initAddTaskHandlers, 50);
        };
    }
});
