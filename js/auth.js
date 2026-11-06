/**
 * Auth Module
 * Handles login (via Email OR Username), registration, logout, and auth UI toggling.
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

export function initAuth() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const logoutBtn = document.getElementById('logout-btn');
    const authError = document.getElementById('auth-error');

    function switchTab(mode) {
        hideError();
        if (mode === 'register') {
            tabRegister?.classList.add('active');
            tabLogin?.classList.remove('active');
            loginForm?.classList.add('hidden');
            registerForm?.classList.remove('hidden');
        } else {
            tabLogin?.classList.add('active');
            tabRegister?.classList.remove('active');
            registerForm?.classList.add('hidden');
            loginForm?.classList.remove('hidden');
        }
    }

    tabLogin?.addEventListener('click', () => switchTab('login'));
    tabRegister?.addEventListener('click', () => switchTab('register'));
    showRegisterLink?.addEventListener('click', (e) => { e.preventDefault(); switchTab('register'); });
    showLoginLink?.addEventListener('click', (e) => { e.preventDefault(); switchTab('login'); });

    // Login Form Submit (Supports either Email or Username)
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifierInput = document.getElementById('login-identifier') || document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const submitBtn = document.getElementById('login-submit');

        const rawIdentifier = identifierInput?.value.trim() || '';
        const password = passwordInput?.value || '';

        if (!rawIdentifier || !password) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in…';
        hideError();

        try {
            let emailToUse = rawIdentifier;

            // If the identifier doesn't have '@', treat it as a username
            if (!rawIdentifier.includes('@')) {
                // Try resolving username to email via RPC
                const { data: rpcEmail, error: rpcError } = await supabase.rpc('get_email_for_username', {
                    p_username: rawIdentifier
                });

                if (rpcEmail) {
                    emailToUse = rpcEmail;
                } else {
                    // Fallback: try direct query in case user profile email matches
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('email')
                        .eq('username', rawIdentifier)
                        .maybeSingle();

                    if (profile?.email) {
                        emailToUse = profile.email;
                    } else {
                        throw new Error(`No account found with username "${rawIdentifier}". Please enter your email address.`);
                    }
                }
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: emailToUse,
                password
            });

            if (error) throw error;
            showToast('Welcome back!', 'success');
        } catch (err) {
            showError(err.message || 'Login failed. Please check your credentials.');
            showToast('Sign in failed', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    });

    // Register Form Submit
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const submitBtn = document.getElementById('register-submit');

        if (!username || !email || !password) return;

        // Validate username: 3-30 chars, alphanumeric + underscore
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            showError('Username must be 3-30 characters: letters, numbers, and underscores only.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account…';
        hideError();

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { username, display_name: username }
                }
            });

            if (error) throw error;

            // If an active session is returned, user is already logged in
            if (data?.session) {
                showToast(`Welcome to Scratchpad, ${username}!`, 'success');
                // supabase.auth.onAuthStateChange in app.js will transition to the workspace
            } else if (data?.user && !data.user.email_confirmed_at) {
                // If Supabase project requires email confirmation
                showToast('Account created! Please verify your email to log in.', 'info');
                switchTab('login');
                const idInput = document.getElementById('login-identifier') || document.getElementById('login-email');
                if (idInput) idInput.value = email;
            } else {
                showToast('Account created! Signing you in…', 'success');
            }
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
        showToast('Signed out', 'info');
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
 * Display invitation banner on the auth card when user opens an invite verification link.
 */
export function showInviteOnAuthCard(inviteInfo) {
    const banner = document.getElementById('auth-invite-banner');
    if (!banner || !inviteInfo) return;

    banner.innerHTML = `
        <div>📩 <strong>Invitation for ${escapeHtml(inviteInfo.email || 'you')}</strong></div>
        <div>You've been invited to collaborate on <strong>"${escapeHtml(inviteInfo.padTitle || 'a pad')}"</strong> with <strong>${escapeHtml(inviteInfo.permission || 'view').toUpperCase()}</strong> access. Sign in or create an account to verify and accept!</div>
    `;
    banner.classList.remove('hidden');

    // Pre-fill email inputs
    const loginIdentifier = document.getElementById('login-identifier') || document.getElementById('login-email');
    const registerEmail = document.getElementById('register-email');
    if (inviteInfo.email) {
        if (loginIdentifier && !loginIdentifier.value) loginIdentifier.value = inviteInfo.email;
        if (registerEmail && !registerEmail.value) registerEmail.value = inviteInfo.email;
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

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
