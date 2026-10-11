/**
 * ui-toast.js - Toast notifications (messages are always set as text)
 */

const Toast = (function() {
    let toastContainer;

    function init() {
        toastContainer = document.getElementById('toast-container');
        toastContainer.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.toast__close');
            if (closeBtn) removeToast(closeBtn.closest('.toast'));
        });
    }

    function showToast(options = {}) {
        const { type = 'info', title, message, duration = 4000 } = options;
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        // Messages can contain user data (names, server errors): set as text, never as HTML
        toast.innerHTML = `
            <span class="toast__icon">${getToastIcon(type)}</span>
            <div class="toast__content">
                ${title ? '<div class="toast__title"></div>' : ''}
                <div class="toast__message"></div>
            </div>
            <button class="toast__close">×</button>
        `;
        if (title) toast.querySelector('.toast__title').textContent = title;
        toast.querySelector('.toast__message').textContent = message || '';

        toastContainer.appendChild(toast);

        // Auto remove after duration (0 = persistent)
        if (duration !== 0) {
            setTimeout(() => removeToast(toast), duration);
        }

        return toast;
    }

    /**
     * Remove toast with animation (called directly or via delegation)
     */
    function removeToast(toast) {
        if (!toast || !toast.parentElement) return;
        toast.classList.add('removing');
        setTimeout(() => toast.parentElement?.removeChild(toast), 250);
    }

    function getToastIcon(type) {
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        return icons[type] || icons.info;
    }

    return {
        init,
        show: showToast,
        success: (message, title) => showToast({ type: 'success', message, title }),
        error: (message, title) => showToast({ type: 'error', message, title, duration: 6000 }),
        warning: (message, title) => showToast({ type: 'warning', message, title }),
        info: (message, title) => showToast({ type: 'info', message, title })
    };
})();
