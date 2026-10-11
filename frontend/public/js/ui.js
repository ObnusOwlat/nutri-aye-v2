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

    // Paraguayan format: 1.234,5 · 31/12/2026 · ₲ 150.000
    const formatNumber = (num, decimals = 0) => (num == null || Number.isNaN(Number(num)) ? '-'
        : Number(num).toLocaleString('es-PY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
    const formatDecimal = (num, decimals = 1) => formatNumber(num, decimals);
    const formatCalories = (kcal) => `${formatNumber(Math.round(kcal || 0))} kcal`;
    const formatMoney = (amount) => `₲ ${formatNumber(Math.round(amount || 0))}`;
    // "2026-03-05" (or an ISO date-time) -> "05/03/2026"; dates without time are not shifted by the time zone
    const formatDate = (value) => {
        if (!value) return '-';
        const [y, m, d] = String(value).slice(0, 10).split('-');
        return d ? `${d}/${m}/${y}` : String(value);
    };
    const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' }) : '-');
    const plural = (n, singular, pluralForm = `${singular}s`) => `${formatNumber(n)} ${n === 1 ? singular : pluralForm}`;
    const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    // Spanish name of a stored value (labels from GET /api/labels, loaded with the data)
    const label = (group, value) => (value == null || value === '' ? '' : State.labels?.[group]?.[value] || capitalize(String(value).replace(/_/g, ' ')));

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
        formatDecimal,
        formatCalories,
        formatMoney,
        formatDate,
        formatDateTime,
        plural,
        capitalize,
        label,
        escapeHtml,
        emit,
        on
    };
})();

document.addEventListener('DOMContentLoaded', () => UI.init());
