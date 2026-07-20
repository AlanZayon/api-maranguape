const r = db.references.updateMany(
  { funcionarioId: null },
  { $unset: { funcionarioId: '' } },
);
printjson(r);
print('nullFid=' + db.references.countDocuments({ funcionarioId: null }));
