import type { NextFunction, Request, Response } from 'express';

export type LegacyHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => unknown;

/**
 * Invokes a legacy Express controller/handler from a Nest controller method
 * that owns the response via `@Res()`.
 *
 * Legacy handlers write the HTTP response themselves (`res.json`/`res.send`/
 * `res.status(...).json(...)`), so the Nest method calling this helper must
 * NOT also return a value — doing so risks writing the response twice.
 *
 * Any synchronous throw, or a rejected promise not already caught inside the
 * legacy handler, is forwarded to `next`, mirroring Express's own
 * error-handling contract so the app's exception filter still runs.
 */
export function runLegacy(
  handler: LegacyHandler,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const result = handler(req, res, next);
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      Promise.resolve(result as PromiseLike<unknown>).catch(next);
    }
  } catch (err) {
    next(err as Error);
  }
}
