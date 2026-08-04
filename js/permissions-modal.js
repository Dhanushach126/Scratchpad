/**
 * Permissions Modal Module
 * Share dialog for granting/revoking per-pad view/edit access by Email Address or Username,
 * supporting both registered users and pending email invitations with automatic Gmail dispatch.
 */
import { supabase } from './supabase.js';
import { showToast } from './toast.js';
import { getCurrentProfile } from './auth.js';

let currentPadId = null;
let currentPadTitle = 'Document';

export function initPermissionsModal() {
    const modal = document.getElementById('permissions-modal');
    const closeBtn = document.getElementById('permissions-modal-close');
    const grantBtn = document.getElementById('perm-grant-btn');

    // Close modal
    closeBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Grant permission
    grantBtn?.addEventListener('click', grantPermission);

    // Enter key on input
    const usernameInput = document.getElementById('perm-username-input');
    usernameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            grantPermission();
        }
    });
}

export async function openPermissionsModal(padId, padTitle) {
    currentPadId = padId;
    currentPadTitle = padTitle || 'Untitled Document';
    const modal = document.getElementById('permissions-modal');
    if (!modal) return;

    modal.classList.add('active');
    const input = document.getElementById('perm-username-input');
    if (input) {
        input.value = '';
        input.placeholder = 'Enter email address or username…';
    }

    await loadPermissions();
}

function closeModal() {
    const modal = document.getElementById('permissions-modal');
    modal?.classList.remove('active');
    currentPadId = null;
}

async function loadPermissions() {
    if (!currentPadId) return;

    const container = document.getElementById('perm-user-list');
    if (!container) return;

    container.innerHTML = '<div class="spinner" style="margin: var(--space-4) auto;"></div>';

    // Fetch active permissions
    const { data: activePerms, error: activeError } = await supabase
        .from('pad_permissions')
        .select(`
            id,
            permission,
            user_id,
            profiles!pad_permissions_user_id_fkey (username, email, display_name, role)
        `)
        .eq('pad_id', currentPadId);

    // Fetch pending email invitations
    const { data: pendingPerms } = await supabase
        .from('pending_permissions')
        .select('*')
        .eq('pad_id', currentPadId);

    if (activeError) {
        container.innerHTML = '<p style="color:var(--color-text-tertiary);">Failed to load permissions.</p>';
        console.error(activeError);
        return;
    }

    const hasActive = activePerms && activePerms.length > 0;
    const hasPending = pendingPerms && pendingPerms.length > 0;

    if (!hasActive && !hasPending) {
        container.innerHTML = '<p style="color:var(--color-text-tertiary); font-size:var(--font-size-xs);">No one else has access to this pad.</p>';
        return;
    }

    let html = '';

    // Render active permissions
    if (hasActive) {
        html += activePerms.map((perm) => {
            const profile = perm.profiles;
            const username = profile?.username || 'Unknown';
            const email = profile?.email || '';
            const initial = username.charAt(0).toUpperCase();
            const badgeClass = perm.permission === 'edit' ? 'badge-edit' : 'badge-view';
            const badgeLabel = perm.permission === 'edit' ? 'Editor' : 'Viewer';

            return `
                <div class="perm-user-row">
                    <div class="avatar avatar-sm">${initial}</div>
                    <div class="perm-user-info">
                        <div class="perm-user-name">${escapeHtml(username)}</div>
                        ${email ? `<div style="font-size:11px; color:var(--color-text-tertiary);">${escapeHtml(email)}</div>` : ''}
                    </div>
                    <span class="badge ${badgeClass}">${badgeLabel}</span>
                    <button class="btn-icon" data-perm-id="${perm.id}" data-type="active" data-revoke title="Revoke access">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
            `;
        }).join('');
    }

    // Render pending invitations
    if (hasPending) {
        html += pendingPerms.map((perm) => {
            const email = perm.email;
            const initial = email.charAt(0).toUpperCase();
            const badgeClass = perm.permission === 'edit' ? 'badge-edit' : 'badge-view';
            const badgeLabel = perm.permission === 'edit' ? 'Editor (Pending)' : 'Viewer (Pending)';

            return `
                <div class="perm-user-row" style="opacity: 0.85;">
                    <div class="avatar avatar-sm" style="background:var(--color-amber-subtle); color:var(--color-amber);">${initial}</div>
                    <div class="perm-user-info">
                        <div class="perm-user-name">${escapeHtml(email)}</div>
                        <div style="font-size:11px; color:var(--color-amber);">Pending Sign Up</div>
                    </div>
                    <span class="badge ${badgeClass}">${badgeLabel}</span>
                    <button class="btn-icon" data-perm-id="${perm.id}" data-type="pending" data-revoke title="Cancel invitation">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
            `;
        }).join('');
    }

    container.innerHTML = html;

    // Bind revoke buttons
    container.querySelectorAll('[data-revoke]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const permId = parseInt(btn.dataset.permId, 10);
            const isPending = btn.dataset.type === 'pending';
            await revokePermission(permId, isPending);
        });
    });
}

async function grantPermission() {
    const inputField = document.getElementById('perm-username-input');
    const levelSelect = document.getElementById('perm-level-select');
    const notifyCheckbox = document.getElementById('perm-notify-email');
    const searchValue = inputField?.value.trim().toLowerCase();
    const permission = levelSelect?.value || 'view';

    if (!searchValue || !currentPadId) {
        showToast('Enter an email address or username', 'warning');
        return;
    }

    const profile = getCurrentProfile();

    // Prevent self-share
    if (searchValue === profile?.username?.toLowerCase() || searchValue === profile?.email?.toLowerCase()) {
        showToast("You can't share with yourself", 'warning');
        return;
    }

    // Look up user by email OR username (case-insensitive)
    const { data: targetUser } = await supabase
        .from('profiles')
        .select('id, username, email')
        .or(`email.ilike.${searchValue},username.ilike.${searchValue}`)
        .maybeSingle();

    if (targetUser) {
        // User is already registered on Scratchpad
        const { error } = await supabase
            .from('pad_permissions')
            .upsert(
                {
                    pad_id: currentPadId,
                    user_id: targetUser.id,
                    permission,
                    granted_by: profile?.id
                },
                { onConflict: 'pad_id,user_id' }
            );

        if (error) {
            showToast('Failed to grant access', 'error');
            console.error(error);
            return;
        }

        showToast(`${permission.toUpperCase()} access granted to ${targetUser.email || targetUser.username}`, 'success');

        if (notifyCheckbox?.checked && targetUser.email) {
            sendGmailNotification(targetUser.email, targetUser.username, permission, currentPadTitle, true);
        }
    } else {
        // User not registered yet — check if valid email format
        if (isValidEmail(searchValue)) {
            // Save into pending_permissions table
            const { error } = await supabase
                .from('pending_permissions')
                .upsert(
                    {
                        pad_id: currentPadId,
                        email: searchValue,
                        permission,
                        granted_by: profile?.id
                    },
                    { onConflict: 'pad_id,email' }
                );

            if (error) {
                showToast('Failed to save invitation', 'error');
                console.error(error);
                return;
            }

            showToast(`Invitation & ${permission.toUpperCase()} access created for ${searchValue}`, 'success');

            if (notifyCheckbox?.checked) {
                sendGmailNotification(searchValue, '', permission, currentPadTitle, false);
            }
        } else {
            showToast(`User or email "${searchValue}" not found`, 'error');
            return;
        }
    }

    inputField.value = '';
    await loadPermissions();
}

function sendGmailNotification(recipientEmail, recipientUsername, permission, padTitle, isRegistered) {
    const profile = getCurrentProfile();
    const sender = profile?.display_name || profile?.username || 'A team member';
    const accessType = permission === 'edit' ? 'Editor (Read & Write)' : 'Viewer (Read Only)';
    const appUrl = window.location.origin;

    const subject = `Access Granted: "${padTitle}" on Scratchpad`;
    let body = `Hi ${recipientUsername || 'there'},\n\n${sender} has granted you ${accessType} access to the pad "${padTitle}".\n\n`;

    if (isRegistered) {
        body += `You can view the document in your Scratchpad workspace here:\n${appUrl}\n\n`;
    } else {
        body += `Please create your free account on Scratchpad to view and access this document:\n${appUrl}\n\n(Once you sign up with ${recipientEmail}, your access will be automatically linked!)\n\n`;
    }

    body += `Best regards,\nScratchpad Workspace`;

    // Open Gmail Compose URL
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
}

async function revokePermission(permId, isPending) {
    const table = isPending ? 'pending_permissions' : 'pad_permissions';
    const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', permId);

    if (error) {
        showToast('Failed to revoke access', 'error');
        console.error(error);
        return;
    }

    showToast('Access revoked', 'success');
    await loadPermissions();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
