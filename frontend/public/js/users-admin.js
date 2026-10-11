/**
 * users-admin.js - Consultorio users (admin only). Users are never deleted:
 * they are deactivated and can be reactivated.
 */

const UsersAdmin = (function() {
    let me = null;
    const esc = (v) => Auth.esc(v);
    const roleOptions = (selected) => Object.entries(Auth.ROLE_LABELS)
        .map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');

    async function request(method, path, body) {
        const res = await fetch(path, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : {},
            body: body ? JSON.stringify(body) : undefined
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
        return json.data;
    }

    async function open(current) {
        me = current;
        UI.openModal({
            title: 'Usuarios del consultorio',
            content: '<div id="users-admin"><p class="text-muted">Cargando...</p></div>',
            size: 'large',
            hideFooter: true,
            onOpen: bind
        });
        await refresh();
    }

    async function refresh() {
        const container = document.getElementById('users-admin');
        if (!container) return;
        try {
            const users = await request('GET', '/api/users');
            container.innerHTML = `
                <form class="form-row" data-form="new-user" style="align-items:flex-end; gap:8px; margin-bottom:16px">
                    <div class="form-group"><label class="form-label">Nombre</label><input class="form-input" name="name" required></div>
                    <div class="form-group"><label class="form-label">Email</label><input class="form-input" name="email" type="email" required></div>
                    <div class="form-group"><label class="form-label">Rol</label><select class="form-select" name="role">${roleOptions('nutricionista')}</select></div>
                    <button class="btn btn--primary" type="submit">Agregar</button>
                </form>
                <table class="users-table">
                    <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Último ingreso</th><th></th></tr></thead>
                    <tbody>${users.map(row).join('')}</tbody>
                </table>`;
        } catch (error) {
            container.innerHTML = `<p class="text-muted">${esc(error.message)}</p>`;
        }
    }

    function row(user) {
        const self = user.id === me.user.id;
        const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('es-PY') : 'Nunca';
        return `
            <tr class="${user.active ? '' : 'inactive'}" data-id="${esc(user.id)}">
                <td>${esc(user.name)}${self ? ' (vos)' : ''}${user.active ? '' : ' — desactivado'}</td>
                <td>${esc(user.email)}</td>
                <td>${user.active && !self
                    ? `<select class="form-select" data-action="role">${roleOptions(user.role)}</select>`
                    : esc(Auth.ROLE_LABELS[user.role])}</td>
                <td>${esc(lastLogin)}</td>
                <td class="actions">${self ? '' : user.active
                    ? `<button class="btn btn--secondary btn--sm" data-action="reset">Nueva contraseña</button>
                       <button class="btn btn--danger btn--sm" data-action="deactivate">Desactivar</button>`
                    : '<button class="btn btn--secondary btn--sm" data-action="reactivate">Reactivar</button>'}</td>
            </tr>`;
    }

    function showTemporaryPassword(name, password) {
        UI.openModal({
            title: 'Contraseña temporal',
            content: `<p>Pasale esta contraseña a <strong>${esc(name)}</strong>. Se muestra una sola vez y tendrá que cambiarla al entrar.</p>
                      <div class="temp-password">${esc(password)}</div>`,
            confirmText: 'Listo',
            onConfirm: () => { setTimeout(() => open(me)); return true; }
        });
    }

    function bind() {
        const container = document.getElementById('users-admin');
        container?.addEventListener('submit', async (e) => {
            if (!e.target.matches('[data-form=new-user]')) return;
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.target));
            try {
                const user = await request('POST', '/api/users', values);
                if (user.temporaryPassword) showTemporaryPassword(user.name, user.temporaryPassword);
                else { UI.toastSuccess(`${user.name} ya tenía cuenta: se agregó al consultorio`); refresh(); }
            } catch (error) { UI.toastError(error.message); }
        });

        container?.addEventListener('change', async (e) => {
            if (!e.target.matches('[data-action=role]')) return;
            const id = e.target.closest('tr').dataset.id;
            try { await request('PUT', `/api/users/${id}`, { role: e.target.value }); UI.toastSuccess('Rol actualizado'); } catch (error) { UI.toastError(error.message); }
            refresh();
        });

        container?.addEventListener('click', async (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            const tr = e.target.closest('tr');
            if (!tr || !['reset', 'deactivate', 'reactivate'].includes(action)) return;
            const id = tr.dataset.id;
            const name = tr.cells[0].textContent.replace(' — desactivado', '');
            try {
                if (action === 'reset') {
                    const { temporaryPassword } = await request('POST', `/api/users/${id}/reset-password`);
                    showTemporaryPassword(name, temporaryPassword);
                    return;
                }
                await request('POST', `/api/users/${id}/${action}`);
                UI.toastSuccess(action === 'deactivate' ? 'Usuario desactivado' : 'Usuario reactivado');
            } catch (error) { UI.toastError(error.message); }
            refresh();
        });
    }

    return { open };
})();
