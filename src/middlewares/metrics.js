const counts = {
  byPath: Object.create(null),
  byStatus: Object.create(null),
  total: 0,
};

function metrics(req, res, next) {
  const start = Date.now();
  const pathKey = req.route?.path
    ? `${req.baseUrl || ''}${req.route.path}`
    : req.path;

  res.on('finish', () => {
    counts.total += 1;

    const status = String(res.statusCode);
    counts.byStatus[status] = (counts.byStatus[status] || 0) + 1;

    const key = `${req.method} ${pathKey}`;
    if (!counts.byPath[key]) {
      counts.byPath[key] = { count: 0, totalMs: 0 };
    }
    counts.byPath[key].count += 1;
    counts.byPath[key].totalMs += Date.now() - start;
  });

  next();
}

function getSnapshot() {
  const paths = {};
  for (const [key, val] of Object.entries(counts.byPath)) {
    paths[key] = {
      count: val.count,
      avgMs: val.count ? Math.round(val.totalMs / val.count) : 0,
    };
  }

  return {
    total: counts.total,
    byStatus: { ...counts.byStatus },
    byPath: paths,
    uptime: process.uptime(),
  };
}

metrics.getSnapshot = getSnapshot;

module.exports = metrics;
