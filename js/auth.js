/**
 * Auth Module
 * Handles login, registration, logout, and auth UI toggling.
 */
import { supabase } from './supabase.js';
import { showToast } from './toast.js';

let currentProfile = null;

export function getCurrentProfile() {
    return currentProfile;
}

export function setCurrentProfile(profile) {
    currentProfile = profile;
}

export function initAuth(onAuthSuccess) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');
    const authError = document.getElementById('auth-error');

    // Toggle forms
    showRegisterLink?.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        hideError();
    });

    showLoginLink?.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        hideError();
    });

    // Login
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('login-submit');

        if (!email || !password) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in…';
        hideError();

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // Auth state change listener in app.js handles the rest
        } catch (err) {
            showError(err.message || 'Login failed. Please try again.');
            showToast('Login failed', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    });

    // Register
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const submitBtn = document.getElementById('register-submit');

        if (!username || !email || !password) return;

        // Validate username
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            showError('Username must be 3-30 characters: letters, numbers, underscores only.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account…';
        hideError();

        try {
            // Check if username is taken
            const { data: existing } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', username)
                .maybeSingle();

            if (existing) {
                throw new Error('Username is already taken.');
            }

            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { username, display_name: username }
                }
            });

            if (error) throw error;
            showToast('Account created! You can now sign in.', 'success');

            // Switch to login form
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        } catch (err) {
            showError(err.message || 'Registration failed.');
            showToast('Registration failed', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
        }
    });

    // Logout
    logoutBtn?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        currentProfile = null;
        showToast('Logged out', 'info');
    });

    function showError(message) {
        if (authError) {
            authError.textContent = message;
            authError.classList.add('visible');
        }
    }

    function hideError() {
        if (authError) {
            authError.textContent = '';
            authError.classList.remove('visible');
        }
    }
}

/**
 * Fetch the current user's profile from the database.
 */
export async function fetchProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Failed to fetch profile:', error);
        return null;
    }

    currentProfile = data;
    return data;
}

/**
 * Update sidebar user info display.
 */
export function updateUserDisplay(profile) {
    if (!profile) return;

    const avatar = document.getElementById('user-avatar');
    const displayName = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-role');
    const adminBtn = document.getElementById('admin-panel-btn');

    if (avatar) {
        avatar.textContent = (profile.username || profile.display_name || 'U').charAt(0).toUpperCase();
    }
    if (displayName) {
        displayName.textContent = profile.display_name || profile.username;
    }
    if (roleEl) {
        roleEl.textContent = profile.role;
        if (profile.role === 'admin') {
            roleEl.innerHTML = `<span class="badge badge-admin">${profile.role}</span>`;
        }
    }
    if (adminBtn) {
        adminBtn.style.display = profile.role === 'admin' ? 'flex' : 'none';
    }
}
