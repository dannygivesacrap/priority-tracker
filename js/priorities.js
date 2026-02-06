// Priority management module

// Local priority state
let priorities = {};

// Category list (default categories)
let categories = ['work', 'personal'];

// Category settings (labels and colors)
let categorySettings = {
    work: { label: 'Work', color: 'indigo' },
    personal: { label: 'Personal', color: 'green' }
};

// Available colors for categories
const categoryColors = ['indigo', 'green', 'orange', 'pink', 'purple', 'red', 'blue', 'teal'];

// Real-time listeners
let priorityListeners = [];
let categoriesListener = null;

// Load priorities from Firestore with real-time updates
function loadPriorities() {
    const userDoc = getUserDoc();

    // Clear existing listeners
    priorityListeners.forEach(unsubscribe => unsubscribe());
    priorityListeners = [];
    if (categoriesListener) categoriesListener();

    // First load categories
    categoriesListener = userDoc.collection('settings').doc('categories')
        .onSnapshot(doc => {
            if (doc.exists && doc.data().list) {
                categories = doc.data().list;
            } else {
                categories = ['work', 'personal'];
            }

            // Load category settings (labels and colors)
            if (doc.exists && doc.data().settings) {
                categorySettings = { ...categorySettings, ...doc.data().settings };
            }

            // Initialize priorities object for each category
            categories.forEach(cat => {
                if (!priorities[cat]) priorities[cat] = [];
                // Set default settings for new categories
                if (!categorySettings[cat]) {
                    categorySettings[cat] = {
                        label: cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' '),
                        color: categoryColors[categories.indexOf(cat) % categoryColors.length]
                    };
                }
            });

            // Load priorities for each category
            loadPrioritiesForCategories();
            renderPriorities();
        }, error => {
            console.error('Error loading categories:', error);
            categories = ['work', 'personal'];
            loadPrioritiesForCategories();
        });
}

function loadPrioritiesForCategories() {
    const userDoc = getUserDoc();

    // Clear existing priority listeners
    priorityListeners.forEach(unsubscribe => unsubscribe());
    priorityListeners = [];

    categories.forEach(type => {
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

// Add a new category
async function addNewCategory() {
    const name = prompt('Enter category name:');
    if (!name || !name.trim()) return;

    const categoryId = name.trim().toLowerCase().replace(/\s+/g, '-');

    if (categories.includes(categoryId)) {
        showToast('Category already exists');
        return;
    }

    categories.push(categoryId);
    priorities[categoryId] = [];

    // Assign a color that's not already used, or cycle through
    const usedColors = Object.values(categorySettings).map(s => s.color);
    const availableColor = categoryColors.find(c => !usedColors.includes(c)) || categoryColors[categories.length % categoryColors.length];

    categorySettings[categoryId] = {
        label: name.trim(),
        color: availableColor
    };

    const userDoc = getUserDoc();
    await userDoc.collection('settings').doc('categories').set({
        list: categories,
        settings: categorySettings
    }, { merge: true });

    await userDoc.collection('priorities').doc(categoryId).set({
        items: [],
        label: name.trim()
    });

    showToast('Category added!');
}

// Delete a category
async function deleteCategory(categoryId) {
    const label = getCategoryLabel(categoryId);
    if (!confirm(`Delete category "${label}" and all its priorities?`)) return;

    categories = categories.filter(c => c !== categoryId);
    delete priorities[categoryId];
    delete categorySettings[categoryId];

    const userDoc = getUserDoc();
    await userDoc.collection('settings').doc('categories').set({
        list: categories,
        settings: categorySettings
    }, { merge: true });

    await userDoc.collection('priorities').doc(categoryId).delete();

    showToast('Category deleted');
}

// Edit category label
async function editCategoryLabel(categoryId) {
    const currentLabel = getCategoryLabel(categoryId);
    const newLabel = prompt('Enter category name:', currentLabel);

    if (!newLabel || newLabel.trim() === currentLabel) return;

    categorySettings[categoryId] = {
        ...categorySettings[categoryId],
        label: newLabel.trim()
    };

    const userDoc = getUserDoc();
    await userDoc.collection('settings').doc('categories').set({
        list: categories,
        settings: categorySettings
    }, { merge: true });

    showToast('Category renamed');
}

// Set category color
async function setCategoryColor(categoryId, color) {
    categorySettings[categoryId] = {
        ...categorySettings[categoryId],
        color: color
    };

    const userDoc = getUserDoc();
    await userDoc.collection('settings').doc('categories').set({
        list: categories,
        settings: categorySettings
    }, { merge: true });

    renderPriorities();
    showToast('Color updated');
}

// Get category color
function getCategoryColor(categoryId) {
    return categorySettings[categoryId]?.color || 'indigo';
}

// Get category label
function getCategoryLabel(categoryId) {
    if (categorySettings[categoryId]?.label) {
        return categorySettings[categoryId].label;
    }
    const defaultLabels = {
        'work': 'Work',
        'personal': 'Personal'
    };
    return defaultLabels[categoryId] || categoryId.charAt(0).toUpperCase() + categoryId.slice(1).replace(/-/g, ' ');
}

// Render priorities to DOM
function renderPriorities() {
    renderPriorityStrip();
    renderMobilePriorities();
    renderPrioritiesManager();
}

// Render the priorities strip (desktop)
function renderPriorityStrip() {
    const strip = document.querySelector('.priorities-strip');
    if (!strip) return;

    // Build rows for each category
    let html = '';
    categories.forEach(cat => {
        const label = getCategoryLabel(cat);
        html += `
            <div class="priorities-row">
                <span class="priorities-label">${label}</span>
                <div class="priorities-list" id="${cat}Priorities"></div>
            </div>
        `;
    });

    strip.innerHTML = html;

    // Render priority chips for each category
    categories.forEach(cat => {
        const container = document.getElementById(`${cat}Priorities`);
        if (container) {
            renderPriorityList(container, priorities[cat] || [], cat);
        }
    });
}

// Render priorities manager view
function renderPrioritiesManager() {
    const container = document.getElementById('prioritiesManager');
    if (!container) return;

    let html = '';

    categories.forEach(cat => {
        const label = getCategoryLabel(cat);
        const color = getCategoryColor(cat);
        const catPriorities = (priorities[cat] || []).sort((a, b) => a.order - b.order);

        html += `
            <div class="priority-category" data-category="${cat}">
                <div class="priority-category-header">
                    <span>${label}</span>
                    <div>
                        <button class="category-edit-btn" onclick="editCategoryLabel('${cat}')">\u270f\ufe0f Edit</button>
                        <button onclick="deleteCategory('${cat}')">\u2715 Delete</button>
                    </div>
                </div>
                <div class="category-color-picker" data-category="${cat}">
                    ${categoryColors.map(c => `
                        <div class="color-option ${c} ${c === color ? 'selected' : ''}"
                             onclick="setCategoryColor('${cat}', '${c}')"
                             title="${c}"></div>
                    `).join('')}
                </div>
                <div class="priority-items" data-category="${cat}">
                    ${catPriorities.map((p, i) => `
                        <div class="priority-item" data-priority-id="${p.id}" data-category="${cat}" draggable="true">
                            <span class="priority-item-num ${color}">${i + 1}</span>
                            <span class="priority-item-title">${escapeHtml(p.title)}</span>
                            <div class="priority-item-actions">
                                <button onclick="editPriorityInManager('${cat}', '${p.id}')" title="Edit">\u270f\ufe0f</button>
                                <button class="delete" onclick="deletePriority('${cat}', '${p.id}')" title="Delete">\u2715</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="add-priority-btn" onclick="addPriorityInManager('${cat}')">+ Add Priority</div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Initialize drag and drop for priorities
    initPriorityDragAndDrop();
}

// Edit priority in manager view
function editPriorityInManager(category, priorityId) {
    const item = document.querySelector(`.priority-item[data-priority-id="${priorityId}"]`);
    if (!item) return;

    const titleEl = item.querySelector('.priority-item-title');
    const currentTitle = titleEl.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;

    titleEl.innerHTML = '';
    titleEl.appendChild(input);
    input.focus();
    input.select();

    const save = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            await updatePriority(category, priorityId, newTitle);
        } else {
            titleEl.textContent = currentTitle;
        }
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') {
            input.value = currentTitle;
            input.blur();
        }
    });
}

// Add priority from manager view
async function addPriorityInManager(category) {
    const title = prompt('Enter priority name:');
    if (title && title.trim()) {
        await addPriority(category, title.trim());
    }
}

// Drag and drop for priorities in manager
let draggedPriority = null;

function initPriorityDragAndDrop() {
    // Make priority items draggable
    document.querySelectorAll('.priority-item[draggable="true"]').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedPriority = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            document.querySelectorAll('.priority-item').forEach(i => i.classList.remove('drag-over'));
            document.querySelectorAll('.priority-items').forEach(c => c.classList.remove('drag-over'));
            draggedPriority = null;
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (item !== draggedPriority) {
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            item.classList.remove('drag-over');

            if (!draggedPriority || item === draggedPriority) return;

            const fromCategory = draggedPriority.dataset.category;
            const toCategory = item.dataset.category;
            const draggedId = draggedPriority.dataset.priorityId;
            const targetId = item.dataset.priorityId;

            if (fromCategory === toCategory) {
                // Reorder within same category
                const catPriorities = priorities[fromCategory];
                const fromIndex = catPriorities.findIndex(p => p.id === draggedId);
                const toIndex = catPriorities.findIndex(p => p.id === targetId);

                if (fromIndex !== -1 && toIndex !== -1) {
                    await reorderPriorities(fromCategory, fromIndex, toIndex);
                    showToast('Priority reordered');
                }
            } else {
                // Move to different category
                await movePriorityToCategory(draggedId, fromCategory, toCategory, targetId);
            }
        });
    });

    // Make category containers droppable
    document.querySelectorAll('.priority-items').forEach(container => {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (draggedPriority && container.dataset.category !== draggedPriority.dataset.category) {
                container.classList.add('drag-over');
            }
        });

        container.addEventListener('dragleave', (e) => {
            if (!container.contains(e.relatedTarget)) {
                container.classList.remove('drag-over');
            }
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');

            if (!draggedPriority) return;

            const fromCategory = draggedPriority.dataset.category;
            const toCategory = container.dataset.category;

            if (fromCategory !== toCategory) {
                const draggedId = draggedPriority.dataset.priorityId;
                await movePriorityToCategory(draggedId, fromCategory, toCategory);
            }
        });
    });
}

// Move priority from one category to another
async function movePriorityToCategory(priorityId, fromCategory, toCategory, beforePriorityId = null) {
    const fromPriorities = priorities[fromCategory];
    const priorityIndex = fromPriorities.findIndex(p => p.id === priorityId);

    if (priorityIndex === -1) return;

    // Remove from source category
    const [priority] = fromPriorities.splice(priorityIndex, 1);

    // Update order in source category
    fromPriorities.forEach((p, i) => p.order = i);

    // Add to target category
    if (!priorities[toCategory]) priorities[toCategory] = [];

    if (beforePriorityId) {
        const targetIndex = priorities[toCategory].findIndex(p => p.id === beforePriorityId);
        if (targetIndex !== -1) {
            priorities[toCategory].splice(targetIndex, 0, priority);
        } else {
            priorities[toCategory].push(priority);
        }
    } else {
        priorities[toCategory].push(priority);
    }

    // Update order in target category
    priorities[toCategory].forEach((p, i) => p.order = i);

    // Save both categories
    await savePriorities(fromCategory);
    await savePriorities(toCategory);

    showToast(`Priority moved to ${getCategoryLabel(toCategory)}`);
}

// Render a priority list into a container
function renderPriorityList(container, priorityList, type) {
    const sortedPriorities = [...priorityList].sort((a, b) => a.order - b.order);
    const color = getCategoryColor(type);

    const priorityChips = sortedPriorities.map((priority, index) => `
        <div class="priority-chip" data-priority-id="${priority.id}" data-type="${type}">
            <span class="priority-num ${color}">${index + 1}</span>
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

// Mobile priority layout preference (A, B, or C)
let mobilePriorityLayout = 'A';

// Render mobile priorities panel with layout options
function renderMobilePriorities() {
    const container = document.getElementById('mobilePriorities');
    if (!container) return;

    // Layout switcher for testing
    let html = `
        <div class="layout-switcher">
            <span>Layout:</span>
            <button onclick="setMobileLayout('A')" class="${mobilePriorityLayout === 'A' ? 'active' : ''}">A</button>
            <button onclick="setMobileLayout('B')" class="${mobilePriorityLayout === 'B' ? 'active' : ''}">B</button>
            <button onclick="setMobileLayout('C')" class="${mobilePriorityLayout === 'C' ? 'active' : ''}">C</button>
        </div>
    `;

    if (mobilePriorityLayout === 'A') {
        // Layout A: Full-width stacked cards
        html += '<div class="mobile-priorities-stacked">';
        categories.forEach(cat => {
            const label = getCategoryLabel(cat);
            const color = getCategoryColor(cat);
            const catPriorities = (priorities[cat] || []).sort((a, b) => a.order - b.order);

            html += `
                <div class="mobile-priority-card-full">
                    <div class="mobile-priority-header ${color}">${label}</div>
                    <div class="mobile-priority-list-full">
                        ${catPriorities.length === 0
                            ? '<div class="mobile-priority-empty">No priorities yet</div>'
                            : catPriorities.map((p, i) => `
                                <div class="mobile-priority-item-full">
                                    <span class="mobile-priority-num ${color}">${i + 1}</span>
                                    <span>${escapeHtml(p.title)}</span>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            `;
        });
        html += '</div>';

    } else if (mobilePriorityLayout === 'B') {
        // Layout B: Horizontal scrolling chips per category
        html += '<div class="mobile-priorities-rows">';
        categories.forEach(cat => {
            const label = getCategoryLabel(cat);
            const color = getCategoryColor(cat);
            const catPriorities = (priorities[cat] || []).sort((a, b) => a.order - b.order);

            html += `
                <div class="mobile-priority-row">
                    <div class="mobile-priority-row-label ${color}">${label}</div>
                    <div class="mobile-priority-chips">
                        ${catPriorities.length === 0
                            ? '<span class="mobile-priority-empty-inline">None</span>'
                            : catPriorities.map((p, i) => `
                                <div class="mobile-priority-chip">
                                    <span class="chip-num ${color}">${i + 1}</span>
                                    <span>${escapeHtml(p.title)}</span>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            `;
        });
        html += '</div>';

    } else if (mobilePriorityLayout === 'C') {
        // Layout C: Compact 2-column grid (original)
        html += '<div class="mobile-priorities-grid">';
        categories.forEach(cat => {
            const label = getCategoryLabel(cat);
            const color = getCategoryColor(cat);
            const catPriorities = (priorities[cat] || []).sort((a, b) => a.order - b.order);

            html += `
                <div class="mobile-priority-card">
                    <div class="mobile-priority-header ${color}">${label}</div>
                    <div class="mobile-priority-list">
                        ${catPriorities.length === 0
                            ? '<div class="mobile-priority-empty">No priorities</div>'
                            : catPriorities.map((p, i) => `
                                <div class="mobile-priority-item">
                                    <span class="mobile-priority-num ${color}">${i + 1}</span>
                                    <span class="mobile-priority-title">${escapeHtml(p.title)}</span>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

function setMobileLayout(layout) {
    mobilePriorityLayout = layout;
    renderMobilePriorities();
}

// Helper: escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
