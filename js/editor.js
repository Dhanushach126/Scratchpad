/**
 * Note (Markdown) Editor Module
 * Rich textarea with formatting toolbar, live preview, auto-save, and read-only mode.
 */
import { supabase } from './supabase.js';
import { showToast } from './toast.js';
import { getCurrentProfile } from './auth.js';
import { updatePadInList } from './sidebar.js';

let currentPad = null;
let saveTimer = null;
let isDirty = false;

/**
 * Render the note editor for the given pad.
 */
export function renderNoteEditor(pad, canEdit) {
    currentPad = pad;
    isDirty = false;
    clearTimeout(saveTimer);

    const root = document.getElementById('editor-root');
    if (!root) return;

    const content = pad.content?.text || '';

    root.innerHTML = `
        <div class="editor-container">
            ${canEdit ? `
            <div class="editor-toolbar">
                <button class="toolbar-btn" data-action="bold" title="Bold (Ctrl+B)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>
                </button>
                <button class="toolbar-btn" data-action="italic" title="Italic (Ctrl+I)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
                </button>
                <span class="toolbar-divider"></span>
                <button class="toolbar-btn" data-action="h1" title="Heading 1">H1</button>
                <button class="toolbar-btn" data-action="h2" title="Heading 2">H2</button>
                <button class="toolbar-btn" data-action="h3" title="Heading 3">H3</button>
                <span class="toolbar-divider"></span>
                <button class="toolbar-btn" data-action="ul" title="Bullet List">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                </button>
                <button class="toolbar-btn" data-action="code" title="Code Block">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                </button>
                <button class="toolbar-btn" data-action="link" title="Link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </button>
            </div>
            ` : ''}
            <div class="editor-main">
                <textarea
                    class="editor-textarea"
                    id="note-textarea"
                    placeholder="Start writing in Markdown…"
                    ${canEdit ? '' : 'readonly'}
                >${escapeHtml(content)}</textarea>
                <div class="editor-preview" id="note-preview">
                    <div class="markdown-body" id="note-preview-body"></div>
                </div>
            </div>
        </div>
    `;

    const textarea = document.getElementById('note-textarea');
    const preview = document.getElementById('note-preview');

    // Auto-save on input
    if (canEdit && textarea) {
        textarea.addEventListener('input', () => {
            isDirty = true;
            scheduleSave();
            // Update live preview for split-screen
            if (preview) {
                renderPreview(textarea.value);
            }
        });

        // Keyboard shortcuts in textarea
        textarea.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b': e.preventDefault(); wrapSelection(textarea, '**'); break;
                    case 'i': e.preventDefault(); wrapSelection(textarea, '_'); break;
                    case 's': e.preventDefault(); saveNow(); break;
                }
            }
        });
    }

    // Toolbar actions
    root.querySelectorAll('.toolbar-btn[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
            handleToolbarAction(btn.dataset.action, textarea);
        });
    });
}

function handleToolbarAction(action, textarea) {
    if (!textarea) return;

    switch (action) {
        case 'bold': wrapSelection(textarea, '**'); break;
        case 'italic': wrapSelection(textarea, '_'); break;
        case 'h1': insertAtLineStart(textarea, '# '); break;
        case 'h2': insertAtLineStart(textarea, '## '); break;
        case 'h3': insertAtLineStart(textarea, '### '); break;
        case 'ul': insertAtLineStart(textarea, '- '); break;
        case 'code': wrapSelection(textarea, '```\n', '\n```'); break;
        case 'link': insertText(textarea, '[link text](url)'); break;
        case 'preview': break; // handled separately
    }

    isDirty = true;
    scheduleSave();
}

function wrapSelection(textarea, wrapper, endWrapper) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    const end_ = endWrapper || wrapper;
    textarea.value = before + wrapper + selected + end_ + after;
    textarea.selectionStart = start + wrapper.length;
    textarea.selectionEnd = start + wrapper.length + selected.length;
    textarea.focus();
}

function insertAtLineStart(textarea, prefix) {
    const start = textarea.selectionStart;
    const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
    const before = textarea.value.substring(0, lineStart);
    const after = textarea.value.substring(lineStart);
    textarea.value = before + prefix + after;
    textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
    textarea.focus();
}

function insertText(textarea, text) {
    const start = textarea.selectionStart;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(textarea.selectionEnd);
    textarea.value = before + text + after;
    textarea.selectionStart = start;
    textarea.selectionEnd = start + text.length;
    textarea.focus();
}

function renderPreview(text) {
    const previewBody = document.getElementById('note-preview-body');
    if (!previewBody || typeof marked === 'undefined') return;

    // Configure marked for security
    marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false // marked's sanitize is deprecated, we use DOMPurify
    });

    // Parse Markdown to HTML
    const rawHtml = marked.parse(text || '');

    // Sanitize HTML using DOMPurify (prevent XSS)
    const cleanHtml = typeof DOMPurify !== 'undefined' 
        ? DOMPurify.sanitize(rawHtml)
        : rawHtml; // Fallback if DOMPurify fails to load (though CSP should protect us)

    previewBody.innerHTML = cleanHtml;
}

function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 1500);
}

async function saveNow() {
    if (!currentPad || !isDirty) return;

    const textarea = document.getElementById('note-textarea');
    if (!textarea) return;

    const content = { text: textarea.value };

    const { error } = await supabase
        .from('pads')
        .update({ content })
        .eq('id', currentPad.id);

    if (error) {
        showToast('Failed to save', 'error');
        console.error(error);
        return;
    }

    isDirty = false;
    currentPad.content = content;
}

/**
 * Save immediately (used by Ctrl+S and pad switching).
 */
export async function saveNoteIfDirty() {
    await saveNow();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
