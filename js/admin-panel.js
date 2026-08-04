/**
 * Admin Panel Module
 * User management for global admins — list users, promote/demote, delete.
 */
import { supabase } from './supabase.js';
import { showToast } from './toast.js';
import { getCurrentProfile } from './auth.js';

export async function renderAdminPanel() {
    const root = document.getElementById('admin-panel-root');
    if (!root) return;

    const profile = getCurrentProfile();
    if (!profile || profile.role !== 'admin') {
        root.innerHTML = '<p style="color:var(--color-danger);">Access denied.</p>';
        return;
    }

    root.innerHTML = '<div class="spinner spinner-lg" style="margin: var(--space-8) auto;"></div>';

    const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        root.innerHTML = '<p style="color:var(--color-danger);">Failed to load users.</p>';
        console.error(error);
        return;
    }

    root.innerHTML = `
        <div class="admin-panel">
            <h2 style="font-size: var(--font-size-xl); font-weight: 600; margin-bottom: var(--space-4);">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: var(--space-2);"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                User Management
            </h2>
            <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-6);">
                ${users.length} registered user${users.length !== 1 ? 's' : ''}
            </p>
            <div class="admin-user-list" id="admin-user-list">
                ${users.map((user) => renderUserRow(user, profile)).join('')}
            </div>
        </div>
    `;

    bindAdminEvents(root, profile);
}

function renderUserRow(user, currentUser) {
    const initial = (user.username || 'U').charAt(0).toUpperCase();
    const isCurrentUser = user.id === currentUser.id;
    const roleClass = user.role === 'admin' ? 'badge-admin' : 'badge-view';

    return `
        <div class="admin-user-row" data-user-id="${user.id}">
            <div class="avatar">${initial}</div>
            <div class="admin-user-info">
                <div class="admin-user-name">
                    ${escapeHtml(user.username || user.display_name)}
                    ${isCurrentUser ? '<span style="color:var(--color-text-tertiary); font-size:var(--font-size-xs);">(you)</span>' : ''}
                </div>
                <div class="admin-user-email" style="font-size:var(--font-size-xs); color:var(--color-text-tertiary);">
                    Joined ${new Date(user.created_at).toLocaleDateString()}
                </div>
            </div>
            <span class="badge ${roleClass}">${user.role}</span>
            <div class="admin-user-actions">
                ${!isCurrentUser ? `
                    <button class="btn btn-ghost btn-sm admin-toggle-role" data-user-id="${user.id}" data-current-role="${user.role}">
                        ${user.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                    <button class="btn btn-danger btn-sm admin-delete-user" data-user-id="${user.id}" data-username="${escapeAttr(user.username)}">
                        Delete
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function bindAdminEvents(root, currentProfile) {
    // Toggle role
    root.querySelectorAll('.admin-toggle-role').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            const currentRole = btn.dataset.currentRole;
            const newRole = currentRole === 'admin' ? 'user' : 'admin';

            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) {
                showToast('Failed to update role', 'error');
                console.error(error);
                return;
            }

            showToast(`User ${newRole === 'admin' ? 'promoted to admin' : 'demoted to user'}`, 'success');
            await renderAdminPanel();
        });
    });

    // Delete user
    root.querySelectorAll('.admin-delete-user').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            const username = btn.dataset.username;

            if (!confirm(`Delete user "${username}"? This will remove all their pads and permissions.`)) {
                return;
            }

            // Delete profile (cascade will handle pads & permissions)
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) {
                showToast('Failed to delete user', 'error');
                console.error(error);
                return;
            }

            showToast(`User "${username}" deleted`, 'success');
            await renderAdminPanel();
        });
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
