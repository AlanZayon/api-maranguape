import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

type PathStats = { count: number; totalMs: number };

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private readonly counts = {
    byPath: Object.create(null) as Record<string, PathStats>,
    byStatus: Object.create(null) as Record<string, number>,
    total: 0,
  };

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const pathKey = req.route?.path
      ? `${req.baseUrl || ''}${req.route.path}`
      : req.path;

    res.on('finish', () => {
      this.counts.total += 1;
      const status = String(res.statusCode);
      this.counts.byStatus[status] = (this.counts.byStatus[status] || 0) + 1;
      const key = `${req.method} ${pathKey}`;
      if (!this.counts.byPath[key]) {
        this.counts.byPath[key] = { count: 0, totalMs: 0 };
      }
      this.counts.byPath[key].count += 1;
      this.counts.byPath[key].totalMs += Date.now() - start;
    });

    next();
  }

  getSnapshot() {
    const paths: Record<string, { count: number; avgMs: number }> = {};
    for (const [key, val] of Object.entries(this.counts.byPath)) {
      paths[key] = {
        count: val.count,
        avgMs: val.count ? Math.round(val.totalMs / val.count) : 0,
      };
    }
    return {
      total: this.counts.total,
      byStatus: { ...this.counts.byStatus },
      byPath: paths,
      uptime: process.uptime(),
    };
  }
}
