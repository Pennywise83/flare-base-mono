import { Format } from 'logform';

import safeStringify from 'fast-safe-stringify';
import { NestLikeConsoleFormatOptions } from 'nest-winston';
import { inspect } from 'util';
import { format } from 'winston';
const clc = require('cli-color');
const bare = require('cli-color/bare');
const nestLikeColorScheme: Record<string, any> = {
    info: clc.greenBright,
    error: clc.red,
    warn: clc.yellow,
    debug: clc.magentaBright,
    verbose: clc.cyanBright,
};
var contextPadLength = 0;
var levelPadLength = 0;
var pidPadLength = 0;
var hostnamePadLength = 0;
const nestLikeConsoleFormat = (
    appName = 'NestWinston',
    options?: NestLikeConsoleFormatOptions
): Format =>
    format.printf(({ context, level, timestamp, message, ms, ...meta }) => {
        if ('undefined' !== typeof timestamp) {
            // Only format the timestamp to a locale representation if it's ISO 8601 format. Any format
            // that is not a valid date string will throw, just ignore it (it will be printed as-is).
            try {
                if (timestamp === new Date(timestamp).toISOString()) {
                    timestamp = new Date(timestamp).toLocaleString();
                }
            } catch (error) {
                // eslint-disable-next-line no-empty
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const color = nestLikeColorScheme[level] || ((text: string): string => text);
        message = message.replace('\t', '')
        const stringifiedMeta = safeStringify(meta);
        const formattedMeta = options?.prettyPrint
            ? inspect(JSON.parse(stringifiedMeta), { colors: true, depth: null })
            : stringifiedMeta;
        if (typeof level != 'undefined') {
            if (levelPadLength < level.length) {
                levelPadLength = level.length;
            }
        }
        if (typeof context != 'undefined') {
            if (contextPadLength < context.length) {
                contextPadLength = context.length;
            }
        }
        if (typeof appName != 'undefined') {
            if (hostnamePadLength < appName.length) {
                hostnamePadLength = appName.length;
            }
        }
        if (typeof process.pid != 'undefined') {
            if (pidPadLength < process.pid.toString().length) {
                pidPadLength = process.pid.toString().length;
            }
        }
        return (
            `${color(`[${appName.padEnd(hostnamePadLength)}] ${process.pid.toString().padEnd(pidPadLength)}`)} - ` +
            ('undefined' !== typeof timestamp ? `${timestamp} ` : '') +
            `${color(level.toUpperCase().padEnd(levelPadLength))} ` +
            ('undefined' !== typeof context
                ? `${clc.yellow('[' + context.padEnd(contextPadLength) + ']')} `
                : '') +
            `${color(message)} - ` +
            `${formattedMeta != '{}' ? formattedMeta : ''}` +
            ('undefined' !== typeof ms ? ` ${clc.yellow(ms)}` : '')
        );
    });
export const loggerFormat = {
    format: {
        nestLikeCustom: nestLikeConsoleFormat,
    },
};
