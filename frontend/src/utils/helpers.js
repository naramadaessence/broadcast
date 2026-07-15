/**
 * Utility helpers for WhatsApp Broadcast
 * Centralizes common functions for consistency across components
 */

/**
 * Format date to Indian locale (dd/mm/yyyy)
 * @param {string|Date} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
    if (!date) return '-';
    try {
        return new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...options });
    } catch (e) {
        console.error('Date formatting error:', e);
        return '-';
    }
};

/**
 * Format date with time
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date-time string
 */
export const formatDateTime = (date) => {
    if (!date) return '-';
    try {
        return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    } catch (e) {
        console.error('DateTime formatting error:', e);
        return '-';
    }
};

/**
 * Format currency in Indian Rupees
 * @param {number|string} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-';
    try {
        return `₹${Number(amount).toLocaleString('en-IN')}`;
    } catch (e) {
        console.error('Currency formatting error:', e);
        return '-';
    }
};

/**
 * Format budget (shorter version for tables)
 * @param {number|string} amount - Amount to format
 * @returns {string} Formatted budget string (e.g., "₹50L")
 */
export const formatBudget = (amount) => {
    if (!amount) return '-';
    try {
        const num = Number(amount);
        if (num >= 10000000) {
            return `₹${(num / 10000000).toFixed(1)}Cr`;
        }
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(0)}L`;
        }
        return `₹${num.toLocaleString('en-IN')}`;
    } catch {
        return '-';
    }
};

/**
 * Sanitize string input (trim whitespace)
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export const sanitize = (str) => {
    if (!str) return '';
    return String(str).trim();
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
export const isValidEmail = (email) => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate phone number (Indian format)
 * @param {string} phone - Phone to validate
 * @returns {boolean} Whether phone is valid
 */
export const isValidPhone = (phone) => {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 12;
};
