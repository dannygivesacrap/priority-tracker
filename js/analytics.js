// Analytics module

// Analytics state
let completedPrioritiesListener = null;
let completedPrioritiesList = [];
let analyticsTimePeriod = 'week'; // 'day', 'week', 'month'

// Load completed priorities from Firestore
function loadAnalytics() {
    loadCompletedPriorities();
}

function loadCompletedPriorities() {
    const userDoc = getUserDoc();

    if (completedPrioritiesListener) completedPrioritiesListener();

    completedPrioritiesListener = userDoc.collection('completedPriorities')
        .orderBy('completedAt', 'desc')
        .onSnapshot(snapshot => {
            completedPrioritiesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderAnalytics();
        }, error => {
            console.error('Error loading completed priorities:', error);
        });
}

// Get time period boundaries
function getTimePeriodRange(period) {
    const now = new Date();
    const start = new Date(now);

    switch (period) {
        case 'day':
            start.setHours(0, 0, 0, 0);
            break;
        case 'week':
            start.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
            start.setHours(0, 0, 0, 0);
            break;
        case 'month':
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
    }

    return { start, end: now };
}

// Get period label for display
function getPeriodLabel(period) {
    switch (period) {
        case 'day': return 'Today';
        case 'week': return 'This Week';
        case 'month': return 'This Month';
        default: return 'This Week';
    }
}

// Get all completed tasks within a time period
function getCompletedTasksInPeriod(period) {
    const { start, end } = getTimePeriodRange(period);
    const allTasks = [...(tasks.work || []), ...(tasks.personal || [])];

    return allTasks.filter(task => {
        if (!task.completed || !task.completedAt) return false;
        const completedDate = task.completedAt.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
        return completedDate >= start && completedDate <= end;
    });
}

// Get completed priorities within a time period
function getCompletedPrioritiesInPeriod(period) {
    const { start, end } = getTimePeriodRange(period);

    return completedPrioritiesList.filter(p => {
        if (!p.completedAt) return false;
        const completedDate = p.completedAt.toDate ? p.completedAt.toDate() : new Date(p.completedAt);
        return completedDate >= start && completedDate <= end;
    });
}

// Get daily breakdown for the current period
function getDailyBreakdown(period) {
    const { start, end } = getTimePeriodRange(period);
    const allTasks = [...(tasks.work || []), ...(tasks.personal || [])];
    const days = {};

    // Initialize all days in range
    const current = new Date(start);
    while (current <= end) {
        const key = current.toISOString().split('T')[0];
        days[key] = { date: new Date(current), work: 0, personal: 0 };
        current.setDate(current.getDate() + 1);
    }

    // Count completions per day
    allTasks.forEach(task => {
        if (!task.completed || !task.completedAt) return;
        const completedDate = task.completedAt.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
        if (completedDate < start || completedDate > end) return;

        const key = completedDate.toISOString().split('T')[0];
        if (days[key]) {
            days[key][task.type]++;
        }
    });

    return Object.values(days);
}

// Render analytics view
function renderAnalytics() {
    renderDesktopAnalytics();
    renderMobileAnalytics();
}

function renderDesktopAnalytics() {
    const container = document.getElementById('analyticsContent');
    if (!container) return;

    container.innerHTML = buildAnalyticsHTML();
    attachAnalyticsListeners(container);
}

function renderMobileAnalytics() {
    const container = document.getElementById('mobileAnalyticsContent');
    if (!container) return;

    container.innerHTML = buildAnalyticsHTML();
    attachAnalyticsListeners(container);
}

function buildAnalyticsHTML() {
    const period = analyticsTimePeriod;
    const completedTasks = getCompletedTasksInPeriod(period);
    const completedPriorities = getCompletedPrioritiesInPeriod(period);
    const dailyBreakdown = getDailyBreakdown(period);

    const workTasks = completedTasks.filter(t => t.type === 'work');
    const personalTasks = completedTasks.filter(t => t.type === 'personal');
    const totalTasks = completedTasks.length;
    const maxDaily = Math.max(...dailyBreakdown.map(d => d.work + d.personal), 1);

    let html = `
        <div class="analytics-period-selector">
            <button class="analytics-period-btn ${period === 'day' ? 'active' : ''}" data-period="day">Today</button>
            <button class="analytics-period-btn ${period === 'week' ? 'active' : ''}" data-period="week">This Week</button>
            <button class="analytics-period-btn ${period === 'month' ? 'active' : ''}" data-period="month">This Month</button>
        </div>

        <div class="analytics-stats-grid">
            <div class="analytics-stat-card">
                <div class="analytics-stat-number">${totalTasks}</div>
                <div class="analytics-stat-label">Tasks Completed</div>
            </div>
            <div class="analytics-stat-card work">
                <div class="analytics-stat-number">${workTasks.length}</div>
                <div class="analytics-stat-label">Work Tasks</div>
            </div>
            <div class="analytics-stat-card personal">
                <div class="analytics-stat-number">${personalTasks.length}</div>
                <div class="analytics-stat-label">Personal Tasks</div>
            </div>
            <div class="analytics-stat-card priorities">
                <div class="analytics-stat-number">${completedPriorities.length}</div>
                <div class="analytics-stat-label">Priorities Closed</div>
            </div>
        </div>
    `;

    // Daily breakdown chart (skip for single-day view)
    if (period !== 'day' && dailyBreakdown.length > 1) {
        html += `
            <div class="analytics-section">
                <h4 class="analytics-section-title">Daily Breakdown</h4>
                <div class="analytics-chart">
                    ${dailyBreakdown.map(day => {
                        const total = day.work + day.personal;
                        const workHeight = (day.work / maxDaily) * 100;
                        const personalHeight = (day.personal / maxDaily) * 100;
                        const dayLabel = day.date.toLocaleDateString('en-US', { weekday: 'short' });
                        const dateLabel = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        return `
                            <div class="analytics-chart-bar-group" title="${dateLabel}: ${total} tasks">
                                <div class="analytics-chart-bar-stack">
                                    <div class="analytics-chart-bar work" style="height: ${workHeight}%"></div>
                                    <div class="analytics-chart-bar personal" style="height: ${personalHeight}%"></div>
                                </div>
                                <div class="analytics-chart-label">${period === 'month' ? day.date.getDate() : dayLabel}</div>
                                <div class="analytics-chart-count">${total || ''}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="analytics-chart-legend">
                    <span class="analytics-legend-item"><span class="analytics-legend-dot work"></span> Work</span>
                    <span class="analytics-legend-item"><span class="analytics-legend-dot personal"></span> Personal</span>
                </div>
            </div>
        `;
    }

    // Completed tasks list
    if (completedTasks.length > 0) {
        html += `
            <div class="analytics-section">
                <h4 class="analytics-section-title">Completed Tasks</h4>
                <div class="analytics-list">
                    ${completedTasks.map(task => {
                        const completedDate = task.completedAt.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
                        const timeStr = completedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        return `
                            <div class="analytics-list-item">
                                <span class="analytics-list-type ${task.type}">${task.type === 'work' ? '&#x1f4bc;' : '&#x1f3e0;'}</span>
                                <span class="analytics-list-title">${escapeHtml(task.title)}</span>
                                <span class="analytics-list-date">${timeStr}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Completed priorities list
    if (completedPriorities.length > 0) {
        html += `
            <div class="analytics-section">
                <h4 class="analytics-section-title">Closed Priorities</h4>
                <div class="analytics-list">
                    ${completedPriorities.map(p => {
                        const completedDate = p.completedAt.toDate ? p.completedAt.toDate() : new Date(p.completedAt);
                        const timeStr = completedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const catLabel = p.category ? (getCategoryLabel ? getCategoryLabel(p.category) : p.category) : '';
                        return `
                            <div class="analytics-list-item">
                                <span class="analytics-list-type priority">&#x2713;</span>
                                <span class="analytics-list-title">${escapeHtml(p.title)}</span>
                                <span class="analytics-list-cat">${catLabel}</span>
                                <span class="analytics-list-date">${timeStr}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Empty state
    if (totalTasks === 0 && completedPriorities.length === 0) {
        html += `
            <div class="analytics-empty">
                <div class="analytics-empty-icon">&#x1f4ca;</div>
                <p>No completed tasks or priorities ${getPeriodLabel(period).toLowerCase()}.</p>
                <p class="analytics-empty-hint">Complete some tasks and they'll show up here!</p>
            </div>
        `;
    }

    return html;
}

function attachAnalyticsListeners(container) {
    container.querySelectorAll('.analytics-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            analyticsTimePeriod = btn.dataset.period;
            renderAnalytics();
        });
    });
}
