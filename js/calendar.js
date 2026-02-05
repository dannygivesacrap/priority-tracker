// Google Calendar integration module

// Google API Configuration - uses values from config.js
const GOOGLE_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID;
const GOOGLE_API_KEY = CONFIG.GOOGLE_API_KEY;
const CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let calendarEvents = [];
let calendarInitialized = false;

// Initialize Google Calendar API
function initCalendarAPI() {
    // Load the Google API client library (client only, not auth2)
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                apiKey: GOOGLE_API_KEY,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
            });

            calendarInitialized = true;
            console.log('Google Calendar API initialized');

            // Check if user has a token from Firebase auth
            const token = sessionStorage.getItem('googleAccessToken');
            if (token) {
                gapi.client.setToken({ access_token: token });
                loadCalendarEvents();
            } else {
                renderCalendarAuthPrompt();
            }
        } catch (error) {
            console.error('Error initializing Google Calendar API:', error);
            renderCalendarError();
        }
    });
}

// Authorize Google Calendar access
async function authorizeCalendar() {
    try {
        // Re-authenticate with Firebase to get calendar scope
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar.readonly');

        const result = await firebase.auth().signInWithPopup(provider);

        if (result.credential) {
            const token = result.credential.accessToken;
            sessionStorage.setItem('googleAccessToken', token);
            gapi.client.setToken({ access_token: token });
            loadCalendarEvents();
        }
    } catch (error) {
        console.error('Calendar authorization error:', error);
        showToast('Failed to connect calendar');
    }
}

// Load today's calendar events from ALL calendars
async function loadCalendarEvents() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // First, get list of all calendars
        const calendarList = await gapi.client.calendar.calendarList.list();
        const calendars = calendarList.result.items || [];

        console.log('Found calendars:', calendars.map(c => c.summary));

        // Fetch events from all calendars
        let allEvents = [];

        for (const calendar of calendars) {
            try {
                const response = await gapi.client.calendar.events.list({
                    calendarId: calendar.id,
                    timeMin: today.toISOString(),
                    timeMax: tomorrow.toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime',
                    maxResults: 20
                });

                const events = (response.result.items || []).map(event => ({
                    ...event,
                    calendarName: calendar.summary,
                    calendarColor: calendar.backgroundColor
                }));

                allEvents = allEvents.concat(events);
            } catch (err) {
                console.log(`Could not fetch from calendar ${calendar.summary}:`, err.message);
            }
        }

        // Sort all events by start time
        allEvents.sort((a, b) => {
            const aTime = a.start.dateTime || a.start.date;
            const bTime = b.start.dateTime || b.start.date;
            return new Date(aTime) - new Date(bTime);
        });

        calendarEvents = allEvents;
        renderCalendar();
    } catch (error) {
        console.error('Error loading calendar events:', error);

        // Token might be expired
        if (error.status === 401) {
            sessionStorage.removeItem('googleAccessToken');
            renderCalendarAuthPrompt();
        } else {
            renderCalendarError();
        }
    }
}

// Render calendar events
function renderCalendar() {
    const container = document.getElementById('calendarEvents');
    const mobileContainer = document.getElementById('mobileCalendarEvents');

    const html = generateCalendarHTML();

    if (container) container.innerHTML = html;
    if (mobileContainer) mobileContainer.innerHTML = html;

    // Update date in header
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    document.querySelectorAll('.calendar-header span').forEach(el => {
        el.textContent = dateStr;
    });
}

// Generate calendar HTML
function generateCalendarHTML() {
    if (calendarEvents.length === 0) {
        return '<div class="calendar-empty">No events today</div>';
    }

    return calendarEvents.map(event => {
        const startTime = formatEventTime(event.start);
        const title = event.summary || 'Untitled Event';
        const location = event.location || '';
        const colorClass = getEventColorClass(event);

        return `
            <div class="calendar-event">
                <div class="event-color ${colorClass}"></div>
                <span class="event-time">${startTime}</span>
                <div class="event-details">
                    <div class="event-title">${escapeHtml(title)}</div>
                    ${location ? `<div class="event-location">${escapeHtml(location)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Format event time
function formatEventTime(eventStart) {
    if (eventStart.date) {
        // All-day event
        return 'All day';
    }

    const time = new Date(eventStart.dateTime);
    return time.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: false
    });
}

// Get color class based on event calendar or color
function getEventColorClass(event) {
    // Google Calendar color IDs
    const colorMap = {
        '1': 'blue',    // Lavender
        '2': 'green',   // Sage
        '3': 'purple',  // Grape
        '4': 'red',     // Flamingo
        '5': 'yellow',  // Banana
        '6': 'orange',  // Tangerine
        '7': 'blue',    // Peacock
        '8': 'purple',  // Graphite
        '9': 'blue',    // Blueberry
        '10': 'green',  // Basil
        '11': 'red'     // Tomato
    };

    if (event.colorId && colorMap[event.colorId]) {
        return colorMap[event.colorId];
    }

    // Default color based on summary content
    const title = (event.summary || '').toLowerCase();
    if (title.includes('meeting') || title.includes('call')) return 'blue';
    if (title.includes('lunch') || title.includes('dinner')) return 'orange';
    if (title.includes('gym') || title.includes('workout')) return 'green';
    if (title.includes('deadline') || title.includes('due')) return 'red';

    return 'purple';
}

// Render auth prompt for calendar
function renderCalendarAuthPrompt() {
    const container = document.getElementById('calendarEvents');
    const mobileContainer = document.getElementById('mobileCalendarEvents');

    const html = `
        <div class="calendar-empty">
            <p>Connect your Google Calendar</p>
            <button class="calendar-auth-btn" onclick="authorizeCalendar()">
                Connect Calendar
            </button>
        </div>
    `;

    if (container) container.innerHTML = html;
    if (mobileContainer) mobileContainer.innerHTML = html;
}

// Render calendar error
function renderCalendarError() {
    const container = document.getElementById('calendarEvents');
    const mobileContainer = document.getElementById('mobileCalendarEvents');

    const html = `
        <div class="calendar-empty">
            <p>Could not load calendar</p>
            <button class="calendar-auth-btn" onclick="retryCalendar()">
                Retry
            </button>
        </div>
    `;

    if (container) container.innerHTML = html;
    if (mobileContainer) mobileContainer.innerHTML = html;
}

// Retry calendar initialization
function retryCalendar() {
    if (calendarInitialized) {
        authorizeCalendar();
    } else {
        initCalendarAPI();
    }
}

// Helper: escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Refresh calendar periodically (every 5 minutes)
setInterval(() => {
    if (calendarInitialized && sessionStorage.getItem('googleAccessToken')) {
        loadCalendarEvents();
    }
}, 5 * 60 * 1000);
