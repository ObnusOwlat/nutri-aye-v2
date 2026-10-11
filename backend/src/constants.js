// Allowed values shared by validation and routes (stored in English)
const INGREDIENT_CATEGORIES = ['protein', 'carbs', 'fats', 'vegetables', 'fruits', 'dairy', 'mixed'];
const MEAL_CATEGORIES = ['breakfast', 'lunch', 'dinner', 'afternoon_snack', 'snack'];
const MEAL_TYPES = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'snack', 'dinner'];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const UNITS = ['gram', 'milliliter', 'ounce', 'cup', 'tablespoon', 'teaspoon'];
const GENDERS = ['male', 'female', 'other'];
const PATIENT_STATUSES = ['active', 'inactive', 'archived'];
const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const CONDITION_TYPES = ['condition', 'allergy', 'intolerance', 'medication'];
const CONDITION_SEVERITIES = ['mild', 'moderate', 'severe'];
const INVOICE_STATUSES = ['UNPAID', 'PAID', 'OVERDUE', 'CANCELLED'];
const QUOTE_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
const ITEM_TYPES = ['SERVICE', 'PRODUCT'];
const PAYMENT_TYPES = ['BANK_TRANSFER', 'CASH', 'CARD', 'OTHER'];
const CLIENT_TYPES = ['INDIVIDUAL', 'COMPANY'];

module.exports = {
    INGREDIENT_CATEGORIES, MEAL_CATEGORIES, MEAL_TYPES, DAYS, UNITS, GENDERS, PATIENT_STATUSES,
    ACTIVITY_LEVELS, CONDITION_TYPES, CONDITION_SEVERITIES, INVOICE_STATUSES, QUOTE_STATUSES,
    ITEM_TYPES, PAYMENT_TYPES, CLIENT_TYPES
};
