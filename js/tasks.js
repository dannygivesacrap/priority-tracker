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

// Create next occurrence of recurring task (silently, no toast)
async function createNextRecurrence(task) {
    const nextDate = calculateNextRecurrence(task.recurring, task.dueDate);
    const userDoc = getUserDoc();

    const newTask = {
        title: task.title,
        type: task.type,
        category: 'today',
        dueDate: nextDate,
        recurring: task.recurring,
        recurringPattern: task.recurringPattern,
        priorityId: task.priorityId || null,
        completed: false,
        completedAt: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await userDoc.collection('tasks').add(newTask);
        // No toast - silently create next occurrence
    } catch (error) {
        console.error('Error creating next recurrence:', error);
    }
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks[type].filter(task => {
        // Show completed tasks in 'completed' section, or if completed today (greyed out)
        if (task.completed) {
            if (category === 'completed') return true;
            // Show today's completed tasks in their original section
            if (task.completedAt) {
                const completedDate = task.completedAt.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
                completedDate.setHours(0, 0, 0, 0);
                if (completedDate.getTime() !== today.getTime()) return false;
                // Fall through to categorize completed task
            } else {
                return false;
            }
        }

        // Recurring section shows recurring tasks due today (including completed ones from today)
        if (category === 'recurring') {
            if (!task.recurring) return false;
            // Show completed recurring tasks only if completed today
            if (task.completed) {
                if (!task.completedAt) return false;
                const completedDate = task.completedAt.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
                completedDate.setHours(0, 0, 0, 0);
                if (completedDate.getTime() !== today.getTime()) return false;
            }
            // Only show if due today or earlier (or no due date)
            if (task.dueDate) {
                const dueDate = new Date(task.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate <= today;
            }
            return true;
        }

        // Skip recurring tasks from other sections (they show in recurring only)
        if (task.recurring) return false;

        // Check due date for dynamic categorization using calendar weeks
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            // Get end of this week (Sunday)
            const endOfThisWeek = new Date(today);
            const daysUntilSunday = 7 - today.getDay();
            endOfThisWeek.setDate(today.getDate() + daysUntilSunday);
            endOfThisWeek.setHours(23, 59, 59, 999);

            // Get end of next week
            const endOfNextWeek = new Date(endOfThisWeek);
            endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);

            // Use dueDate exclusively for categorization when it exists
            if (category === 'today') return dueDate <= today;
            if (category === 'thisWeek') return dueDate > today && dueDate <= endOfThisWeek;
            if (category === 'nextWeek') return dueDate > endOfThisWeek && dueDate <= endOfNextWeek;
            if (category === 'beyond') return dueDate > endOfNextWeek;
            if (category === 'backburner') return false; // Tasks with dates aren't backburner
            return false; // Has dueDate, so don't use task.category
        }

        // No dueDate - use task.category
        return task.category === category;
    }).sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Get today's tasks (for dashboard) - includes today's completed tasks
function getTodayTasks(type) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks[type].filter(task => {
        // Include today's completed tasks (greyed out)
        if (task.completed) {
            if (task.completedAt) {
                const completedDate = task.completedAt.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
                completedDate.setHours(0, 0, 0, 0);
                if (completedDate.getTime() !== today.getTime()) return false;
                // Fall through to check if it was a today task
            } else {
                return false;
            }
        }

        // Include tasks due today or earlier, or tasks with category 'today'
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate <= today;
        }

        return task.category === 'today';
    }).sort((a, b) => (a.order || 0) - (b.order || 0)); // Sort by order
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
        { id: 'nextWeek', label: 'Next Week' },
        { id: 'beyond', label: 'Beyond' },
        { id: 'backburner', label: 'Backburner' },
        { id: 'recurring', label: 'Recurring' }
    ];

    sections.forEach(section => {
        const sectionTasks = getTasksByCategory('work', section.id);
        // Always show all sections
        const sectionEl = createTaskSection(section.label, sectionTasks, 'work', section.id);
        container.appendChild(sectionEl);
    });

    // Add "Add Task" button at the bottom
    const addBtn = document.createElement('div');
    addBtn.className = 'add-task';
    addBtn.dataset.type = 'work';
    addBtn.textContent = '+ Add work task';
    addBtn.addEventListener('click', () => showAddTaskInput('work', addBtn));
    container.appendChild(addBtn);
}

// Render full personal view with sections
function renderPersonalView() {
    const container = document.getElementById('personalViewTasks');
    if (!container) return;

    container.innerHTML = '';

    const sections = [
        { id: 'today', label: 'Today' },
        { id: 'thisWeek', label: 'This Week' },
        { id: 'nextWeek', label: 'Next Week' },
        { id: 'beyond', label: 'Beyond' },
        { id: 'backburner', label: 'Backburner' },
        { id: 'recurring', label: 'Recurring' }
    ];

    sections.forEach(section => {
        const sectionTasks = getTasksByCategory('personal', section.id);
        // Always show all sections
        const sectionEl = createTaskSection(section.label, sectionTasks, 'personal', section.id);
        container.appendChild(sectionEl);
    });

    // Add "Add Task" button at the bottom
    const addBtn = document.createElement('div');
    addBtn.className = 'add-task';
    addBtn.dataset.type = 'personal';
    addBtn.textContent = '+ Add personal task';
    addBtn.addEventListener('click', () => showAddTaskInput('personal', addBtn));
    container.appendChild(addBtn);
}

// Create a task section with header
function createTaskSection(label, taskList, type, sectionId = null) {
    const section = document.createElement('div');
    section.className = 'task-section';

    section.innerHTML = `
        <div class="task-section-header">${label}</div>
        <div class="task-list" data-section="${label.toLowerCase().replace(/\s+/g, '-')}" data-type="${type}" data-category="${sectionId || label.toLowerCase()}"></div>
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

    // Delete button for completed tasks
    container.querySelectorAll('.task-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const taskItem = btn.closest('.task-item');
            const taskId = taskItem.dataset.taskId;
            await deleteTask(taskId);
        });
    });
}

// Create HTML for a single task
function createTaskHTML(task, type) {
    const recurringLabel = task.recurring ? getRecurringLabel(task.recurring) : '';
    const recurringIcon = task.recurring ? `<span class="task-recurring">\u21bb ${recurringLabel}</span>` : '';
    const priorityTag = task.priorityId ? `<span class="task-tag">${getPriorityName(task.priorityId, type)}</span>` : '';
    const dueMeta = task.dueDate && !isToday(task.dueDate) ? `<span class="task-meta">\ud83d\udcc5 ${formatDate(task.dueDate)}</span>` : '';

    // Different actions for completed vs active tasks
    const actions = task.completed
        ? `<button class="task-delete-btn" data-action="delete" title="Delete">\u2715</button>`
        : `<div class="task-actions">
                <button class="task-action-btn" data-action="focus" title="Focus">\u23f1</button>
                <button class="task-action-btn" data-action="more" title="More">\u22ef</button>
           </div>`;

    return `
        <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}" data-type="${type}" data-order="${task.order || 0}">
            ${task.completed ? '' : '<span class="task-drag-handle">\u2630</span>'}
            <div class="task-checkbox ${task.completed ? 'checked' : ''}"></div>
            <div class="task-content">
                <span class="task-title ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</span>
                ${recurringIcon}
                ${priorityTag}
                ${dueMeta}
            </div>
            ${actions}
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
        <div class="dropdown-item" data-action="setDueDate">\ud83d\udcc6 Set Due Date</div>
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

            if (action === 'setDueDate') {
                showDatePicker(taskId);
            } else if (action === 'tomorrow') {
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

// Drag and drop for tasks - using event delegation
let dragState = {
    dragging: false,
    element: null,
    placeholder: null,
    container: null,
    startY: 0,
    offsetY: 0
};

// Set up global drag listeners immediately
(function initGlobalDragAndDrop() {
    document.addEventListener('mousedown', function(e) {
        // Check if click is on a drag handle
        const handle = e.target.closest('.task-drag-handle');
        if (!handle) return;

        const item = handle.closest('.task-item');
        if (!item || item.classList.contains('completed')) return;

        console.log('Drag started on:', item.querySelector('.task-title')?.textContent);
        startDrag(e, item);
    }, true); // Use capture phase

    document.addEventListener('touchstart', function(e) {
        const handle = e.target.closest('.task-drag-handle');
        if (!handle) return;

        const item = handle.closest('.task-item');
        if (!item || item.classList.contains('completed')) return;

        startDrag(e, item);
    }, { passive: false, capture: true });
})();

// Legacy function - kept for compatibility but no longer needed per-container
function initTaskDragAndDrop(container) {
    // Drag is now handled globally via event delegation
}

function startDrag(e, item) {
    e.preventDefault();
    e.stopPropagation();

    const container = item.closest('.task-list');
    if (!container) return;

    // Get initial position
    const rect = item.getBoundingClientRect();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Create placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'task-placeholder';
    placeholder.style.height = rect.height + 'px';

    // Set up drag state
    dragState = {
        dragging: true,
        element: item,
        placeholder: placeholder,
        container: container,
        startY: clientY,
        offsetY: clientY - rect.top,
        initialIndex: Array.from(container.children).indexOf(item)
    };

    // Style the dragged element
    item.classList.add('dragging');
    item.style.position = 'fixed';
    item.style.width = rect.width + 'px';
    item.style.left = rect.left + 'px';
    item.style.top = rect.top + 'px';
    item.style.zIndex = '1000';

    // Insert placeholder
    container.insertBefore(placeholder, item);
    document.body.appendChild(item);

    // Add move/end listeners
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
}

function onDragMove(e) {
    if (!dragState.dragging) return;
    e.preventDefault();

    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const newTop = clientY - dragState.offsetY;

    // Move the dragged element
    dragState.element.style.top = newTop + 'px';

    // Find the element we're hovering over
    const siblings = Array.from(dragState.container.querySelectorAll('.task-item:not(.dragging), .task-placeholder'));

    for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        const rect = sibling.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (clientY < midpoint) {
            if (sibling !== dragState.placeholder) {
                dragState.container.insertBefore(dragState.placeholder, sibling);
            }
            return;
        }
    }

    // If we're past all items, append at the end
    const lastItem = siblings[siblings.length - 1];
    if (lastItem && lastItem !== dragState.placeholder) {
        dragState.container.appendChild(dragState.placeholder);
    }
}

async function onDragEnd(e) {
    if (!dragState.dragging) return;

    // Remove listeners
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);

    const { element, placeholder, container } = dragState;

    // Reset element styles
    element.classList.remove('dragging');
    element.style.position = '';
    element.style.width = '';
    element.style.left = '';
    element.style.top = '';
    element.style.zIndex = '';

    // Insert element at placeholder position
    container.insertBefore(element, placeholder);
    placeholder.remove();

    // Get new order and save
    const taskElements = Array.from(container.querySelectorAll('.task-item:not(.task-placeholder)'));
    const newIndex = taskElements.indexOf(element);

    if (newIndex !== dragState.initialIndex) {
        // Save new order to Firestore
        const updates = taskElements.map((el, i) => {
            return updateTask(el.dataset.taskId, { order: i });
        });
        await Promise.all(updates);
        showToast('Tasks reordered');
    }

    // Reset state
    dragState = { dragging: false, element: null, placeholder: null, container: null };
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

// Show date picker for setting due date
function showDatePicker(taskId) {
    // Close any existing date pickers
    document.querySelectorAll('.date-picker-popup').forEach(p => p.remove());

    const task = [...tasks.work, ...tasks.personal].find(t => t.id === taskId);
    if (!task) return;

    const popup = document.createElement('div');
    popup.className = 'date-picker-popup';

    // Get current date for default value
    const today = new Date();
    const currentDate = task.dueDate || today.toISOString().split('T')[0];

    popup.innerHTML = `
        <div class="date-picker-header">Set Due Date</div>
        <input type="date" class="date-picker-input" value="${currentDate}" />
        <div class="date-picker-quick">
            <button data-days="0">Today</button>
            <button data-days="1">Tomorrow</button>
            <button data-days="7">Next Week</button>
            <button data-clear="true">Clear</button>
        </div>
        <div class="date-picker-actions">
            <button class="date-picker-cancel">Cancel</button>
            <button class="date-picker-save">Save</button>
        </div>
    `;

    // Center the popup
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.2);
        padding: 20px;
        z-index: 10001;
        min-width: 280px;
    `;

    document.body.appendChild(popup);

    const input = popup.querySelector('.date-picker-input');

    // Quick date buttons
    popup.querySelectorAll('.date-picker-quick button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.clear) {
                input.value = '';
            } else {
                const days = parseInt(btn.dataset.days);
                const date = new Date();
                date.setDate(date.getDate() + days);
                input.value = date.toISOString().split('T')[0];
            }
        });
    });

    // Cancel button
    popup.querySelector('.date-picker-cancel').addEventListener('click', () => {
        popup.remove();
    });

    // Save button
    popup.querySelector('.date-picker-save').addEventListener('click', async () => {
        const newDate = input.value || null;
        await updateTask(taskId, { dueDate: newDate });
        showToast(newDate ? `Due date set to ${formatDate(newDate)}` : 'Due date cleared');
        popup.remove();
    });

    // Close on click outside
    const closePopup = (e) => {
        if (!popup.contains(e.target)) {
            popup.remove();
            document.removeEventListener('click', closePopup);
        }
    };
    setTimeout(() => document.addEventListener('click', closePopup), 0);
}
