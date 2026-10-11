/**
 * ui-modal.js - The single modal of the app and the confirm dialogs
 */

const Modal = (function() {
    let modalOverlay, modal, modalTitle, modalBody, modalFooter;
    let modalConfirmBtn, modalCancelBtn, modalCloseBtn;
    let generation = 0; // increases with every modal opened

    function init() {
        modalOverlay = document.getElementById('modal-overlay');
        modal = document.getElementById('modal');
        modalTitle = document.getElementById('modal-title');
        modalBody = document.getElementById('modal-body');
        modalFooter = document.getElementById('modal-footer');
        modalConfirmBtn = document.getElementById('modal-confirm');
        modalCancelBtn = document.getElementById('modal-cancel');
        modalCloseBtn = document.getElementById('modal-close');

        modalCloseBtn.addEventListener('click', closeModal);
        modalCancelBtn.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isModalOpen()) closeModal();
        });

        // Range inputs show their value in the element named by data-output (no inline handlers: CSP)
        modalBody.addEventListener('input', (e) => {
            const outputId = e.target.dataset?.output;
            const output = outputId && document.getElementById(outputId);
            if (output) output.textContent = e.target.value;
        });
    }

    /**
     * Open the modal. config: title, content (HTML string or element), size,
     * confirmText, cancelText, onConfirm (may be async; returning false or throwing keeps it open), onCancel,
     * onOpen, hideFooter, hideConfirm, hideCancel, footerSpaceBetween, className
     */
    function openModal(config) {

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
        // onConfirm may be async (it saves to the server): the button waits, an
        // error keeps the modal open, and a modal opened meanwhile is not closed
        const opened = ++generation;
        modalConfirmBtn.disabled = false;
        if (config.onConfirm) {
            modalConfirmBtn.onclick = async () => {
                modalConfirmBtn.disabled = true;
                try {
                    const result = await config.onConfirm();
                    if (result !== false && generation === opened) closeModal();
                } catch (e) {
                    console.error('[UI] Confirm error:', e);
                    Toast.error(e.message || 'Ocurrió un error');
                } finally {
                    if (generation === opened) modalConfirmBtn.disabled = false;
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

        document.dispatchEvent(new CustomEvent('modal:opened', { detail: config }));
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    const isModalOpen = () => modalOverlay.classList.contains('active');

    function confirm(message, onConfirm, onCancel) {
        return openModal({
            title: 'Confirm',
            content: `<p>${UI.escapeHtml(message)}</p>`,
            confirmText: 'Yes',
            cancelText: 'No',
            onConfirm,
            onCancel,
            className: 'confirm-dialog'
        });
    }

    // Nothing is deleted in Nutri Aye: the default action is "deactivate"
    function confirmDanger(message, onConfirm, confirmText = 'Desactivar') {
        return openModal({
            title: '¿Estás seguro/a?',
            content: `<p class="text-danger">${UI.escapeHtml(message)}</p>`,
            confirmText,
            cancelText: 'Cancelar',
            onConfirm,
            className: 'danger-dialog'
        });
    }

    return { init, openModal, closeModal, isModalOpen, confirm, confirmDanger };
})();
