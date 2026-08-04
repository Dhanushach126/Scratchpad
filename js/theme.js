/**
 * Theme Toggle Module
 * Dark/light theme with system preference detection and localStorage persistence.
 */

const STORAGE_KEY = 'scratchpad-theme';

export function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    applyTheme(theme);

    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleTheme);
    }

    // Listen for system changes
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        if (!localStorage.getItem(STORAGE_KEY)) {
            applyTheme(e.matches ? 'light' : 'dark');
        }
    });
}

export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';

    // Add transition class for smooth switch
    document.body.classList.add('theme-transitioning');
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);

    setTimeout(() => {
        document.body.classList.remove('theme-transitioning');
    }, 400);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
    updateMetaThemeColor(theme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;

    if (theme === 'light') {
        icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" x2="12" y1="1" y2="3"/><line x1="12" x2="12" y1="21" y2="23"/><line x1="4.22" x2="5.64" y1="4.22" y2="5.64"/><line x1="18.36" x2="19.78" y1="18.36" y2="19.78"/><line x1="1" x2="3" y1="12" y2="12"/><line x1="21" x2="23" y1="12" y2="12"/><line x1="4.22" x2="5.64" y1="19.78" y2="18.36"/><line x1="18.36" x2="19.78" y1="5.64" y2="4.22"/>';
    } else {
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
}

function updateMetaThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', theme === 'dark' ? '#0a0a1a' : '#f8fafc');
    }
}
