import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cors from 'cors';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.use(compression());
  app.use(cors());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Pizzeria API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const env = process.env.NODE_ENV || 'development';
  const swaggerUrl = `/docs`;
  const baseUrl = `http://localhost:${port}`;
  const logger = app.get(Logger);

  // Usar caracteres ASCII simples para compatibilidad en consola
  const logMsg = [
    '',
    '============================================================',
    '      Pizzeria API iniciado',
    '============================================================',
    ` Entorno   : ${env}`,
    ` Puerto    : ${port}`,
    ` URL       : ${baseUrl}`,
    ` Swagger   : ${baseUrl}${swaggerUrl}`,
    ` BasePath  : /`,
    ` Versión   : 1.0`,
    ` Fecha     : ${new Date().toLocaleString()}`,
    '============================================================',
    ''
  ].join('\n');

  if (logger && typeof logger.log === 'function') {
    logger.log(logMsg);
  } else {
    // fallback por si logger no está disponible
    // eslint-disable-next-line no-console
    console.log(logMsg);
  }
}
bootstrap();
