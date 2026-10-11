/**
 * ui.js - UI Utilities
 * 
 * Modal system, toast notifications, print mode,
 * and other UI helper functions.
 */

const UI = (function() {
    // DOM Elements
    let modalOverlay, modal, modalTitle, modalBody, modalFooter;
    let modalConfirmBtn, modalCancelBtn, modalCloseBtn;
    let toastContainer;

    // Modal state
    let currentModalConfig = null;

    /**
     * Initialize UI module
     */
    function init() {
        // Cache DOM elements
        modalOverlay = document.getElementById('modal-overlay');
        modal = document.getElementById('modal');
        modalTitle = document.getElementById('modal-title');
        modalBody = document.getElementById('modal-body');
        modalFooter = document.getElementById('modal-footer');
        modalConfirmBtn = document.getElementById('modal-confirm');
        modalCancelBtn = document.getElementById('modal-cancel');
        modalCloseBtn = document.getElementById('modal-close');
        toastContainer = document.getElementById('toast-container');

        // Bind events
        bindEvents();

        console.log('[UI] Initialized');
    }

    /**
     * Bind UI events
     */
    function bindEvents() {
        // Modal close events
        modalCloseBtn.addEventListener('click', closeModal);
        modalCancelBtn.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isModalOpen()) {
                closeModal();
            }
        });

        // Print buttons
        document.getElementById('btn-print')?.addEventListener('click', () => printPage());
        document.getElementById('btn-print-shopping')?.addEventListener('click', () => printShoppingList());

        // Toast delegation (single listener)
        toastContainer.addEventListener('click', handleToastClose);
    }

    // ==========================================
    // MODAL SYSTEM
    // ==========================================

    /**
     * Open modal with configuration
     * @param {Object} config - Modal configuration
     */
    function openModal(config) {
        console.log('[UI] openModal called with:', config.title, 'onConfirm:', typeof config.onConfirm);
        currentModalConfig = config;

        // Set title
        modalTitle.textContent = config.title || 'Modal';

        // Set size class
        modal.className = 'modal';
        if (config.size === 'large') modal.classList.add('modal--large');
        if (config.size === 'fullscreen') modal.classList.add('modal--fullscreen');

        // Set body content
        if (typeof config.content === 'string') {
            modalBody.innerHTML = config.content;
        } else if (config.content instanceof HTMLElement) {
            modalBody.innerHTML = '';
            modalBody.appendChild(config.content);
        } else {
            modalBody.innerHTML = '';
        }

        // Set footer visibility
        if (config.hideFooter) {
            modalFooter.style.display = 'none';
        } else {
            modalFooter.style.display = 'flex';
            
            // Set footer class for spacing
            modalFooter.className = 'modal__footer';
            if (config.footerSpaceBetween) {
                modalFooter.classList.add('modal__footer--space-between');
            }
        }

        // Set button text
        modalConfirmBtn.textContent = config.confirmText || 'Confirm';
        modalCancelBtn.textContent = config.cancelText || 'Cancel';

        // Set button visibility
        modalConfirmBtn.style.display = config.hideConfirm ? 'none' : 'inline-flex';
        modalCancelBtn.style.display = config.hideCancel ? 'none' : 'inline-flex';

        // Bind confirm handler
        if (config.onConfirm) {
            modalConfirmBtn.onclick = () => {
                console.log('[UI] Confirm clicked, onConfirm:', typeof config.onConfirm);
                try {
                    const result = config.onConfirm();
                    console.log('[UI] onConfirm result:', result);
                    if (result !== false) {
                        closeModal();
                    }
                } catch (e) {
                    console.error('[UI] Confirm error:', e);
                    toastError(e.message || 'An error occurred');
                }
            };
        } else {
            modalConfirmBtn.onclick = closeModal;
        }

        // Bind cancel handler
        if (config.onCancel) {
            modalCancelBtn.onclick = () => {
                config.onCancel();
                closeModal();
            };
        } else {
            modalCancelBtn.onclick = closeModal;
        }

        // Add custom class for styling
        if (config.className) {
            modal.classList.add(config.className);
        }

        // Show modal
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Focus first input if exists
        setTimeout(() => {
            const firstInput = modalBody.querySelector('input, select, textarea');
            if (firstInput) firstInput.focus();
        }, 100);

        // Call onOpen callback if provided
        if (config.onOpen) {
            setTimeout(() => config.onOpen(), 150);
        }

        // Emit event
        emit('modal:opened', config);
    }

    /**
     * Handle confirm button click (called directly from HTML onclick)
     */
    function handleConfirmClick() {
        console.log('[UI] handleConfirmClick called');
        console.log('[UI] currentModalConfig:', currentModalConfig);
        
        if (!currentModalConfig) {
            console.log('[UI] No config!');
            return;
        }
        
        if (currentModalConfig.onConfirm) {
            console.log('[UI] Calling onConfirm...');
            try {
                const result = currentModalConfig.onConfirm();
                console.log('[UI] Result:', result);
                if (result !== false) {
                    closeModal();
                }
            } catch (e) {
                console.error('[UI] Error:', e);
                toastError(e.message || 'An error occurred');
            }
        }
    }

    /**
     * Close modal
     */
    function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        currentModalConfig = null;
    }

    /**
     * Check if modal is open
     */
    function isModalOpen() {
        return modalOverlay.classList.contains('active');
    }

    /**
     * Update modal body content (for dynamic updates)
     */
    function updateModalBody(content) {
        if (typeof content === 'string') {
            modalBody.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            modalBody.innerHTML = '';
            modalBody.appendChild(content);
        }
    }

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================

    /**
     * Show toast notification
     * @param {Object} options - Toast options
     */
    function showToast(options = {}) {
        const { type = 'info', title, message, duration = 4000 } = options;
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
            <span class="toast__icon">${getToastIcon(type)}</span>
            <div class="toast__content">
                ${title ? `<div class="toast__title">${title}</div>` : ''}
                <div class="toast__message">${message || ''}</div>
            </div>
            <button class="toast__close">×</button>
        `;

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

    /**
     * Toast close handler for delegation
     */
    function handleToastClose(e) {
        const closeBtn = e.target.closest('.toast__close');
        if (closeBtn) removeToast(closeBtn.closest('.toast'));
    }

    // Toast event listener moved to bindEvents() above

    /**
     * Get icon for toast type
     */
    function getToastIcon(type) {
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        return icons[type] || icons.info;
    }

    // Convenience methods
    const toastSuccess = (message, title) => showToast({ type: 'success', message, title });
    const toastError = (message, title) => showToast({ type: 'error', message, title, duration: 6000 });
    const toastWarning = (message, title) => showToast({ type: 'warning', message, title });
    const toastInfo = (message, title) => showToast({ type: 'info', message, title });

    // ==========================================
    // PRINT FUNCTIONS
    // ==========================================

    /**
     * Print the current page
     */
    function printPage() {
        window.print();
    }

    /**
     * Print shopping list only
     */
    function printShoppingList() {
        // Show only shopping tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            if (tab.id !== 'tab-shopping') {
                tab.style.display = 'none';
            }
        });

        // Print
        window.print();

        // Restore tabs after print
        setTimeout(() => {
            document.querySelectorAll('.tab-content').forEach(tab => {
                if (tab.classList.contains('active')) {
                    tab.style.display = 'block';
                }
            });
        }, 100);
    }

    // ==========================================
    // FORM HELPERS
    // ==========================================

    /**
     * Create form group element
     */
    function createFormGroup(label, input, hint) {
        const group = document.createElement('div');
        group.className = 'form-group';

        const labelEl = document.createElement('label');
        labelEl.className = 'form-label';
        labelEl.textContent = label;

        group.appendChild(labelEl);
        group.appendChild(input);

        if (hint) {
            const hintEl = document.createElement('p');
            hintEl.className = 'form-hint';
            hintEl.textContent = hint;
            group.appendChild(hintEl);
        }

        return group;
    }

    /**
     * Create select element with options
     */
    function createSelect(options, selectedValue) {
        const select = document.createElement('select');
        select.className = 'form-select';

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === selectedValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        return select;
    }

    /**
     * Create input element
     */
    function createInput(type, value, placeholder, options = {}) {
        const input = document.createElement('input');
        input.type = type;
        input.className = 'form-input';
        input.value = value || '';
        input.placeholder = placeholder || '';

        if (options.id) input.id = options.id;
        if (options.name) input.name = options.name;
        if (options.min !== undefined) input.min = options.min;
        if (options.max !== undefined) input.max = options.max;
        if (options.step) input.step = options.step;
        if (options.required) input.required = true;
        if (options.className) input.classList.add(options.className);

        return input;
    }

    // ==========================================
    // CONFIRM DIALOG
    // ==========================================

    /**
     * Show confirmation dialog
     */
    function confirm(message, onConfirm, onCancel) {
        return openModal({
            title: 'Confirm',
            content: `<p>${message}</p>`,
            confirmText: 'Yes',
            cancelText: 'No',
            onConfirm: onConfirm,
            onCancel: onCancel,
            className: 'confirm-dialog'
        });
    }

    /**
     * Show danger confirmation dialog
     */
    function confirmDanger(message, onConfirm) {
        return openModal({
            title: 'Are you sure?',
            content: `<p class="text-danger">${message}</p>`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: onConfirm,
            className: 'danger-dialog'
        });
    }

    // ==========================================
    // LOADING STATES
    // ==========================================

    /**
     * Show loading spinner
     */
    function showLoading(container) {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.innerHTML = '<div class="spinner"></div>';
        container.appendChild(spinner);
        return spinner;
    }

    /**
     * Remove loading spinner
     */
    function hideLoading(spinner) {
        if (spinner && spinner.parentElement) {
            spinner.parentElement.removeChild(spinner);
        }
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    /**
     * Format number with commas
     */
    const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    /**
     * Format calories
     */
    const formatCalories = (kcal) => `${formatNumber(Math.round(kcal))} kcal`;

    /**
     * Format weight (grams to kg/g)
     */
    const formatWeight = (grams) => grams >= 1000 
        ? `${(grams / 1000).toFixed(2)} kg` 
        : `${grams}g`;

    /**
     * Capitalize first letter
     */
    const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

    /**
     * Escape HTML
     */
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    /**
     * Emit event
     */
    function emit(event, data) {
        document.dispatchEvent(new CustomEvent(event, { detail: data }));
    }

    /**
     * Listen to event
     */
    function on(event, handler) {
        document.addEventListener(event, (e) => handler(e.detail));
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        init,

        // Modal
        openModal,
        closeModal,
        isModalOpen,
        updateModalBody,

        // Toasts
        showToast,
        toastSuccess,
        toastError,
        toastWarning,
        toastInfo,

        // Print
        printPage,
        printShoppingList,

        // Form helpers
        createFormGroup,
        createSelect,
        createInput,

        // Dialogs
        confirm,
        confirmDanger,

        // Loading
        showLoading,
        hideLoading,

        // Utilities
        formatNumber,
        formatCalories,
        formatWeight,
        capitalize,
        escapeHtml,

        // Events
        emit,
        on,

        // Modal
        handleConfirmClick
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => UI.init());
