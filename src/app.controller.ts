import { Controller, Get, Res, Query } from '@nestjs/common';
import type { Response } from 'express';
import { Logger } from 'nestjs-pino';
import * as fs from 'fs/promises';
import * as path from 'path';
const hostname = require('os').hostname();
const userInfo = require('os').userInfo();
const networkInterfaces = require('os').networkInterfaces();

@Controller()
export class AppController {
  constructor(private readonly logger: Logger) { }

  @Get()
  getRoot(@Res() res: Response) {
    res
      .type('html')
      .send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido</title>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;400&display=swap" rel="stylesheet">
        <style>
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
            font-family: 'Montserrat', Arial, sans-serif;
          }
          body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: #fff;
            border-radius: 18px;
            box-shadow: 0 8px 32px 0 rgba(44, 62, 80, 0.18);
            padding: 3em 2.5em 2.5em 2.5em;
            max-width: 400px;
            width: 100%;
            text-align: center;
            animation: fadeIn 1s;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(30px);}
            to { opacity: 1; transform: translateY(0);}
          }
          .pizza-emoji {
            font-size: 3.5em;
            margin-bottom: 0.2em;
            animation: bounce 1.2s infinite alternate;
            display: block;
          }
          @keyframes bounce {
            to { transform: translateY(-10px);}
          }
          h1 {
            color: #d35400;
            margin-bottom: 0.3em;
            font-size: 2em;
            font-weight: 700;
            letter-spacing: 1px;
          }
          p {
            color: #555;
            font-size: 1.1em;
            margin-bottom: 2em;
          }
          .btn {
            background: linear-gradient(90deg, #d35400 0%, #e67e22 100%);
            color: #fff;
            border: none;
            padding: 1em 2.5em;
            border-radius: 8px;
            font-size: 1.15em;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(211,84,0,0.12);
            transition: background 0.2s, transform 0.2s;
            text-decoration: none;
            outline: none;
            display: inline-block;
          }
          .btn:hover, .btn:focus {
            background: linear-gradient(90deg, #e67e22 0%, #d35400 100%);
            transform: scale(1.05);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <span class="pizza-emoji">🍕</span>
          <h1>Bienvenido a la app de la Pizzería</h1>
          <p>¡Explora la API o consulta la documentación interactiva!</p>
          <a href="/docs" class="btn">Ver documentación Swagger</a>
        </div>
      </body>
      </html>
    `);
  }

  @Get('health/ping')
  ping() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health')
  async health() {
    try {
      // Uptime en días, horas, minutos, segundos
      const uptimeSec = Math.round(process.uptime());
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;

      // Memoria en formato legible
      const mem = process.memoryUsage();
      const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        const units = ['KB', 'MB', 'GB', 'TB'];
        let i = -1;
        do {
          bytes = bytes / 1024;
          i++;
        } while (bytes >= 1024 && i < units.length - 1);
        return `${bytes.toFixed(2)} ${units[i]}`;
      };

      const memory = {
        rss: formatBytes(mem.rss),
        heapTotal: formatBytes(mem.heapTotal),
        heapUsed: formatBytes(mem.heapUsed),
        external: formatBytes(mem.external),
        arrayBuffers: mem.arrayBuffers ? formatBytes(mem.arrayBuffers) : undefined,
      };

      const env = process.env.NODE_ENV || 'development';
      const port = process.env.PORT || '3000';

      // Información adicional relevante
      const cpuUsage = process.cpuUsage();
      const loadAvg = process.platform !== 'win32' ? require('os').loadavg() : undefined;
      const arch = process.arch;

      return {
        status: 'ok',
        uptime: {
          days,
          hours,
          minutes,
          seconds,
          total_seconds: uptimeSec,
        },
        memory,
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        loadAvg,
        env,
        port,
        timestamp: new Date().toISOString(),
        pid: process.pid,
        platform: process.platform,
        arch,
        node_version: process.version,
        hostname,
        user: userInfo.username,
        networkInterfaces,
        cwd: process.cwd(),
        execPath: process.execPath,
        mainModule: require.main?.filename,
      };
    } catch (err) {
      this.logger.error({ err }, 'Error calculando health');
      return { status: 'error', error: String(err) };
    }
  }

  @Get('health/logs')
  async tailLogs(@Res() res: Response, @Query('lines') lines = '200') {
    const n = Math.max(1, Math.min(1000, parseInt(String(lines), 10) || 200));
    const logPath = path.join(process.cwd(), 'logs', 'app-current.log');

    try {
      const exists = await fs.stat(logPath).then(() => true).catch(() => false);
      if (!exists) {
        return res.status(404).json({ error: 'No log file found', path: logPath });
      }

      const content = String(await fs.readFile(logPath, { encoding: 'utf8' }));
      const allLines = content.split(/\r?\n/).filter(Boolean);
      const tail = allLines.slice(-n);

      return res.json({ path: logPath, lines: tail.length, tail });
    } catch (err) {
      this.logger.error({ err }, 'Error leyendo logs');
      return res.status(500).json({ error: 'Error reading logs', detail: String(err) });
    }
  }
}
