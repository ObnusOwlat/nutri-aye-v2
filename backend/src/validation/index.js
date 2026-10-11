// Request validation with zod; error messages in Spanish
const { z } = require('zod');
const { badRequest } = require('../lib/http');
const { fieldLabel } = require('../labels');

z.setErrorMap((issue) => {
    switch (issue.code) {
        case 'invalid_type':
            return { message: issue.received === 'undefined' ? 'Es obligatorio' : 'Tipo de dato inválido' };
        case 'too_small':
            if (issue.type === 'string') return { message: 'No puede estar vacío' };
            if (issue.type === 'array') return { message: `Debe tener al menos ${issue.minimum} elemento(s)` };
            return { message: `Debe ser ${issue.inclusive ? 'mayor o igual a' : 'mayor que'} ${issue.minimum}` };
        case 'too_big':
            if (issue.type === 'string') return { message: `Máximo ${issue.maximum} caracteres` };
            return { message: `Debe ser como máximo ${issue.maximum}` };
        case 'invalid_enum_value':
            return { message: `Valor inválido. Opciones: ${issue.options.join(', ')}` };
        case 'invalid_string':
            return { message: issue.validation === 'email' ? 'Email inválido' : 'Formato inválido' };
        case 'invalid_date':
            return { message: 'Fecha inválida' };
        case 'invalid_literal':
        case 'invalid_union':
        case 'invalid_union_discriminator':
            return { message: 'Valor no permitido' };
        case 'not_multiple_of':
            return { message: `Debe ser múltiplo de ${issue.multipleOf}` };
        default:
            return { message: 'Valor inválido' };
    }
});

// Shared field types
const text = (max = 500) => z.string().trim().max(max);
const requiredText = (max = 200) => text(max).min(1);
const optionalText = (max = 2000) => z.string().max(max).nullish();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Fecha inválida (AAAA-MM-DD)');
const nonNegative = z.coerce.number().min(0);

// Middleware: replaces req[source] with the parsed (and stripped) value
function validate(schema, source = 'body') {
    return (req, res, next) => {
        const result = schema.safeParse(req[source] ?? {});
        if (!result.success) {
            const details = result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
            return next(badRequest(`Revisá los datos: ${details.map(d => `${fieldLabel(d.field)}: ${d.message.toLowerCase()}`).join('; ')}`, details));
        }
        req[source] = result.data;
        next();
    };
}

module.exports = { z, validate, text, requiredText, optionalText, isoDate, nonNegative };
