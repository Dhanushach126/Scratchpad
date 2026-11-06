/**
 * File Pad Module
 * Drag-and-drop file & folder uploads to Supabase Storage with image preview,
 * download, delete, folder structure display, and permission-gated actions.
 */
import { supabase } from './supabase.js';
import { showToast } from './toast.js';
import { getCurrentProfile } from './auth.js';

let currentPad = null;
let files = [];
let canEditFlag = false;
let collapsedFolders = new Set();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export function renderFilePad(pad, canEdit) {
    currentPad = pad;
    canEditFlag = canEdit;
    files = pad.content?.files || [];

    const root = document.getElementById('editor-root');
    if (!root) return;

    renderFileUI(root);
}

function renderFileUI(root) {
    // Group files by folder
    const { folders, looseFiles } = groupFilesByFolder(files);
    const hasFolders = Object.keys(folders).length > 0;

    root.innerHTML = `
        <div class="file-pad-container">
            ${canEditFlag ? `
                <div class="file-upload-zone">
                    <div class="file-dropzone" id="file-dropzone">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        <p>Drag & drop files or folders here, or <span class="file-dropzone-accent">browse files</span></p>
                        <p style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">Max 10MB per file</p>
                        <input type="file" id="file-input" multiple />
                    </div>
                    <button class="file-folder-btn" id="folder-upload-btn" title="Upload entire folder">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="12" x2="12" y1="10" y2="16"/><line x1="9" x2="15" y1="13" y2="13"/></svg>
                        Upload Folder
                        <input type="file" id="folder-input" webkitdirectory directory multiple />
                    </button>
                </div>
                <div class="file-upload-progress hidden" id="upload-progress">
                    <div class="upload-progress-bar" id="upload-progress-bar"></div>
                    <span class="upload-progress-text" id="upload-progress-text">Uploading...</span>
                </div>
            ` : ''}
            <div class="file-list-container" id="file-list-container">
                ${files.length === 0 ? `
                    <div class="placeholder-block" style="grid-column: 1 / -1;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <p>No files uploaded yet</p>
                    </div>
                ` : `
                    ${Object.entries(folders).map(([folderName, folderFiles]) => renderFolderGroup(folderName, folderFiles)).join('')}
                    ${looseFiles.length > 0 ? `
                        ${hasFolders ? '<div class="file-section-label">Individual Files</div>' : ''}
                        <div class="file-grid">
                            ${looseFiles.map((f) => renderFileCard(f.file, f.index)).join('')}
                        </div>
                    ` : ''}
                `}
            </div>
        </div>
    `;

    bindFileEvents(root);
}

/**
 * Group files by their folder path. Files without a folderPath are "loose".
 */
function groupFilesByFolder(filesList) {
    const folders = {};
    const looseFiles = [];

    filesList.forEach((file, index) => {
        if (file.folderPath) {
            // Use the top-level folder name as the group key
            const topFolder = file.folderPath.split('/')[0];
            if (!folders[topFolder]) folders[topFolder] = [];
            folders[topFolder].push({ file, index });
        } else {
            looseFiles.push({ file, index });
        }
    });

    return { folders, looseFiles };
}

/**
 * Render a collapsible folder group with its files.
 */
function renderFolderGroup(folderName, folderFiles) {
    const isCollapsed = collapsedFolders.has(folderName);
    const totalSize = folderFiles.reduce((sum, f) => sum + (f.file.size || 0), 0);
    const fileCount = folderFiles.length;

    return `
        <div class="file-folder-group" data-folder="${escapeAttr(folderName)}">
            <button class="file-folder-header" data-folder-toggle="${escapeAttr(folderName)}">
                <svg class="folder-chevron ${isCollapsed ? '' : 'open'}" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                <svg class="folder-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                <span class="folder-name">${escapeHtml(folderName)}</span>
                <span class="folder-meta">${fileCount} file${fileCount !== 1 ? 's' : ''} · ${formatFileSize(totalSize)}</span>
                ${canEditFlag ? `
                    <button class="btn-icon file-folder-delete-btn" data-folder-delete="${escapeAttr(folderName)}" title="Delete folder">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                    </button>
                ` : ''}
            </button>
            <div class="file-folder-content ${isCollapsed ? 'collapsed' : ''}">
                <div class="file-grid">
                    ${folderFiles.map((f) => renderFileCard(f.file, f.index, true)).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderFileCard(file, index, showPath = false) {
    const isImage = IMAGE_TYPES.includes(file.type);
    const sizeStr = formatFileSize(file.size);
    // Show the relative path within the folder (excluding top-level folder name)
    const displayPath = showPath && file.folderPath
        ? file.folderPath.split('/').slice(1).join('/')
        : '';

    return `
        <div class="file-card" data-index="${index}">
            <div class="file-card-preview">
                ${isImage && file.url
                    ? `<img src="${escapeAttr(file.url)}" alt="${escapeAttr(file.name)}" loading="lazy" />`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`
                }
            </div>
            <div class="file-card-name" title="${escapeAttr(file.name)}">${escapeHtml(file.name)}</div>
            ${displayPath ? `<div class="file-card-path" title="${escapeAttr(displayPath)}">${escapeHtml(displayPath)}</div>` : ''}
            <div class="file-card-meta">${sizeStr}</div>
            <div class="file-card-actions">
                <button class="btn btn-ghost btn-sm file-download-btn" data-index="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Download
                </button>
                ${canEditFlag ? `
                    <button class="btn btn-danger btn-sm file-delete-btn" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                        Delete
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function bindFileEvents(root) {
    const dropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('file-input');
    const folderInput = document.getElementById('folder-input');
    const folderBtn = document.getElementById('folder-upload-btn');

    // --- Drag & drop (files and folders) ---
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');

            // Try to use DataTransferItem API for folder support
            if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                const entries = [];
                for (const item of e.dataTransfer.items) {
                    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                    if (entry) entries.push(entry);
                }

                // Check if any entry is a directory
                const hasDirectory = entries.some((entry) => entry.isDirectory);
                if (hasDirectory) {
                    const collectedFiles = await collectEntriesFiles(entries);
                    await handleFiles(collectedFiles, root);
                    return;
                }
            }

            // Fallback: plain file drop
            handleFiles(Array.from(e.dataTransfer.files).map((f) => ({ file: f, relativePath: '' })), root);
        });
    }

    // --- File input (individual files) ---
    fileInput?.addEventListener('change', (e) => {
        const fileEntries = Array.from(e.target.files).map((f) => ({ file: f, relativePath: '' }));
        handleFiles(fileEntries, root);
        e.target.value = '';
    });

    // --- Folder input ---
    folderInput?.addEventListener('change', (e) => {
        const fileEntries = Array.from(e.target.files).map((f) => ({
            file: f,
            relativePath: f.webkitRelativePath || ''
        }));
        handleFiles(fileEntries, root);
        e.target.value = '';
    });

    // --- Folder toggle (collapse/expand) ---
    root.querySelectorAll('[data-folder-toggle]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            // Don't toggle if delete button was clicked
            if (e.target.closest('.file-folder-delete-btn')) return;

            const folderName = btn.dataset.folderToggle;
            if (collapsedFolders.has(folderName)) {
                collapsedFolders.delete(folderName);
            } else {
                collapsedFolders.add(folderName);
            }
            renderFileUI(root);
        });
    });

    // --- Folder delete ---
    root.querySelectorAll('.file-folder-delete-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const folderName = btn.dataset.folderDelete;
            if (!confirm(`Delete all files in "${folderName}"?`)) return;

            try {
                // Collect all files in this folder
                const folderFiles = files.filter((f) => f.folderPath && f.folderPath.split('/')[0] === folderName);
                const storagePaths = folderFiles.map((f) => f.storagePath).filter(Boolean);

                // Delete from storage in batch
                if (storagePaths.length > 0) {
                    const { error: storageError } = await supabase.storage
                        .from('pad-files')
                        .remove(storagePaths);

                    if (storageError) throw storageError;
                }

                // Remove from list
                files = files.filter((f) => !(f.folderPath && f.folderPath.split('/')[0] === folderName));
                collapsedFolders.delete(folderName);
                await saveFiles();
                renderFileUI(root);
                showToast(`Folder "${folderName}" deleted`, 'success');
            } catch (err) {
                showToast('Failed to delete folder', 'error');
                console.error(err);
            }
        });
    });

    // --- Download buttons ---
    root.querySelectorAll('.file-download-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.index, 10);
            const file = files[idx];
            if (!file?.storagePath) return;

            try {
                const { data, error } = await supabase.storage
                    .from('pad-files')
                    .download(file.storagePath);

                if (error) throw error;

                const url = URL.createObjectURL(data);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                a.click();
                URL.revokeObjectURL(url);
            } catch (err) {
                showToast('Download failed', 'error');
                console.error(err);
            }
        });
    });

    // --- Delete buttons (individual file) ---
    root.querySelectorAll('.file-delete-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.index, 10);
            const file = files[idx];
            if (!file?.storagePath) return;

            try {
                const { error: storageError } = await supabase.storage
                    .from('pad-files')
                    .remove([file.storagePath]);

                if (storageError) throw storageError;

                files.splice(idx, 1);
                await saveFiles();
                renderFileUI(root);
                showToast('File deleted', 'success');
            } catch (err) {
                showToast('Failed to delete file', 'error');
                console.error(err);
            }
        });
    });
}

/**
 * Recursively collect all files from DataTransferEntry items (for drag-and-drop folder support).
 */
async function collectEntriesFiles(entries) {
    const result = [];

    async function readEntry(entry, parentPath) {
        if (entry.isFile) {
            const file = await new Promise((resolve, reject) => {
                entry.file(resolve, reject);
            });
            result.push({
                file,
                relativePath: parentPath ? `${parentPath}/${file.name}` : file.name
            });
        } else if (entry.isDirectory) {
            const dirPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
            const dirReader = entry.createReader();

            // Read all entries (readEntries may return partial results)
            let allEntries = [];
            let batch;
            do {
                batch = await new Promise((resolve, reject) => {
                    dirReader.readEntries(resolve, reject);
                });
                allEntries = allEntries.concat(batch);
            } while (batch.length > 0);

            for (const child of allEntries) {
                await readEntry(child, dirPath);
            }
        }
    }

    for (const entry of entries) {
        await readEntry(entry, '');
    }

    return result;
}

/**
 * Handle file uploads. Each entry is { file: File, relativePath: string }.
 */
async function handleFiles(fileEntries, root) {
    if (!fileEntries || fileEntries.length === 0) return;

    const profile = getCurrentProfile();
    if (!profile || !currentPad) return;

    const total = fileEntries.length;
    let uploaded = 0;
    let skipped = 0;

    // Show progress bar
    showUploadProgress(0, total);

    for (const entry of fileEntries) {
        const file = entry.file;
        const relativePath = entry.relativePath || '';

        // Validate size
        if (file.size > MAX_FILE_SIZE) {
            showToast(`${file.name} exceeds 10MB limit`, 'warning');
            skipped++;
            uploaded++;
            updateUploadProgress(uploaded, total);
            continue;
        }

        // Skip hidden/system files
        if (file.name.startsWith('.')) {
            skipped++;
            uploaded++;
            updateUploadProgress(uploaded, total);
            continue;
        }

        try {
            // Generate safe storage path
            const ext = file.name.split('.').pop() || 'bin';
            const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
            const storagePath = `${currentPad.id}/${safeName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('pad-files')
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Get public URL for images
            let url = null;
            if (IMAGE_TYPES.includes(file.type)) {
                const { data: urlData } = supabase.storage
                    .from('pad-files')
                    .getPublicUrl(storagePath);
                url = urlData?.publicUrl || null;
            }

            // Compute folder path from relative path (everything before the filename)
            const folderPath = relativePath
                ? relativePath.split('/').slice(0, -1).join('/')
                : '';

            // Add to files list
            files.push({
                name: file.name,
                type: file.type,
                size: file.size,
                storagePath,
                url,
                folderPath: folderPath || null,
                relativePath: relativePath || null,
                uploadedAt: new Date().toISOString(),
                uploadedBy: profile.id
            });
        } catch (err) {
            showToast(`Failed to upload ${file.name}`, 'error');
            console.error(err);
        }

        uploaded++;
        updateUploadProgress(uploaded, total);
    }

    // Save and re-render
    await saveFiles();
    hideUploadProgress();
    renderFileUI(root);

    const successCount = uploaded - skipped;
    if (successCount > 0) {
        showToast(`${successCount} file${successCount !== 1 ? 's' : ''} uploaded`, 'success');
    }
}

function showUploadProgress(current, total) {
    const container = document.getElementById('upload-progress');
    if (!container) return;
    container.classList.remove('hidden');
    updateUploadProgress(current, total);
}

function updateUploadProgress(current, total) {
    const bar = document.getElementById('upload-progress-bar');
    const text = document.getElementById('upload-progress-text');
    if (bar) bar.style.width = `${Math.round((current / total) * 100)}%`;
    if (text) text.textContent = `Uploading ${current} of ${total}…`;
}

function hideUploadProgress() {
    const container = document.getElementById('upload-progress');
    if (container) container.classList.add('hidden');
}

async function saveFiles() {
    if (!currentPad) return;

    const content = { files };

    const { error } = await supabase
        .from('pads')
        .update({ content })
        .eq('id', currentPad.id);

    if (error) {
        showToast('Failed to save file list', 'error');
        console.error(error);
    }

    currentPad.content = content;
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
