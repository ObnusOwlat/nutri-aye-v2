/**
 * ui.js - Shared UI entry point: modal and toasts (ui-modal.js, ui-toast.js),
 * formatting and HTML escaping
 */

const UI = (function() {
    function init() {
        Modal.init();
        Toast.init();
        document.getElementById('btn-print')?.addEventListener('click', printPage);
    }

    const printPage = () => window.print();

    const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const formatCalories = (kcal) => `${formatNumber(Math.round(kcal))} kcal`;
    const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

    // Safe for element content AND attribute values (escapes quotes too)
    const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const escapeHtml = (text) => (text == null ? '' : String(text).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]));

    // App-wide events (app.js)
    const emit = (event, data) => document.dispatchEvent(new CustomEvent(event, { detail: data }));
    const on = (event, handler) => document.addEventListener(event, (e) => handler(e.detail));

    return {
        init,
        // Modal
        openModal: (config) => Modal.openModal(config),
        closeModal: () => Modal.closeModal(),
        isModalOpen: () => Modal.isModalOpen(),
        confirm: (...args) => Modal.confirm(...args),
        confirmDanger: (...args) => Modal.confirmDanger(...args),
        // Toasts
        showToast: (options) => Toast.show(options),
        toastSuccess: (message, title) => Toast.success(message, title),
        toastError: (message, title) => Toast.error(message, title),
        toastWarning: (message, title) => Toast.warning(message, title),
        toastInfo: (message, title) => Toast.info(message, title),
        // Utilities
        printPage,
        formatNumber,
        formatCalories,
        capitalize,
        escapeHtml,
        emit,
        on
    };
})();

document.addEventListener('DOMContentLoaded', () => UI.init());
