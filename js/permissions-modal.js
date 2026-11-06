/**
 * Permissions Modal Module
 * Share dialog for granting/revoking per-pad view/edit access by Email Address or Username,
 * supporting email verification links and pending invitations.
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
    const copyLinkBtn = document.getElementById('perm-copy-link-btn');

    // Close modal
    closeBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Grant permission / Send invite
    grantBtn?.addEventListener('click', grantPermission);

    // Copy generated invite link button
    copyLinkBtn?.addEventListener('click', () => {
        const input = document.getElementById('perm-invite-link-input');
        if (input && input.value) {
            navigator.clipboard.writeText(input.value).then(() => {
                showToast('Verification link copied to clipboard!', 'success');
            }).catch(() => {
                input.select();
                document.execCommand('copy');
                showToast('Verification link copied!', 'success');
            });
        }
    });

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
    const inviteResult = document.getElementById('perm-invite-result');
    if (inviteResult) inviteResult.classList.add('hidden');
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

export async function loadPermissions() {
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

    // Fetch pending invitations
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
        container.innerHTML = '<p style="color:var(--color-text-tertiary); font-size:var(--font-size-xs); padding: 8px 0;">No collaborators added yet. Add an email above to send an invite.</p>';
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
            const token = perm.token || `inv_${perm.id}_${Date.now()}`;
            const inviteUrl = buildInviteUrl(token, currentPadId, email, perm.permission, currentPadTitle);

            return `
                <div class="perm-user-row" style="background: rgba(245, 158, 11, 0.05); border-radius: var(--radius-sm); padding: 6px 8px; margin-bottom: 4px;">
                    <div class="avatar avatar-sm" style="background:var(--color-amber-subtle); color:var(--color-amber);">${initial}</div>
                    <div class="perm-user-info">
                        <div class="perm-user-name">${escapeHtml(email)}</div>
                        <div style="font-size:11px; color:var(--color-amber); display:flex; align-items:center; gap:4px;">
                            <span>Awaiting Email Verification</span>
                            · <a href="#" data-copy-url="${escapeAttr(inviteUrl)}" style="color:var(--color-accent); text-decoration:underline;">Copy link</a>
                        </div>
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

    // Bind inline copy link buttons
    container.querySelectorAll('[data-copy-url]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const url = btn.dataset.copyUrl;
            if (url) {
                navigator.clipboard.writeText(url).then(() => {
                    showToast('Invite link copied!', 'success');
                });
            }
        });
    });
}

export function buildInviteUrl(token, padId, email, permission, padTitle) {
    const origin = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
        invite: token || `inv_${Date.now()}`,
        pad: String(padId),
        email: email || '',
        perm: permission || 'view',
        title: padTitle || 'Document'
    });
    return `${origin}?${params.toString()}`;
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

    // Generate unique verification token
    const token = `inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    // Look up user by email OR username (case-insensitive)
    const { data: targetUser } = await supabase
        .from('profiles')
        .select('id, username, email')
        .or(`email.ilike.${searchValue},username.ilike.${searchValue}`)
        .maybeSingle();

    const targetEmail = targetUser?.email || (isValidEmail(searchValue) ? searchValue : null);

    if (!targetEmail) {
        showToast(`Could not find user or valid email for "${searchValue}"`, 'error');
        return;
    }

    // Save into pending_permissions table
    const pendingData = {
        pad_id: currentPadId,
        email: targetEmail.toLowerCase(),
        permission,
        granted_by: profile?.id
    };

    // Try upserting with token; if column doesn't exist in Supabase yet, fallback without token
    let insertError = null;
    try {
        const res = await supabase
            .from('pending_permissions')
            .upsert({ ...pendingData, token }, { onConflict: 'pad_id,email' });
        insertError = res.error;
    } catch (e) {
        insertError = e;
    }

    if (insertError) {
        // Fallback without token field
        const res = await supabase
            .from('pending_permissions')
            .upsert(pendingData, { onConflict: 'pad_id,email' });
        if (res.error) {
            showToast('Failed to save invitation', 'error');
            console.error(res.error);
            return;
        }
    }

    // Construct the verification URL
    const verifyUrl = buildInviteUrl(token, currentPadId, targetEmail, permission, currentPadTitle);

    // Show verification link in preview box
    const resultBox = document.getElementById('perm-invite-result');
    const linkInput = document.getElementById('perm-invite-link-input');
    if (resultBox && linkInput) {
        linkInput.value = verifyUrl;
        resultBox.classList.remove('hidden');
    }

    showToast(`Verification invite created for ${targetEmail}!`, 'success');

    // Send email notification with verify link if checkbox checked
    if (notifyCheckbox?.checked) {
        sendInviteEmail(targetEmail, targetUser?.username || '', permission, currentPadTitle, verifyUrl);
    }

    inputField.value = '';
    await loadPermissions();
}

function sendInviteEmail(recipientEmail, recipientUsername, permission, padTitle, verifyUrl) {
    const profile = getCurrentProfile();
    const sender = profile?.display_name || profile?.username || 'A team member';
    const accessType = permission === 'edit' ? 'Editor (Read & Write)' : 'Viewer (Read Only)';

    const subject = `Action Required: Verify Access to "${padTitle}" on Scratchpad`;
    let body = `Hi ${recipientUsername || 'there'},\n\n`;
    body += `${sender} has invited you to collaborate on the pad "${padTitle}" with ${accessType} permissions.\n\n`;
    body += `👉 CLICK THE LINK BELOW TO VERIFY AND ACCESS THE DOCUMENT:\n`;
    body += `${verifyUrl}\n\n`;
    body += `(If you already have a Scratchpad account, sign in to accept. If you are new, create your free account and your access will be automatically linked!)\n\n`;
    body += `Best regards,\nScratchpad Workspace`;

    // Open Gmail compose with pre-filled message
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

function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
