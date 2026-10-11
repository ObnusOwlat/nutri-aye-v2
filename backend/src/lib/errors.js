// Log the real error on the server, return a generic message to the client
function serverError(res, error, status = 500) {
    console.error('[Server] Error:', error);
    return res.status(status).json({ success: false, error: 'Error interno del servidor', code: 'INTERNAL_ERROR' });
}

module.exports = { serverError };
