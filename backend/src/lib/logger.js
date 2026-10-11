// Structured logs (pino). Never log request bodies: they carry patient data.
const pino = require('pino');

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');
const transport = process.stdout.isTTY && process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined;

const logger = pino({ level, transport });

module.exports = { logger };
