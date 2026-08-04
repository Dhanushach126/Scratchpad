/**
 * File Pad Module
 * Drag-and-drop file uploads to Supabase Storage with image preview,
 * download, delete, and permission-gated actions.
 */
import { supabase } from './supabase.js';
import { showToast } from './toast.js';
import { getCurrentProfile } from './auth.js';

let currentPad = null;
let files = [];
let canEditFlag = false;

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
    root.innerHTML = `
        <div class="file-pad-container">
            ${canEditFlag ? `
                <div class="file-dropzone" id="file-dropzone">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                    <p>Drag & drop files here, or <span class="file-dropzone-accent">browse</span></p>
                    <p style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">Max 10MB per file</p>
                    <input type="file" id="file-input" multiple />
                </div>
            ` : ''}
            <div class="file-grid" id="file-grid">
                ${files.length === 0 ? `
                    <div class="placeholder-block" style="grid-column: 1 / -1;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <p>No files uploaded yet</p>
                    </div>
                ` : files.map((file, idx) => renderFileCard(file, idx)).join('')}
            </div>
        </div>
    `;

    bindFileEvents(root);
}

function renderFileCard(file, index) {
    const isImage = IMAGE_TYPES.includes(file.type);
    const sizeStr = formatFileSize(file.size);

    return `
        <div class="file-card" data-index="${index}">
            <div class="file-card-preview">
                ${isImage && file.url
                    ? `<img src="${escapeAttr(file.url)}" alt="${escapeAttr(file.name)}" loading="lazy" />`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`
                }
            </div>
            <div class="file-card-name" title="${escapeAttr(file.name)}">${escapeHtml(file.name)}</div>
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

    // Drag events
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            handleFiles(e.dataTransfer.files, root);
        });
    }

    // File input
    fileInput?.addEventListener('change', (e) => {
        handleFiles(e.target.files, root);
        e.target.value = ''; // Reset for re-upload
    });

    // Download buttons
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

                // Create download link
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

    // Delete buttons
    root.querySelectorAll('.file-delete-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.index, 10);
            const file = files[idx];
            if (!file?.storagePath) return;

            try {
                // Delete from storage
                const { error: storageError } = await supabase.storage
                    .from('pad-files')
                    .remove([file.storagePath]);

                if (storageError) throw storageError;

                // Remove from list and save
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

async function handleFiles(fileList, root) {
    if (!fileList || fileList.length === 0) return;

    const profile = getCurrentProfile();
    if (!profile || !currentPad) return;

    for (const file of fileList) {
        // Validate size
        if (file.size > MAX_FILE_SIZE) {
            showToast(`${file.name} exceeds 10MB limit`, 'warning');
            continue;
        }

        try {
            // Generate safe path
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

            // Add to files list
            files.push({
                name: file.name,
                type: file.type,
                size: file.size,
                storagePath,
                url,
                uploadedAt: new Date().toISOString(),
                uploadedBy: profile.id
            });

            showToast(`${file.name} uploaded`, 'success');
        } catch (err) {
            showToast(`Failed to upload ${file.name}`, 'error');
            console.error(err);
        }
    }

    // Save updated file list
    await saveFiles();
    renderFileUI(root);
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
