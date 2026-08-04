/**
 * Code Editor Module
 * Syntax-highlighted code editing with language selection, line numbers,
 * tab support, copy-to-clipboard, and auto-save.
 */
import { supabase } from './supabase.js';
import { showToast } from './toast.js';
import { updatePadInList } from './sidebar.js';

let currentPad = null;
let saveTimer = null;
let isDirty = false;

const LANGUAGES = [
    'javascript', 'python', 'html', 'css', 'json', 'sql',
    'typescript', 'java', 'csharp', 'cpp', 'go', 'rust',
    'ruby', 'php', 'swift', 'kotlin', 'bash', 'yaml',
    'xml', 'markdown', 'plaintext'
];

export function renderCodeEditor(pad, canEdit) {
    currentPad = pad;
    isDirty = false;
    clearTimeout(saveTimer);

    const root = document.getElementById('editor-root');
    if (!root) return;

    const code = pad.content?.code || '';
    const language = pad.content?.language || pad.language || 'javascript';

    root.innerHTML = `
        <div class="code-editor-container">
            <div class="code-editor-header">
                <select id="code-language-select" class="select-field" style="width:auto; min-width:140px;" ${canEdit ? '' : 'disabled'}>
                    ${LANGUAGES.map((lang) => `<option value="${lang}" ${lang === language ? 'selected' : ''}>${lang}</option>`).join('')}
                </select>
                <button class="btn btn-ghost btn-sm" id="copy-code-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    Copy
                </button>
                ${canEdit ? '<span id="code-save-status" style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-left: auto;">Saved</span>' : ''}
            </div>
            <div class="code-editor-wrapper">
                <div class="code-line-numbers" id="code-line-numbers">1</div>
                <textarea
                    class="code-textarea"
                    id="code-textarea"
                    spellcheck="false"
                    autocapitalize="off"
                    autocomplete="off"
                    autocorrect="off"
                    placeholder="Paste or type your code here…"
                    ${canEdit ? '' : 'readonly'}
                >${escapeHtml(code)}</textarea>
            </div>
        </div>
    `;

    const textarea = document.getElementById('code-textarea');
    const lineNumbers = document.getElementById('code-line-numbers');
    const langSelect = document.getElementById('code-language-select');
    const copyBtn = document.getElementById('copy-code-btn');
    const saveStatus = document.getElementById('code-save-status');

    // Update line numbers
    updateLineNumbers(textarea, lineNumbers);

    // Input handler
    if (canEdit && textarea) {
        textarea.addEventListener('input', () => {
            isDirty = true;
            updateLineNumbers(textarea, lineNumbers);
            if (saveStatus) saveStatus.textContent = 'Unsaved';
            scheduleSave(saveStatus);
        });

        // Tab key support
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;

                if (e.shiftKey) {
                    // Remove indent
                    const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
                    const lineText = textarea.value.substring(lineStart, start);
                    if (lineText.startsWith('    ')) {
                        textarea.value = textarea.value.substring(0, lineStart) + textarea.value.substring(lineStart + 4);
                        textarea.selectionStart = textarea.selectionEnd = start - 4;
                    } else if (lineText.startsWith('\t')) {
                        textarea.value = textarea.value.substring(0, lineStart) + textarea.value.substring(lineStart + 1);
                        textarea.selectionStart = textarea.selectionEnd = start - 1;
                    }
                } else {
                    // Insert 4 spaces
                    textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 4;
                }

                isDirty = true;
                updateLineNumbers(textarea, lineNumbers);
                scheduleSave(saveStatus);
            }

            // Ctrl+S
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveNow(saveStatus);
            }
        });

        // Sync scroll between textarea and line numbers
        textarea.addEventListener('scroll', () => {
            if (lineNumbers) {
                lineNumbers.scrollTop = textarea.scrollTop;
            }
        });
    }

    // Language change
    langSelect?.addEventListener('change', () => {
        isDirty = true;
        scheduleSave(saveStatus);
    });

    // Copy to clipboard
    copyBtn?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(textarea?.value || '');
            showToast('Copied to clipboard', 'success');
        } catch {
            showToast('Failed to copy', 'error');
        }
    });
}

function updateLineNumbers(textarea, lineNumbers) {
    if (!textarea || !lineNumbers) return;
    const lines = textarea.value.split('\n').length;
    lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
}

function scheduleSave(saveStatus) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(saveStatus), 1500);
}

async function saveNow(saveStatus) {
    if (!currentPad || !isDirty) return;

    const textarea = document.getElementById('code-textarea');
    const langSelect = document.getElementById('code-language-select');
    if (!textarea) return;

    const content = {
        code: textarea.value,
        language: langSelect?.value || 'javascript'
    };

    const { error } = await supabase
        .from('pads')
        .update({ content, language: content.language })
        .eq('id', currentPad.id);

    if (error) {
        showToast('Failed to save', 'error');
        console.error(error);
        return;
    }

    isDirty = false;
    currentPad.content = content;
    if (saveStatus) saveStatus.textContent = 'Saved';
}

export async function saveCodeIfDirty() {
    const saveStatus = document.getElementById('code-save-status');
    await saveNow(saveStatus);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
