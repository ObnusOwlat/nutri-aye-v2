// Central error handler: logs the real error, returns a generic message
const { HttpError } = require('./http');
const { logger } = require('./logger');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
    if (err instanceof HttpError) {
        return res.status(err.status).json({ success: false, error: err.message, code: err.code, details: err.details });
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, error: 'El cuerpo de la solicitud no es JSON válido', code: 'INVALID_JSON' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, error: 'La solicitud es demasiado grande', code: 'PAYLOAD_TOO_LARGE' });
    }
    (req.log || logger).error({ err }, 'Error no controlado');
    return res.status(500).json({ success: false, error: 'Error interno del servidor', code: 'INTERNAL_ERROR' });
}

module.exports = { errorHandler };
