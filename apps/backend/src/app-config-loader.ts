import { plainToClass } from 'class-transformer';
import { ValidationError, isEmpty, validate } from 'class-validator';
import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { AppConfig } from './model/app-config/app-config';
const path = require('path');
let configFilePath: string

export default async () => {
    configFilePath = process.argv[2];
    if (typeof configFilePath == 'undefined') {
        configFilePath = path.resolve('./config.yml');
    } else {
        configFilePath = path.resolve(configFilePath);
    }
    let loadedConfig = yaml.load(readFileSync(configFilePath, 'utf8'),) as Record<string, any>;

    if (isEmpty(loadedConfig)) {
        throw new Error('Invalid configuration');
    }

    const appConfig = plainToClass(AppConfig, loadedConfig);
    const validationErrors: ValidationError[] = await validate(appConfig, { enableDebugMessages: false, whitelist: true, skipMissingProperties: false });
    if (validationErrors.length > 0) {
        const messages: string[] = validationErrors.flatMap(extractConstraintsMessages);
        throw new Error(`Invalid configuration:\n${messages.join("\n")}`);
    }
    return appConfig;
};

export function extractConstraintsMessages(error: ValidationError): string[] {
    const messages: string[] = [];

    if (error.constraints && (!error.children || error.children.length == 0)) {
        for (const constraintKey of Object.keys(error.constraints)) {
            messages.push(`${error.property}: ${error.constraints[constraintKey]}`);
        }
    }

    if (error.children && error.children.length > 0) {
        for (const child of error.children) {
            messages.push(...extractConstraintsMessages(child).map(msg => error.property + '.' + msg));

        }
    }

    return messages;
}

