import { Logger } from '@nestjs/common';

export class AppLogger {
  private readonly logger: Logger;

  constructor(context = 'App') {
    this.logger = new Logger(context);
  }

  error(message: string, stack?: string, meta?: Record<string, unknown>) {
    this.logger.error(
      meta ? `${message} ${JSON.stringify(meta)}` : message,
      stack,
    );
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  log(message: string) {
    this.logger.log(message);
  }
}
