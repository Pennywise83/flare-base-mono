import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file'; // Importa DailyRotateFile da 'winston-daily-rotate-file'

export const auditLogger = createLogger({
    transports: [
        new DailyRotateFile({
            filename: 'audit-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '90d',
            maxSize: '1024m',
            dirname: 'logs/audit',
            level: 'info',
            format: format.combine(
                format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                format.ms(),
                format.align(),
                format.splat(),
                format.uncolorize(),
            ),
        }),
    ],
});