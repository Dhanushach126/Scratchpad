/**
 * Sidebar Module
 * Handles pad list rendering, search, sorting, new pad creation, and navigation.
 */
import { supabase } from './supabase.js';
import { showToast } from './toast.js';
import { getCurrentProfile } from './auth.js';

let pads = [];
let activePadId = null;
let onPadSelect = null;
let onPadCreate = null;
let searchQuery = '';

const TYPE_ICONS = {
    note: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>',
    code: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    checklist: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    file: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>'
};

export function initSidebar({ onSelect, onCreate }) {
    onPadSelect = onSelect;
    onPadCreate = onCreate;

    // Search
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderPadList();
    });

    // New pad dropdown
    const newPadBtn = document.getElementById('new-pad-btn');
    const newPadMenu = document.getElementById('new-pad-menu');

    newPadBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        newPadMenu?.classList.toggle('open');
    });

    // Close dropdown on outside click
    document.addEventListener('click', () => {
        newPadMenu?.classList.remove('open');
    });

    // New pad type selection
    newPadMenu?.querySelectorAll('.dropdown-item').forEach((item) => {
        item.addEventListener('click', async () => {
            const type = item.dataset.type;
            newPadMenu.classList.remove('open');
            await createPad(type);
        });
    });

    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    mobileMenuBtn?.addEventListener('click', () => {
        sidebar?.classList.toggle('open');
        overlay?.classList.toggle('active');
    });

    overlay?.addEventListener('click', () => {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('active');
    });
}

export async function loadPads() {
    const { data, error } = await supabase
        .from('pads')
        .select('id, title, type, is_sensitive, owner_id, updated_at')
        .order('updated_at', { ascending: false });

    if (error) {
        showToast('Failed to load pads', 'error');
        console.error(error);
        return;
    }

    pads = data || [];
    renderPadList();
}

async function createPad(type) {
    const profile = getCurrentProfile();
    if (!profile) return;

    const defaultContent = getDefaultContent(type);

    const { data, error } = await supabase
        .from('pads')
        .insert({
            title: 'Untitled',
            type,
            content: defaultContent,
            owner_id: profile.id
        })
        .select()
        .single();

    if (error) {
        showToast('Failed to create pad', 'error');
        console.error(error);
        return;
    }

    showToast(`New ${type} pad created`, 'success');
    pads.unshift(data);
    renderPadList();
    setActivePad(data.id);
    onPadCreate?.(data);
}

function getDefaultContent(type) {
    switch (type) {
        case 'note': return { text: '' };
        case 'code': return { code: '', language: 'javascript' };
        case 'checklist': return { items: [] };
        case 'file': return { files: [] };
        default: return {};
    }
}

export function setActivePad(padId) {
    activePadId = padId;
    renderPadList();

    // Close mobile sidebar
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
}

export function updatePadInList(padId, updates) {
    const idx = pads.findIndex((p) => p.id === padId);
    if (idx !== -1) {
        pads[idx] = { ...pads[idx], ...updates };
        renderPadList();
    }
}

export function removePadFromList(padId) {
    pads = pads.filter((p) => p.id !== padId);
    if (activePadId === padId) {
        activePadId = null;
    }
    renderPadList();
}

function renderPadList() {
    const container = document.getElementById('pad-list');
    if (!container) return;

    let filtered = pads;
    if (searchQuery) {
        filtered = pads.filter((p) =>
            p.title.toLowerCase().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="placeholder-block">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <p>${searchQuery ? 'No pads match your search' : 'No pads yet. Create one!'}</p>
            </div>
        `;
        return;
    }

    const profile = getCurrentProfile();

    container.innerHTML = filtered.map((pad) => {
        const isActive = pad.id === activePadId;
        const isOwner = pad.owner_id === profile?.id;
        const timeAgo = formatTimeAgo(pad.updated_at);

        return `
            <div class="pad-item ${isActive ? 'active' : ''}" data-pad-id="${pad.id}">
                <div class="pad-item-icon type-${pad.type}">
                    ${TYPE_ICONS[pad.type] || ''}
                </div>
                <div class="pad-item-info">
                    <div class="pad-item-title">${escapeHtml(pad.title)}</div>
                    <div class="pad-item-meta">
                        <span>${timeAgo}</span>
                        ${!isOwner ? '<span class="badge badge-view" style="font-size:9px;">shared</span>' : ''}
                    </div>
                </div>
                <div class="pad-item-badges">
                    ${pad.is_sensitive ? '<span class="pad-sensitive-icon">🔒</span>' : ''}
                </div>
            </div>
        `;
    }).join('');

    // Attach click handlers
    container.querySelectorAll('.pad-item').forEach((el) => {
        el.addEventListener('click', () => {
            const padId = parseInt(el.dataset.padId, 10);
            setActivePad(padId);
            onPadSelect?.(padId);
        });
    });
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
