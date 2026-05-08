/**
 * 🎵 Chorus — Logger
 * Structured logging with pino
 */

import pino from 'pino';
import type { LogLevel, ObservabilityConfig } from '../types/index.js';

let logger: pino.Logger;

export function initLogger(config: ObservabilityConfig): pino.Logger {
  const level: LogLevel = config.logLevel || 'info';

  if (config.logFormat === 'pretty') {
    logger = pino({
      level,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    });
  } else {
    logger = pino({ level });
  }

  return logger;
}

export function getLogger(): pino.Logger {
  if (!logger) {
    logger = pino({ level: 'info' });
  }
  return logger;
}

export function childLogger(name: string, meta?: Record<string, unknown>): pino.Logger {
  return getLogger().child({ component: name, ...meta });
}
