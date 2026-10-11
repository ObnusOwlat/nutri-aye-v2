// Internal billing (no fiscal value)
const { z, text, requiredText, optionalText, isoDate, nonNegative } = require('./index');
const { INVOICE_STATUSES, QUOTE_STATUSES, ITEM_TYPES, PAYMENT_TYPES, CLIENT_TYPES } = require('../constants');

const optionalEmail = z.preprocess(v => (v === '' ? null : v), z.string().trim().email().max(200).nullish());

const company = z.object({
    name: requiredText(200),
    email: optionalEmail,
    phone: text(50).nullish(),
    address: text(300).nullish(),
    city: text(100).nullish(),
    country: text(100).default('Paraguay'),
    currency: z.string().length(3).toUpperCase().default('PYG'),
    vatId: text(50).nullish(),
    website: text(200).nullish()
});

const pdfConfig = z.object({
    fontFamily: text(50).default('Helvetica'),
    padding: z.coerce.number().int().min(0).max(200).default(40),
    primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#22c55e'),
    secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#64748b'),
    includeLogo: z.boolean().default(false),
    logoB64: optionalText(500000)
});

const client = z.object({
    name: requiredText(200),
    email: optionalEmail,
    phone: text(50).nullish(),
    address: text(300).nullish(),
    city: text(100).nullish(),
    country: text(100).default('Paraguay'),
    type: z.enum(CLIENT_TYPES).default('INDIVIDUAL'),
    vatId: text(50).nullish(),
    notes: optionalText(2000)
});

const item = z.object({
    description: requiredText(500),
    quantity: z.coerce.number().positive().default(1),
    unitPrice: nonNegative.default(0),
    type: z.enum(ITEM_TYPES).default('SERVICE')
});

const documentBase = {
    clientId: requiredText(64),
    date: isoDate.nullish(),
    discount: nonNegative.default(0),
    notes: optionalText(5000),
    items: z.array(item).max(200).optional()
};

const invoice = z.object({
    ...documentBase,
    status: z.enum(INVOICE_STATUSES).default('UNPAID'),
    dueDate: isoDate.nullish(),
    paidAt: z.string().nullish()
});

const quote = z.object({
    ...documentBase,
    status: z.enum(QUOTE_STATUSES).default('DRAFT'),
    validUntil: isoDate.nullish()
});

const payment = z.object({
    amount: z.coerce.number().positive('El monto tiene que ser mayor que cero'),
    date: isoDate.nullish(),
    methodId: text(64).nullish(),
    notes: optionalText(1000)
});

const paymentMethod = z.object({
    name: requiredText(100),
    type: z.enum(PAYMENT_TYPES).default('BANK_TRANSFER'),
    instructions: optionalText(2000),
    isDefault: z.boolean().default(false)
});

module.exports = { company, pdfConfig, client, invoice, quote, payment, paymentMethod };
