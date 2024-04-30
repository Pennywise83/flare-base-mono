import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import os from "os";
import { LoggerOptions, format, transports } from 'winston';
import { MainModule } from './main.module';
import { LoggerConfig } from './model/app-config/logger-config';
import { loggerFormat } from './model/app-config/logger-format';
import { ServerSettings } from './model/app-config/server-settings';
require('winston-daily-rotate-file');

async function bootstrap() {
  const app = await NestFactory.create(MainModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const configService = app.get(ConfigService);
  const port = configService.get<ServerSettings>('serverSettings').port;
  await initializeLogger(configService, app).then(async () => {
    await initializeSwagger(app);
    await app.listen(port);
  });

}

async function initializeSwagger(app: INestApplication): Promise<void> {
  // swagger-ui
  const config = new DocumentBuilder()
    .setTitle('Flare Base')
    .setDescription('Flare Base API documentation')
    .setVersion('0.0.1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api', app, document, {
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js',
    ],
  });
  return Promise.resolve();
}
async function initializeLogger(configService: ConfigService, app: INestApplication): Promise<void> {
  let loggerOptions: LoggerOptions = {
    transports: [
      new transports.Console({
        level: configService.get<LoggerConfig>('logger').level,
        format: format.combine(
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          format.align(),
          format.ms(),
          format.splat(),
          loggerFormat.format.nestLikeCustom(os.hostname(), { prettyPrint: true }),
        )
      }),
      new (transports as any).DailyRotateFile({
        filename: `${configService.get<LoggerConfig>('logger')!.loggerFileName}-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxFiles: '7d',
        maxSize: '250m',
        dirname: `${configService.get<LoggerConfig>('logger')!.path}`,
        level: configService.get<LoggerConfig>('logger').level,
        format: format.combine(
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          format.ms(),
          format.align(),
          format.splat(),
          loggerFormat.format.nestLikeCustom(os.hostname(), { prettyPrint: true }),
          format.uncolorize(),
        )
      })
    ]
  }
  app.useLogger(WinstonModule.createLogger(loggerOptions))
}
bootstrap();
