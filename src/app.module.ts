import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getStream as getFileStreamRotator } from 'file-stream-rotator';
import { LoggerModule } from 'nestjs-pino';
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import pretty from 'pino-pretty';

const isProd = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug');

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const fileStream = getFileStreamRotator({
  filename: path.join(logDir, 'app-%DATE%.log'),
  date_format: 'YYYY-MM-DD',
  frequency: 'daily',
  size: '10M',
  max_logs: '30d',
  audit_file: path.join(logDir, '.audit.json'),
  extension: '.log',
  create_symlink: true,
  symlink_name: 'app-current.log',
  file_options: { encoding: 'utf8' },
});

const consolePrettyStream = !isProd
  ? pretty({ colorize: true, translateTime: 'SYS:standard', singleLine: true })
  : process.stdout;

const stream = pino.multistream([
  { level: 'debug', stream: fileStream },
  { level: LOG_LEVEL, stream: consolePrettyStream }
]);

/**
 * The root application module for the Pizza App backend.
 *
 * @module AppModule
 *
 * @remarks
 * This module imports and configures core modules for the application:
 * - `ThrottlerModule`: Provides rate limiting with a time-to-live (ttl) of 60 seconds and a limit of 120 requests.
 * - `LoggerModule`: Configures HTTP logging using Pino with custom log levels, request ID generation, and sensitive data redaction.
 *
 * @see ThrottlerModule
 * @see LoggerModule
 * @see AppController
 * @see AppService
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60, limit: 120 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: LOG_LEVEL,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.pass',
            'req.body.token',
          ],
          remove: true,
        },
        genReqId: (req) => (req.headers['x-request-id'] as string) ?? undefined,
        customLogLevel: (_req, res, err) => {
          if (err) return 'error';
          if (res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        stream,
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
