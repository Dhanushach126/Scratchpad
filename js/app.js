/**
 * App Module — Entry Point & Router Controller
 * Initializes auth listeners, keyboard shortcuts, title editing,
 * sensitivity toggling, pad loading, editor dispatching, and email invite verification.
 */
import { supabase } from './supabase.js';
import { initTheme } from './theme.js';
import { showToast } from './toast.js';
import { initAuth, fetchProfile, updateUserDisplay, getCurrentProfile, showInviteOnAuthCard } from './auth.js';
import { initSidebar, loadPads, setActivePad, removePadFromList, updatePadInList } from './sidebar.js';
import { renderNoteEditor, saveNoteIfDirty } from './editor.js';
import { renderCodeEditor, saveCodeIfDirty } from './code-editor.js';
import { renderChecklistEditor, saveChecklistIfDirty } from './checklist.js';
import { renderFilePad } from './file-pad.js';
import { initPermissionsModal, openPermissionsModal } from './permissions-modal.js';
import { renderAdminPanel } from './admin-panel.js';

let currentPad = null;
let currentPadCanEdit = false;
let titleSaveTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initAuth();
    initPermissionsModal();
    setupHeaderControls();
    setupKeyboardShortcuts();

    // Register PWA service worker for mobile installability
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.log('SW registration skipped:', err);
            });
        });
    }

    // Check if user arrived via an invite verification link
    checkUrlForInvite();

    // Initialize sidebar callbacks
    initSidebar({
        onSelect: (padId) => openPad(padId),
        onCreate: (pad) => openPad(pad.id)
    });

    // Admin panel button
    document.getElementById('admin-panel-btn')?.addEventListener('click', () => {
        showAdminView();
    });

    // Supabase Auth State Change Listener
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            updateUserDisplay(profile);
            showWorkspaceView();
            await loadPads();

            // Process any pending invite from URL/sessionStorage
            await processPendingInvite(profile);

            // Check for other pending invites in DB for this user's email
            await checkPendingInvitesForUser(profile);
        } else {
            showAuthView();

            // If an invite was saved, show it on the auth card
            const pendingInviteStr = sessionStorage.getItem('scratchpad_pending_invite');
            if (pendingInviteStr) {
                try {
                    const invite = JSON.parse(pendingInviteStr);
                    showInviteOnAuthCard(invite);
                } catch (e) {}
            }
        }
    });
});

/**
 * Check URL query parameters for an invitation token and details
 */
function checkUrlForInvite() {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');

    if (inviteToken) {
        const inviteData = {
            token: inviteToken,
            padId: urlParams.get('pad'),
            email: urlParams.get('email'),
            permission: urlParams.get('perm') || 'view',
            padTitle: urlParams.get('title') || 'Shared Document'
        };

        // Save to sessionStorage so it persists across redirects and auth flows
        sessionStorage.setItem('scratchpad_pending_invite', JSON.stringify(inviteData));

        // Clean up URL without refreshing the page
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        // Show notice immediately if auth view is active
        showInviteOnAuthCard(inviteData);
    }
}

/**
 * Accept and verify a pending invitation after user logs in or clicks verify
 */
async function processPendingInvite(profile) {
    if (!profile) return;

    const pendingInviteStr = sessionStorage.getItem('scratchpad_pending_invite');
    if (!pendingInviteStr) return;

    let invite = null;
    try {
        invite = JSON.parse(pendingInviteStr);
    } catch (e) {
        return;
    }

    if (!invite || !invite.padId) return;

    try {
        // Try calling stored procedure if available
        let granted = false;
        const { data: rpcResult, error: rpcError } = await supabase.rpc('accept_pad_invitation', {
            p_token: invite.token || '',
            p_pad_id: parseInt(invite.padId, 10)
        });

        if (!rpcError && rpcResult) {
            granted = true;
        } else {
            // Direct client-side verification fallback
            // 1. Insert into pad_permissions
            const { error: permError } = await supabase
                .from('pad_permissions')
                .upsert({
                    pad_id: parseInt(invite.padId, 10),
                    user_id: profile.id,
                    permission: invite.permission || 'view'
                }, { onConflict: 'pad_id,user_id' });

            if (!permError) {
                granted = true;
                // 2. Clean up pending_permissions
                if (profile.email) {
                    await supabase
                        .from('pending_permissions')
                        .delete()
                        .eq('pad_id', parseInt(invite.padId, 10))
                        .eq('email', profile.email.toLowerCase());
                }
            }
        }

        sessionStorage.removeItem('scratchpad_pending_invite');

        if (granted) {
            showToast(`Verified! Access granted to "${invite.padTitle || 'pad'}"`, 'success');
            await loadPads();
            await openPad(parseInt(invite.padId, 10));
        }
    } catch (err) {
        console.error('Error processing pending invite:', err);
    }
}

/**
 * Check if there are any invitations pending for the logged-in user's email
 */
async function checkPendingInvitesForUser(profile) {
    if (!profile?.email) return;

    const banner = document.getElementById('workspace-invite-banner');
    if (!banner) return;

    try {
        const { data: invites, error } = await supabase
            .from('pending_permissions')
            .select(`
                id,
                pad_id,
                email,
                permission,
                pads!pending_permissions_pad_id_fkey (id, title, type)
            `)
            .ilike('email', profile.email)
            .limit(1);

        if (error || !invites || invites.length === 0) {
            banner.classList.add('hidden');
            return;
        }

        const invite = invites[0];
        const padTitle = invite.pads?.title || 'Shared Document';
        const roleLabel = invite.permission === 'edit' ? 'Editor' : 'Viewer';

        banner.innerHTML = `
            <div class="workspace-invite-content">
                <span>📬</span>
                <div>You have been invited to collaborate on <strong>"${escapeHtml(padTitle)}"</strong> with <strong>${roleLabel}</strong> access.</div>
            </div>
            <div class="workspace-invite-actions">
                <button class="btn btn-sm btn-accept-invite" id="banner-accept-btn">Verify & Accept</button>
                <button class="btn btn-sm btn-ghost" id="banner-decline-btn">Dismiss</button>
            </div>
        `;
        banner.classList.remove('hidden');

        document.getElementById('banner-accept-btn')?.addEventListener('click', async () => {
            // Grant access
            const { error: grantErr } = await supabase
                .from('pad_permissions')
                .upsert({
                    pad_id: invite.pad_id,
                    user_id: profile.id,
                    permission: invite.permission
                }, { onConflict: 'pad_id,user_id' });

            if (grantErr) {
                showToast('Failed to accept invitation', 'error');
                return;
            }

            // Remove from pending
            await supabase.from('pending_permissions').delete().eq('id', invite.id);

            banner.classList.add('hidden');
            showToast(`Access granted to "${padTitle}"!`, 'success');
            await loadPads();
            await openPad(invite.pad_id);
        });

        document.getElementById('banner-decline-btn')?.addEventListener('click', async () => {
            banner.classList.add('hidden');
            // User can decline the invite
            await supabase.from('pending_permissions').delete().eq('id', invite.id);
            showToast('Invitation dismissed', 'info');
        });
    } catch (e) {
        // Table might not be accessible or column mismatch
        banner.classList.add('hidden');
    }
}

function showAuthView() {
    document.getElementById('auth-view')?.classList.remove('hidden');
    document.getElementById('workspace-view')?.classList.remove('active');
    document.getElementById('workspace-view')?.classList.add('hidden');
    currentPad = null;
}

function showWorkspaceView() {
    document.getElementById('auth-view')?.classList.add('hidden');
    const ws = document.getElementById('workspace-view');
    if (ws) {
        ws.classList.remove('hidden');
        ws.classList.add('active');
    }
}

async function openPad(padId) {
    // Save any pending changes in current pad before switching
    await saveCurrentPadIfDirty();

    const { data: pad, error } = await supabase
        .from('pads')
        .select('*')
        .eq('id', padId)
        .single();

    if (error || !pad) {
        showToast('Failed to load pad', 'error');
        console.error(error);
        return;
    }

    currentPad = pad;
    const profile = getCurrentProfile();
    currentPadCanEdit = await checkCanEdit(pad, profile);

    // Hide admin view / empty state, show editor and header
    document.getElementById('admin-panel-root')?.classList.add('hidden');
    document.getElementById('empty-state')?.classList.add('hidden');
    document.getElementById('content-header')?.classList.remove('hidden');
    document.getElementById('editor-root')?.classList.remove('hidden');

    // Update Header UI
    updateHeaderUI(pad, currentPadCanEdit, profile);

    // Render Editor based on sensitive mask or type
    if (pad.is_sensitive) {
        renderSensitiveMask(pad);
    } else {
        renderEditorByType(pad, currentPadCanEdit);
    }
}

async function checkCanEdit(pad, profile) {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    if (pad.owner_id === profile.id) return true;

    // Check pad_permissions table
    const { data: perm } = await supabase
        .from('pad_permissions')
        .select('permission')
        .eq('pad_id', pad.id)
        .eq('user_id', profile.id)
        .maybeSingle();

    return perm?.permission === 'edit';
}

function updateHeaderUI(pad, canEdit, profile) {
    const titleInput = document.getElementById('pad-title-input');
    const shareBtn = document.getElementById('share-btn');
    const deleteBtn = document.getElementById('delete-pad-btn');
    const sensitiveToggle = document.getElementById('sensitive-toggle');
    const sensitiveCheckbox = document.getElementById('sensitive-checkbox');
    const sensitiveLabel = document.getElementById('sensitive-label');

    if (titleInput) {
        titleInput.value = pad.title || 'Untitled';
        titleInput.readOnly = !canEdit;
    }

    const isOwnerOrAdmin = profile?.role === 'admin' || pad.owner_id === profile?.id;

    if (shareBtn) shareBtn.style.display = isOwnerOrAdmin ? 'inline-flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = isOwnerOrAdmin ? 'inline-flex' : 'none';

    if (sensitiveToggle && sensitiveCheckbox) {
        sensitiveToggle.style.display = isOwnerOrAdmin ? 'inline-block' : 'none';
        sensitiveCheckbox.checked = !!pad.is_sensitive;
    }

    if (sensitiveLabel) {
        sensitiveLabel.style.display = pad.is_sensitive ? 'inline' : 'none';
    }
}

function renderEditorByType(pad, canEdit) {
    switch (pad.type) {
        case 'note':
            renderNoteEditor(pad, canEdit);
            break;
        case 'code':
            renderCodeEditor(pad, canEdit);
            break;
        case 'checklist':
            renderChecklistEditor(pad, canEdit);
            break;
        case 'file':
            renderFilePad(pad, canEdit);
            break;
        default:
            console.error('Unknown pad type:', pad.type);
    }
}

function renderSensitiveMask(pad) {
    const root = document.getElementById('editor-root');
    if (!root) return;

    root.innerHTML = `
        <div class="sensitive-mask">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <h3>This Pad Contains Sensitive Information</h3>
            <p>Content is masked to prevent accidental viewing or recording.</p>
            <button class="btn btn-coral" id="reveal-sensitive-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                Reveal Content
            </button>
        </div>
    `;

    document.getElementById('reveal-sensitive-btn')?.addEventListener('click', () => {
        renderEditorByType(pad, currentPadCanEdit);
    });
}

function setupHeaderControls() {
    const titleInput = document.getElementById('pad-title-input');
    const shareBtn = document.getElementById('share-btn');
    const deleteBtn = document.getElementById('delete-pad-btn');
    const sensitiveCheckbox = document.getElementById('sensitive-checkbox');

    // Title auto-save
    titleInput?.addEventListener('input', (e) => {
        if (!currentPad || !currentPadCanEdit) return;
        const newTitle = e.target.value;
        currentPad.title = newTitle;
        updatePadInList(currentPad.id, { title: newTitle });

        const saveDot = document.getElementById('header-save-dot');
        if (saveDot) {
            saveDot.classList.add('dirty');
            saveDot.title = 'Unsaved changes';
        }

        clearTimeout(titleSaveTimer);
        titleSaveTimer = setTimeout(async () => {
            await supabase.from('pads').update({ title: newTitle }).eq('id', currentPad.id);
            if (saveDot) {
                saveDot.classList.remove('dirty');
                saveDot.title = 'All changes saved';
            }
        }, 1000);
    });

    // Share button
    shareBtn?.addEventListener('click', () => {
        if (currentPad) {
            openPermissionsModal(currentPad.id, currentPad.title);
        }
    });

    // Delete button
    deleteBtn?.addEventListener('click', async () => {
        if (!currentPad) return;
        if (!confirm(`Are you sure you want to delete "${currentPad.title}"?`)) return;

        const { error } = await supabase.from('pads').delete().eq('id', currentPad.id);
        if (error) {
            showToast('Failed to delete pad', 'error');
            console.error(error);
            return;
        }

        showToast('Pad deleted', 'info');
        removePadFromList(currentPad.id);
        resetToEmptyState();
    });

    // Sensitive toggle
    sensitiveCheckbox?.addEventListener('change', async (e) => {
        if (!currentPad) return;
        const isSensitive = e.target.checked;
        currentPad.is_sensitive = isSensitive;

        const label = document.getElementById('sensitive-label');
        if (label) label.style.display = isSensitive ? 'inline' : 'none';

        updatePadInList(currentPad.id, { is_sensitive: isSensitive });

        const { error } = await supabase
            .from('pads')
            .update({ is_sensitive: isSensitive })
            .eq('id', currentPad.id);

        if (error) {
            showToast('Failed to update sensitivity', 'error');
            console.error(error);
        }
    });
}

function resetToEmptyState() {
    currentPad = null;
    document.getElementById('content-header')?.classList.add('hidden');
    document.getElementById('editor-root')?.classList.add('hidden');
    document.getElementById('admin-panel-root')?.classList.add('hidden');
    document.getElementById('empty-state')?.classList.remove('hidden');
    setActivePad(null);
}

async function showAdminView() {
    await saveCurrentPadIfDirty();
    currentPad = null;
    setActivePad(null);

    document.getElementById('content-header')?.classList.add('hidden');
    document.getElementById('editor-root')?.classList.add('hidden');
    document.getElementById('empty-state')?.classList.add('hidden');
    document.getElementById('admin-panel-root')?.classList.remove('hidden');

    await renderAdminPanel();
}

async function saveCurrentPadIfDirty() {
    if (!currentPad || !currentPadCanEdit) return;
    switch (currentPad.type) {
        case 'note': await saveNoteIfDirty(); break;
        case 'code': await saveCodeIfDirty(); break;
        case 'checklist': await saveChecklistIfDirty(); break;
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+K -> focus search
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('search-input');
            searchInput?.focus();
            searchInput?.select();
        }

        // Ctrl+N -> trigger new pad (opens dropdown or creates default note)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            const newPadMenu = document.getElementById('new-pad-menu');
            newPadMenu?.classList.toggle('open');
        }

        // Escape -> close dropdowns / modals / mobile sidebar
        if (e.key === 'Escape') {
            document.getElementById('new-pad-menu')?.classList.remove('open');
            document.getElementById('permissions-modal')?.classList.remove('active');
            document.getElementById('sidebar')?.classList.remove('open');
            document.getElementById('sidebar-overlay')?.classList.remove('active');
        }
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
