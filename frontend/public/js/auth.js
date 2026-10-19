/**
 * auth.js - Login, first admin, user menu, password change.
 * Loaded first: it watches every API call and shows the login screen when
 * the session ends.
 */

const Auth = (function() {
    const OWNER_KEY = 'nutri_owner';          // "userId:orgId" whose data this browser holds
    const SAVED_PREFIX = 'nutri_saved_';     // browser data of other users, kept until they come back
    const DATA_PREFIX = 'mp_';               // State keys (state.js)

    let me = null;
    let screen = null;
    // Resolves once a session is confirmed: modules wait for it before calling the API
    let markReady;
    const ready = new Promise(resolve => { markReady = resolve; });
    const nativeFetch = window.fetch.bind(window);

    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ROLE_LABELS = { admin: 'Administrador/a', nutricionista: 'Nutricionista', recepcion: 'Recepción' };

    async function call(path, body) {
        const res = await nativeFetch(path, {
            method: body ? 'POST' : 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : {},
            body: body ? JSON.stringify(body) : undefined
        });
        const json = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, ...json };
    }

    // Session ended or temporary password: react to any API answer
    window.fetch = async (...args) => {
        const res = await nativeFetch(...args);
        const url = String(args[0]?.url || args[0]);
        const isApi = url.startsWith('/api/') || url.startsWith('/billing-api/');
        if (isApi && !url.startsWith('/api/auth/')) {
            if (res.status === 401) showLogin('Tu sesión terminó. Iniciá sesión de nuevo.');
            if (res.status === 403) {
                res.clone().json().then(b => b.code === 'PASSWORD_CHANGE_REQUIRED' && showPasswordForm(true)).catch(() => {});
            }
        }
        return res;
    };

    async function boot() {
        screen = document.getElementById('auth-screen');
        const status = await call('/api/auth/status');
        if (status.data?.authenticated) {
            const result = await call('/api/auth/me');
            if (result.ok) return start(result.data);
        }
        if (status.data?.setupRequired) showSetup(); else showLogin();
    }

    function start(data) {
        me = data;
        if (!adoptBrowserData()) return; // reloading with this user's data
        if (me.user.mustChangePassword) return showPasswordForm(true);
        document.body.dataset.role = me.role;
        document.body.classList.remove('auth-pending');
        screen.classList.remove('active');
        renderUserMenu();
        markReady(me);
    }

    /**
     * Browser data (until Fase 4) belongs to one user and consultorio. When
     * someone else logs in here, the previous data is set aside and theirs
     * restored. Returns false when the page reloads.
     */
    function adoptBrowserData() {
        const owner = `${me.user.id}:${me.organization.id}`;
        const previous = localStorage.getItem(OWNER_KEY);
        if (previous === owner) return true;
        if (!previous) { // data from before logins existed: it stays with the first user
            localStorage.setItem(OWNER_KEY, owner);
            return true;
        }
        const keys = Object.keys(localStorage).filter(k => k.startsWith(DATA_PREFIX));
        const current = Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]));
        localStorage.setItem(SAVED_PREFIX + previous, JSON.stringify(current));
        keys.forEach(k => localStorage.removeItem(k));
        const saved = localStorage.getItem(SAVED_PREFIX + owner);
        if (saved) {
            Object.entries(JSON.parse(saved)).forEach(([k, v]) => localStorage.setItem(k, v));
            localStorage.removeItem(SAVED_PREFIX + owner);
        }
        localStorage.setItem(OWNER_KEY, owner);
        location.reload();
        return false;
    }

    function showScreen(html, onSubmit) {
        document.body.classList.add('auth-pending');
        screen.innerHTML = `<form class="auth-card" novalidate><div class="auth-card__logo">N</div>${html}
            <div class="auth-card__error" role="alert"></div></form>`;
        screen.classList.add('active');
        const form = screen.querySelector('form');
        form.querySelector('input')?.focus();
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = form.querySelector('button[type=submit]');
            const error = form.querySelector('.auth-card__error');
            button.disabled = true;
            error.textContent = '';
            const values = Object.fromEntries(new FormData(form));
            const message = await onSubmit(values);
            if (message) {
                error.textContent = message;
                button.disabled = false;
            }
        });
    }

    const field = (name, label, type = 'text', extra = '') => `
        <div class="form-group">
            <label class="form-label" for="auth-${name}">${label}</label>
            <input class="form-input" id="auth-${name}" name="${name}" type="${type}" ${extra} required>
        </div>`;

    function showLogin(notice = '') {
        if (screen?.classList.contains('active')) return;
        showScreen(`
            <h2>Iniciar sesión</h2>
            <p>${esc(notice) || 'Ingresá con tu email y contraseña.'}</p>
            ${field('email', 'Email', 'email', 'autocomplete="username"')}
            ${field('password', 'Contraseña', 'password', 'autocomplete="current-password"')}
            <button class="btn btn--primary" type="submit">Entrar</button>
        `, async (values) => {
            const result = await call('/api/auth/login', values);
            if (!result.ok) return result.error || 'No se pudo iniciar sesión';
            location.reload();
        });
    }

    function showSetup() {
        showScreen(`
            <h2>Bienvenido/a a Nutri Aye</h2>
            <p>Creá el consultorio y la cuenta de administrador.</p>
            ${field('orgName', 'Nombre del consultorio')}
            ${field('name', 'Tu nombre', 'text', 'autocomplete="name"')}
            ${field('email', 'Email', 'email', 'autocomplete="username"')}
            ${field('password', 'Contraseña (mínimo 8 caracteres)', 'password', 'autocomplete="new-password" minlength="8"')}
            <button class="btn btn--primary" type="submit">Crear y entrar</button>
        `, async (values) => {
            const result = await call('/api/auth/setup', values);
            if (!result.ok) return result.error || 'No se pudo crear la cuenta';
            location.reload();
        });
    }

    // forced: temporary password, nothing else can be done until it changes
    function showPasswordForm(forced = false) {
        const html = `
            <h2>${forced ? 'Elegí tu contraseña' : 'Cambiar contraseña'}</h2>
            <p>${forced ? 'Tu contraseña es temporal. Elegí una nueva para continuar.' : 'Se cerrarán tus otras sesiones abiertas.'}</p>
            ${field('currentPassword', forced ? 'Contraseña temporal' : 'Contraseña actual', 'password', 'autocomplete="current-password"')}
            ${field('newPassword', 'Nueva contraseña (mínimo 8 caracteres)', 'password', 'autocomplete="new-password" minlength="8"')}
            <button class="btn btn--primary" type="submit">Guardar</button>
            ${forced ? '' : '<button class="btn btn--secondary" type="button" data-action="cancel" style="margin-top:8px">Cancelar</button>'}
        `;
        screen.classList.remove('active');
        showScreen(html, async (values) => {
            const result = await call('/api/auth/password', values);
            if (!result.ok) return result.error || 'No se pudo cambiar la contraseña';
            location.reload();
        });
        screen.querySelector('[data-action=cancel]')?.addEventListener('click', () => {
            screen.classList.remove('active');
            document.body.classList.remove('auth-pending');
        });
    }

    function renderUserMenu() {
        const menu = document.getElementById('user-menu');
        if (!menu) return;
        const initials = me.user.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
        const others = me.memberships.length > 1 ? `
            <label class="form-label" style="padding:0 8px">Consultorio</label>
            <select class="form-select" data-action="switch-org">
                ${me.memberships.map(m => `<option value="${esc(m.orgId)}" ${m.orgId === me.organization.id ? 'selected' : ''}>${esc(m.orgName)}</option>`).join('')}
            </select>` : '';

        menu.innerHTML = `
            <button class="btn btn--secondary btn--sm user-menu__button" type="button" data-action="toggle">
                <span class="user-menu__avatar">${esc(initials)}</span>
                <span class="btn__text">${esc(me.user.name)}</span>
            </button>
            <div class="user-menu__panel">
                <div class="user-menu__info">
                    <strong>${esc(me.user.name)}</strong>
                    <small>${esc(ROLE_LABELS[me.role])} · ${esc(me.organization.name)}</small>
                </div>
                ${others}
                ${me.role === 'admin' ? `<button class="user-menu__item" type="button" data-action="users">Usuarios del consultorio</button>
                    <button class="user-menu__item" type="button" data-action="backups">💾 Respaldos</button>` : ''}
                <button class="user-menu__item" type="button" data-action="password">Cambiar contraseña</button>
                <button class="user-menu__item" type="button" data-action="logout">Cerrar sesión</button>
            </div>`;

        menu.addEventListener('click', async (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'toggle') menu.classList.toggle('open');
            if (action === 'users') { menu.classList.remove('open'); UsersAdmin.open(me); }
            if (action === 'backups') { menu.classList.remove('open'); BackupAdmin.open(); }
            if (action === 'password') { menu.classList.remove('open'); showPasswordForm(false); }
            if (action === 'logout') logout();
        });
        menu.querySelector('[data-action=switch-org]')?.addEventListener('change', async (e) => {
            const result = await call('/api/auth/switch-org', { orgId: e.target.value });
            if (result.ok) location.reload();
        });
        document.addEventListener('click', (e) => { if (!menu.contains(e.target)) menu.classList.remove('open'); });
    }

    // Browser data stays (set aside if another user logs in next)
    async function logout() {
        await call('/api/auth/logout', {});
        location.reload();
    }

    document.addEventListener('DOMContentLoaded', boot);

    return { ready, current: () => me, ROLE_LABELS, esc };
})();
