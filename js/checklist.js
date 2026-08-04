/**
 * Checklist Editor Module
 * Interactive task list with animated checkboxes, drag-and-drop reordering,
 * progress bar, auto-save, and read-only mode.
 */
import { supabase } from './supabase.js';
import { showToast } from './toast.js';

let currentPad = null;
let items = [];
let saveTimer = null;
let isDirty = false;
let canEditFlag = false;
let dragSrcIndex = null;

export function renderChecklistEditor(pad, canEdit) {
    currentPad = pad;
    canEditFlag = canEdit;
    isDirty = false;
    clearTimeout(saveTimer);

    items = pad.content?.items || [];

    const root = document.getElementById('editor-root');
    if (!root) return;

    renderChecklist(root);
}

function renderChecklist(root) {
    const completed = items.filter((i) => i.done).length;
    const total = items.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    root.innerHTML = `
        <div class="checklist-container">
            <div class="checklist-progress">
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${percent}%"></div>
                </div>
                <span class="checklist-progress-text">${completed}/${total} (${percent}%)</span>
            </div>
            <div class="checklist-items" id="checklist-items">
                ${items.map((item, idx) => renderItem(item, idx)).join('')}
            </div>
            ${canEditFlag ? `
                <button class="checklist-add-btn" id="checklist-add-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    Add item
                </button>
            ` : ''}
        </div>
    `;

    // Bind events
    bindChecklistEvents(root);
}

function renderItem(item, index) {
    return `
        <div class="checklist-item" data-index="${index}" draggable="${canEditFlag}">
            <div class="checklist-checkbox">
                <input type="checkbox" ${item.done ? 'checked' : ''} ${canEditFlag ? '' : 'disabled'} data-index="${index}" />
                <span class="checkmark">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
            </div>
            <input
                type="text"
                class="checklist-item-text ${item.done ? 'completed' : ''}"
                value="${escapeAttr(item.text)}"
                data-index="${index}"
                ${canEditFlag ? '' : 'readonly'}
                placeholder="Type here…"
            />
            ${canEditFlag ? `
                <button class="btn-icon checklist-item-delete" data-index="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            ` : ''}
        </div>
    `;
}

function bindChecklistEvents(root) {
    // Checkbox toggle
    root.querySelectorAll('.checklist-checkbox input').forEach((checkbox) => {
        checkbox.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            items[idx].done = e.target.checked;

            // Update text style
            const textInput = root.querySelector(`.checklist-item-text[data-index="${idx}"]`);
            if (textInput) {
                textInput.classList.toggle('completed', e.target.checked);
            }

            isDirty = true;
            scheduleSave();
            updateProgress(root);
        });
    });

    // Text editing
    root.querySelectorAll('.checklist-item-text').forEach((input) => {
        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            items[idx].text = e.target.value;
            isDirty = true;
            scheduleSave();
        });

        // Enter to add new item
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && canEditFlag) {
                e.preventDefault();
                const idx = parseInt(e.target.dataset.index, 10);
                items.splice(idx + 1, 0, { text: '', done: false });
                isDirty = true;
                scheduleSave();
                renderChecklist(root);
                // Focus new item
                setTimeout(() => {
                    const newInput = root.querySelector(`.checklist-item-text[data-index="${idx + 1}"]`);
                    newInput?.focus();
                }, 50);
            }

            // Backspace on empty to delete
            if (e.key === 'Backspace' && e.target.value === '' && canEditFlag && items.length > 1) {
                e.preventDefault();
                const idx = parseInt(e.target.dataset.index, 10);
                items.splice(idx, 1);
                isDirty = true;
                scheduleSave();
                renderChecklist(root);
                // Focus previous item
                setTimeout(() => {
                    const prevInput = root.querySelector(`.checklist-item-text[data-index="${Math.max(0, idx - 1)}"]`);
                    prevInput?.focus();
                }, 50);
            }
        });
    });

    // Delete buttons
    root.querySelectorAll('.checklist-item-delete').forEach((btn) => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            items.splice(idx, 1);
            isDirty = true;
            scheduleSave();
            renderChecklist(root);
        });
    });

    // Add button
    const addBtn = document.getElementById('checklist-add-btn');
    addBtn?.addEventListener('click', () => {
        items.push({ text: '', done: false });
        isDirty = true;
        scheduleSave();
        renderChecklist(root);
        // Focus new item
        setTimeout(() => {
            const lastInput = root.querySelector(`.checklist-item-text[data-index="${items.length - 1}"]`);
            lastInput?.focus();
        }, 50);
    });

    // Drag and drop
    if (canEditFlag) {
        bindDragAndDrop(root);
    }
}

function bindDragAndDrop(root) {
    const itemEls = root.querySelectorAll('.checklist-item');

    itemEls.forEach((el) => {
        el.addEventListener('dragstart', (e) => {
            dragSrcIndex = parseInt(el.dataset.index, 10);
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            root.querySelectorAll('.checklist-item').forEach((item) => {
                item.classList.remove('drag-over');
            });
        });

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            el.classList.add('drag-over');
        });

        el.addEventListener('dragleave', () => {
            el.classList.remove('drag-over');
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.classList.remove('drag-over');
            const dropIndex = parseInt(el.dataset.index, 10);

            if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
                const [moved] = items.splice(dragSrcIndex, 1);
                items.splice(dropIndex, 0, moved);
                isDirty = true;
                scheduleSave();
                renderChecklist(root);
            }
            dragSrcIndex = null;
        });
    });
}

function updateProgress(root) {
    const completed = items.filter((i) => i.done).length;
    const total = items.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const fill = root.querySelector('.progress-bar-fill');
    const text = root.querySelector('.checklist-progress-text');

    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `${completed}/${total} (${percent}%)`;
}

function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 1500);
}

async function saveNow() {
    if (!currentPad || !isDirty) return;

    const content = { items };

    const { error } = await supabase
        .from('pads')
        .update({ content })
        .eq('id', currentPad.id);

    if (error) {
        showToast('Failed to save checklist', 'error');
        console.error(error);
        return;
    }

    isDirty = false;
    currentPad.content = content;
}

export async function saveChecklistIfDirty() {
    await saveNow();
}

function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
