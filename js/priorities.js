// Priority management module

// Local priority state
let priorities = {
    work: [],
    personal: []
};

// Real-time listeners
let priorityListeners = [];

// Load priorities from Firestore with real-time updates
function loadPriorities() {
    const userDoc = getUserDoc();

    // Clear existing listeners
    priorityListeners.forEach(unsubscribe => unsubscribe());
    priorityListeners = [];

    ['work', 'personal'].forEach(type => {
        const unsubscribe = userDoc.collection('priorities').doc(type)
            .onSnapshot(doc => {
                if (doc.exists) {
                    priorities[type] = doc.data().items || [];
                } else {
                    priorities[type] = [];
                }
                renderPriorities();
            }, error => {
                console.error(`Error loading ${type} priorities:`, error);
            });

        priorityListeners.push(unsubscribe);
    });
}

// Save priorities to Firestore
async function savePriorities(type) {
    const userDoc = getUserDoc();

    try {
        await userDoc.collection('priorities').doc(type).set({
            items: priorities[type],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error saving priorities:', error);
        showToast('Failed to save priorities');
        throw error;
    }
}

// Add a new priority
async function addPriority(type, title) {
    const newPriority = {
        id: generateId(),
        title: title.trim(),
        order: priorities[type].length
    };

    priorities[type].push(newPriority);
    await savePriorities(type);
    showToast('Priority added!');
    return newPriority.id;
}

// Update a priority
async function updatePriority(type, priorityId, newTitle) {
    const index = priorities[type].findIndex(p => p.id === priorityId);
    if (index === -1) return;

    priorities[type][index].title = newTitle.trim();
    await savePriorities(type);
}

// Delete a priority
async function deletePriority(type, priorityId) {
    priorities[type] = priorities[type].filter(p => p.id !== priorityId);

    // Re-order remaining priorities
    priorities[type].forEach((p, i) => p.order = i);

    await savePriorities(type);
    showToast('Priority removed');
}

// Reorder priorities
async function reorderPriorities(type, fromIndex, toIndex) {
    const [removed] = priorities[type].splice(fromIndex, 1);
    priorities[type].splice(toIndex, 0, removed);

    // Update order numbers
    priorities[type].forEach((p, i) => p.order = i);

    await savePriorities(type);
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Render priorities to DOM
function renderPriorities() {
    renderPriorityStrip();
    renderMobilePriorities();
}

// Render the priorities strip (desktop)
function renderPriorityStrip() {
    const workContainer = document.getElementById('workPriorities');
    const personalContainer = document.getElementById('personalPriorities');

    if (workContainer) {
        renderPriorityList(workContainer, priorities.work, 'work');
    }
    if (personalContainer) {
        renderPriorityList(personalContainer, priorities.personal, 'personal');
    }
}

// Render a priority list into a container
function renderPriorityList(container, priorityList, type) {
    const sortedPriorities = [...priorityList].sort((a, b) => a.order - b.order);

    const priorityChips = sortedPriorities.map((priority, index) => `
        <div class="priority-chip" data-priority-id="${priority.id}" data-type="${type}">
            <span class="priority-num ${type}">${index + 1}</span>
            <span class="priority-title">${escapeHtml(priority.title)}</span>
        </div>
    `).join('');

    container.innerHTML = priorityChips + `
        <div class="priority-chip add" data-type="${type}">+</div>
    `;

    // Add event listeners for editing
    container.querySelectorAll('.priority-chip:not(.add)').forEach(chip => {
        chip.addEventListener('click', () => startEditingPriority(chip));
        chip.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showPriorityContextMenu(chip, e);
        });
    });

    // Add event listener for adding new priority
    container.querySelector('.priority-chip.add').addEventListener('click', () => {
        startAddingPriority(container, type);
    });
}

// Start editing a priority
function startEditingPriority(chip) {
    if (chip.classList.contains('editing')) return;

    const priorityId = chip.dataset.priorityId;
    const type = chip.dataset.type;
    const titleEl = chip.querySelector('.priority-title');
    const currentTitle = titleEl.textContent;

    chip.classList.add('editing');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.placeholder = 'Priority name';

    titleEl.replaceWith(input);
    input.focus();
    input.select();

    const saveEdit = async () => {
        const newTitle = input.value.trim();
        chip.classList.remove('editing');

        if (newTitle && newTitle !== currentTitle) {
            await updatePriority(type, priorityId, newTitle);
        } else if (!newTitle) {
            // Empty title - delete the priority
            if (confirm('Delete this priority?')) {
                await deletePriority(type, priorityId);
            }
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

// Start adding a new priority
function startAddingPriority(container, type) {
    const addChip = container.querySelector('.priority-chip.add');

    // Create a temporary input chip
    const inputChip = document.createElement('div');
    inputChip.className = 'priority-chip editing';
    inputChip.innerHTML = `
        <span class="priority-num ${type}">${priorities[type].length + 1}</span>
        <input type="text" placeholder="New priority" />
    `;

    addChip.before(inputChip);

    const input = inputChip.querySelector('input');
    input.focus();

    const saveNew = async () => {
        const title = input.value.trim();
        inputChip.remove();

        if (title) {
            await addPriority(type, title);
        }
        // Re-render will happen via Firestore listener
    };

    input.addEventListener('blur', saveNew);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            inputChip.remove();
        }
    });
}

// Show context menu for priority (right-click)
function showPriorityContextMenu(chip, event) {
    // Close any existing context menus
    document.querySelectorAll('.priority-context-menu').forEach(m => m.remove());

    const priorityId = chip.dataset.priorityId;
    const type = chip.dataset.type;

    const menu = document.createElement('div');
    menu.className = 'dropdown show priority-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.innerHTML = `
        <div class="dropdown-item" data-action="edit">\u270f\ufe0f Edit</div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-item danger" data-action="delete">\ud83d\uddd1 Delete</div>
    `;

    document.body.appendChild(menu);

    menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
        menu.remove();
        startEditingPriority(chip);
    });

    menu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        menu.remove();
        if (confirm('Delete this priority?')) {
            await deletePriority(type, priorityId);
        }
    });

    // Close on click outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// Render mobile priorities panel
function renderMobilePriorities() {
    const container = document.getElementById('mobilePriorities');
    if (!container) return;

    container.innerHTML = `
        <div class="priorities-strip" style="background: transparent; border: none; padding: 0;">
            <div class="priorities-row">
                <span class="priorities-label">Work</span>
                <div class="priorities-list" id="mobileWorkPriorities"></div>
            </div>
            <div class="priorities-row">
                <span class="priorities-label">Personal</span>
                <div class="priorities-list" id="mobilePersonalPriorities"></div>
            </div>
        </div>
    `;

    const workContainer = document.getElementById('mobileWorkPriorities');
    const personalContainer = document.getElementById('mobilePersonalPriorities');

    if (workContainer) {
        renderPriorityList(workContainer, priorities.work, 'work');
    }
    if (personalContainer) {
        renderPriorityList(personalContainer, priorities.personal, 'personal');
    }
}

// Helper: escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
