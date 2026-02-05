// Task management module

// Local task state
let tasks = {
    work: [],
    personal: []
};

// Real-time listeners
let taskListeners = [];

// Load tasks from Firestore with real-time updates
function loadTasks() {
    const userDoc = getUserDoc();

    // Clear existing listeners
    taskListeners.forEach(unsubscribe => unsubscribe());
    taskListeners = [];

    ['work', 'personal'].forEach(type => {
        const unsubscribe = userDoc.collection('tasks')
            .where('type', '==', type)
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                tasks[type] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                renderTasks();
            }, error => {
                console.error(`Error loading ${type} tasks:`, error);
            });

        taskListeners.push(unsubscribe);
    });
}

// Add a new task
async function addTask(type, title, options = {}) {
    const userDoc = getUserDoc();

    const task = {
        title: title.trim(),
        type,
        category: options.category || 'today',
        dueDate: options.dueDate || null,
        recurring: options.recurring || null,
        recurringPattern: options.recurringPattern || null,
        priorityId: options.priorityId || null,
        completed: false,
        completedAt: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const docRef = await userDoc.collection('tasks').add(task);
        showToast('Task added!');
        return docRef.id;
    } catch (error) {
        console.error('Error adding task:', error);
        showToast('Failed to add task');
        throw error;
    }
}

// Update a task
async function updateTask(taskId, updates) {
    const userDoc = getUserDoc();

    try {
        await userDoc.collection('tasks').doc(taskId).update({
            ...updates,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating task:', error);
        showToast('Failed to update task');
        throw error;
    }
}

// Complete a task
async function completeTask(taskId, type) {
    const task = tasks[type].find(t => t.id === taskId);
    if (!task) return;

    const newCompleted = !task.completed;

    try {
        await updateTask(taskId, {
            completed: newCompleted,
            completedAt: newCompleted ? firebase.firestore.FieldValue.serverTimestamp() : null
        });

        if (newCompleted) {
            // Handle recurring task - create next occurrence
            if (task.recurring) {
                await createNextRecurrence(task);
            }
        }

        return newCompleted;
    } catch (error) {
        console.error('Error completing task:', error);
        throw error;
    }
}

// Create next occurrence of recurring task
async function createNextRecurrence(task) {
    const nextDate = calculateNextRecurrence(task.recurring, task.dueDate);

    await addTask(task.type, task.title, {
        category: 'today',
        dueDate: nextDate,
        recurring: task.recurring,
        recurringPattern: task.recurringPattern,
        priorityId: task.priorityId
    });
}

// Calculate next recurrence date
function calculateNextRecurrence(pattern, currentDate) {
    const date = currentDate ? new Date(currentDate) : new Date();

    switch (pattern) {
        case 'daily':
            date.setDate(date.getDate() + 1);
            break;
        case 'weekly':
            date.setDate(date.getDate() + 7);
            break;
        case 'monthly':
            date.setMonth(date.getMonth() + 1);
            break;
        default:
            date.setDate(date.getDate() + 1);
    }

    return date.toISOString().split('T')[0];
}

// Delete a task
async function deleteTask(taskId) {
    const userDoc = getUserDoc();

    try {
        await userDoc.collection('tasks').doc(taskId).delete();
        showToast('Task deleted');
    } catch (error) {
        console.error('Error deleting task:', error);
        showToast('Failed to delete task');
        throw error;
    }
}

// Move task to different category
async function moveTask(taskId, newCategory) {
    let newDueDate = null;

    if (newCategory === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        newDueDate = tomorrow.toISOString().split('T')[0];
        newCategory = 'today'; // Will show as "today" tomorrow
    } else if (newCategory === 'nextWeek') {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        newDueDate = nextWeek.toISOString().split('T')[0];
        newCategory = 'thisWeek';
    }

    await updateTask(taskId, {
        category: newCategory,
        dueDate: newDueDate
    });

    showToast(`Task moved to ${formatCategory(newCategory)}`);
}

// Set task as recurring
async function setRecurring(taskId, pattern) {
    await updateTask(taskId, {
        recurring: pattern,
        recurringPattern: pattern
    });

    showToast(`Task set to repeat ${pattern}`);
}

// Format category for display
function formatCategory(category) {
    const labels = {
        today: 'Today',
        thisWeek: 'This Week',
        nextWeek: 'Next Week & Beyond',
        backburner: 'Backburner'
    };
    return labels[category] || category;
}

// Get tasks by category
function getTasksByCategory(type, category) {
    return tasks[type].filter(task => {
        if (task.completed && category !== 'completed') return false;

        // Recurring section shows all recurring tasks
        if (category === 'recurring') {
            return task.recurring && !task.completed;
        }

        // Skip recurring tasks from other sections (they show in recurring)
        if (task.recurring && category !== 'today') return false;

        // Check due date for dynamic categorization
        if (task.dueDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

            if (category === 'today' && diffDays <= 0) return true;
            if (category === 'thisWeek' && diffDays > 0 && diffDays <= 7) return true;
            if (category === 'nextWeek' && diffDays > 7) return true;
        }

        return task.category === category;
    }).sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Get today's tasks (for dashboard)
function getTodayTasks(type) {
    return tasks[type].filter(task => {
        if (task.completed) return false;

        // Include tasks due today or earlier, or tasks with category 'today'
        if (task.dueDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate <= today;
        }

        return task.category === 'today';
    });
}

// Render tasks to DOM
function renderTasks() {
    renderDashboardTasks();
    renderWorkView();
    renderPersonalView();
    renderMobileTasks();
}

// Render dashboard tasks (today only)
function renderDashboardTasks() {
    const workContainer = document.getElementById('dashboardWorkTasks');
    const personalContainer = document.getElementById('dashboardPersonalTasks');

    if (workContainer) {
        renderTaskList(workContainer, getTodayTasks('work'), 'work');
    }
    if (personalContainer) {
        renderTaskList(personalContainer, getTodayTasks('personal'), 'personal');
    }
}

// Render full work view with sections
function renderWorkView() {
    const container = document.getElementById('workViewTasks');
    if (!container) return;

    container.innerHTML = '';

    const sections = [
        { id: 'today', label: 'Today' },
        { id: 'thisWeek', label: 'This Week' },
        { id: 'nextWeek', label: 'Next Week & Beyond' },
        { id: 'backburner', label: 'Backburner' },
        { id: 'recurring', label: 'Recurring' }
    ];

    sections.forEach(section => {
        const sectionTasks = getTasksByCategory('work', section.id);
        if (sectionTasks.length > 0 || section.id === 'today') {
            const sectionEl = createTaskSection(section.label, sectionTasks, 'work');
            container.appendChild(sectionEl);
        }
    });
}

// Render full personal view with sections
function renderPersonalView() {
    const container = document.getElementById('personalViewTasks');
    if (!container) return;

    container.innerHTML = '';

    const sections = [
        { id: 'today', label: 'Today' },
        { id: 'thisWeek', label: 'This Week' },
        { id: 'nextWeek', label: 'Next Week & Beyond' },
        { id: 'backburner', label: 'Backburner' },
        { id: 'recurring', label: 'Recurring' }
    ];

    sections.forEach(section => {
        const sectionTasks = getTasksByCategory('personal', section.id);
        if (sectionTasks.length > 0 || section.id === 'today') {
            const sectionEl = createTaskSection(section.label, sectionTasks, 'personal');
            container.appendChild(sectionEl);
        }
    });
}

// Create a task section with header
function createTaskSection(label, taskList, type) {
    const section = document.createElement('div');
    section.className = 'task-section';

    section.innerHTML = `
        <div class="task-section-header">${label}</div>
        <div class="task-list" data-section="${label.toLowerCase().replace(/\s+/g, '-')}"></div>
    `;

    const listContainer = section.querySelector('.task-list');
    renderTaskList(listContainer, taskList, type);

    return section;
}

// Render a task list into a container
function renderTaskList(container, taskList, type) {
    if (!container) return;

    if (taskList.length === 0) {
        container.innerHTML = '<div class="empty"><div class="empty-icon">\u2705</div>All caught up!</div>';
        return;
    }

    // Make sure container has task-list class
    if (!container.classList.contains('task-list')) {
        container.classList.add('task-list');
    }

    container.innerHTML = taskList.map(task => createTaskHTML(task, type)).join('');

    // Initialize drag and drop
    initTaskDragAndDrop(container);

    // Add event listeners
    container.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = checkbox.closest('.task-item').dataset.taskId;
            handleTaskComplete(taskId, type, checkbox);
        });
    });

    container.querySelectorAll('.task-action-btn[data-action="focus"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskItem = btn.closest('.task-item');
            const taskTitle = taskItem.querySelector('.task-title').textContent;
            openFocusMode(taskItem.dataset.taskId, taskTitle);
        });
    });

    container.querySelectorAll('.task-action-btn[data-action="more"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskItem = btn.closest('.task-item');
            showTaskDropdown(taskItem, type);
        });
    });

    // Make task title editable on click
    container.querySelectorAll('.task-title').forEach(title => {
        title.addEventListener('click', (e) => {
            if (!title.classList.contains('completed')) {
                const taskItem = title.closest('.task-item');
                startEditingTask(taskItem, type);
            }
        });
    });
}

// Create HTML for a single task
function createTaskHTML(task, type) {
    const recurringLabel = task.recurring ? getRecurringLabel(task.recurring) : '';
    const recurringIcon = task.recurring ? `<span class="task-recurring">\u21bb ${recurringLabel}</span>` : '';
    const priorityTag = task.priorityId ? `<span class="task-tag">${getPriorityName(task.priorityId, type)}</span>` : '';
    const dueMeta = task.dueDate && !isToday(task.dueDate) ? `<span class="task-meta">\ud83d\udcc5 ${formatDate(task.dueDate)}</span>` : '';

    return `
        <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}" data-type="${type}" data-order="${task.order || 0}" draggable="true">
            <span class="task-drag-handle">\u2630</span>
            <div class="task-checkbox ${task.completed ? 'checked' : ''}"></div>
            <div class="task-content">
                <span class="task-title ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</span>
                ${recurringIcon}
                ${priorityTag}
                ${dueMeta}
            </div>
            <div class="task-actions">
                <button class="task-action-btn" data-action="focus" title="Focus">\u23f1</button>
                <button class="task-action-btn" data-action="more" title="More">\u22ef</button>
            </div>
        </div>
    `;
}

// Get recurring label
function getRecurringLabel(pattern) {
    const labels = {
        'daily': '',
        'weekdays': 'weekdays',
        'weekly': 'weekly',
        'monthly': 'monthly'
    };
    return labels[pattern] || pattern;
}

// Handle task completion with celebration
async function handleTaskComplete(taskId, type, checkbox) {
    const completed = await completeTask(taskId, type);

    if (completed) {
        checkbox.classList.add('checked');
        const taskItem = checkbox.closest('.task-item');
        taskItem.classList.add('completed');
        taskItem.querySelector('.task-title').classList.add('completed');

        // Trigger celebration
        triggerCelebration();
    } else {
        checkbox.classList.remove('checked');
        const taskItem = checkbox.closest('.task-item');
        taskItem.classList.remove('completed');
        taskItem.querySelector('.task-title').classList.remove('completed');
    }
}

// Start editing a task title
function startEditingTask(taskItem, type) {
    const titleEl = taskItem.querySelector('.task-title');
    const currentTitle = titleEl.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-title-input';
    input.value = currentTitle;

    titleEl.replaceWith(input);
    input.focus();
    input.select();

    const saveEdit = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            await updateTask(taskItem.dataset.taskId, { title: newTitle });
        }
        // Re-render will happen via Firestore listener
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            input.value = currentTitle;
            input.blur();
        }
    });
}

// Show quick actions dropdown for a task
function showTaskDropdown(taskItem, type) {
    // Close any existing dropdowns
    document.querySelectorAll('.dropdown.show').forEach(d => d.remove());

    const taskId = taskItem.dataset.taskId;
    const task = tasks[type].find(t => t.id === taskId);

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown';
    dropdown.innerHTML = `
        <div class="dropdown-item" data-action="tomorrow">\u23f0 Delay to Tomorrow</div>
        <div class="dropdown-item" data-action="nextWeek">\ud83d\udcc5 Delay to Next Week</div>
        <div class="dropdown-item" data-action="backburner">\ud83d\udd25 Move to Backburner</div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-submenu">
            <div class="dropdown-item">\ud83d\udd01 Set Recurring \u25b6</div>
            <div class="dropdown-submenu-content">
                <div class="dropdown-item" data-action="recurring-daily">Daily</div>
                <div class="dropdown-item" data-action="recurring-weekdays">Weekdays</div>
                <div class="dropdown-item" data-action="recurring-weekly">Weekly</div>
                <div class="dropdown-item" data-action="recurring-monthly">Monthly</div>
                ${task && task.recurring ? '<div class="dropdown-divider"></div><div class="dropdown-item" data-action="recurring-none">Remove Recurring</div>' : ''}
            </div>
        </div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-item danger" data-action="delete">\ud83d\uddd1 Delete Task</div>
    `;

    // Position dropdown near the button
    const btn = taskItem.querySelector('.task-action-btn[data-action="more"]');
    const rect = btn.getBoundingClientRect();
    dropdown.style.top = rect.bottom + 4 + 'px';
    dropdown.style.left = (rect.right - 200) + 'px';

    document.body.appendChild(dropdown);

    // Add event listeners
    dropdown.querySelectorAll('.dropdown-item[data-action]').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = item.dataset.action;

            if (action === 'tomorrow') {
                await moveTask(taskId, 'tomorrow');
            } else if (action === 'nextWeek') {
                await moveTask(taskId, 'nextWeek');
            } else if (action === 'backburner') {
                await moveTask(taskId, 'backburner');
            } else if (action === 'recurring-daily') {
                await setRecurring(taskId, 'daily');
            } else if (action === 'recurring-weekdays') {
                await setRecurring(taskId, 'weekdays');
            } else if (action === 'recurring-weekly') {
                await setRecurring(taskId, 'weekly');
            } else if (action === 'recurring-monthly') {
                await setRecurring(taskId, 'monthly');
            } else if (action === 'recurring-none') {
                await updateTask(taskId, { recurring: null, recurringPattern: null });
                showToast('Recurring removed');
            } else if (action === 'delete') {
                if (confirm('Delete this task?')) {
                    await deleteTask(taskId);
                }
            }

            dropdown.remove();
        });
    });

    dropdown.classList.add('show');

    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.remove();
            document.removeEventListener('click', closeDropdown);
        }
    };
    setTimeout(() => document.addEventListener('click', closeDropdown), 0);
}

// Drag and drop for tasks
let draggedTask = null;

function initTaskDragAndDrop(container) {
    container.querySelectorAll('.task-item[draggable="true"]').forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedTask = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.task-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    draggedTask = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (this !== draggedTask && !this.classList.contains('dragging')) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (!draggedTask || this === draggedTask) return;

    const draggedId = draggedTask.dataset.taskId;
    const targetId = this.dataset.taskId;
    const type = draggedTask.dataset.type;

    // Get current order
    const taskList = tasks[type].filter(t => !t.completed);
    const draggedIndex = taskList.findIndex(t => t.id === draggedId);
    const targetIndex = taskList.findIndex(t => t.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder
    const [removed] = taskList.splice(draggedIndex, 1);
    taskList.splice(targetIndex, 0, removed);

    // Update order in Firestore
    for (let i = 0; i < taskList.length; i++) {
        await updateTask(taskList[i].id, { order: i });
    }

    showToast('Tasks reordered');
}

// Render mobile tasks
function renderMobileTasks() {
    const container = document.getElementById('mobileDashboardTasks');
    if (!container) return;

    const allTodayTasks = [...getTodayTasks('work'), ...getTodayTasks('personal')];
    container.innerHTML = '';

    if (allTodayTasks.length === 0) {
        container.innerHTML = '<div class="task-list empty">No tasks for today</div>';
        return;
    }

    // Work tasks
    const workTasks = getTodayTasks('work');
    if (workTasks.length > 0) {
        const workSection = document.createElement('div');
        workSection.innerHTML = `
            <div class="section-header">
                <h3>Work</h3>
            </div>
            <div class="task-list" id="mobileWorkTasks"></div>
        `;
        container.appendChild(workSection);
        renderTaskList(workSection.querySelector('.task-list'), workTasks, 'work');
    }

    // Personal tasks
    const personalTasks = getTodayTasks('personal');
    if (personalTasks.length > 0) {
        const personalSection = document.createElement('div');
        personalSection.style.marginTop = '20px';
        personalSection.innerHTML = `
            <div class="section-header">
                <h3>Personal</h3>
            </div>
            <div class="task-list" id="mobilePersonalTasks"></div>
        `;
        container.appendChild(personalSection);
        renderTaskList(personalSection.querySelector('.task-list'), personalTasks, 'personal');
    }
}

// Helper functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isToday(dateString) {
    const today = new Date();
    const date = new Date(dateString);
    return today.toDateString() === date.toDateString();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPriorityName(priorityId, type) {
    const priorityList = priorities[type] || [];
    const priority = priorityList.find(p => p.id === priorityId);
    return priority ? priority.title : '';
}
