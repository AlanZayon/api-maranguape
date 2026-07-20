const tid = ObjectId('6a5b7c0e346d46c6d2fe09b6');
const sid = ObjectId('6a5b8799712a7ab7b70d5309');

print(
  'funcionarios by oid: ' +
    db.funcionarios.countDocuments({ tenantId: tid, setorId: sid }),
);
print(
  'funcionarios tenant $in: ' +
    db.funcionarios.countDocuments({
      tenantId: { $in: [tid, '6a5b7c0e346d46c6d2fe09b6'] },
    }),
);
print(
  'setors tenant $in: ' +
    db.setors.countDocuments({
      tenantId: { $in: [tid, '6a5b7c0e346d46c6d2fe09b6'] },
    }),
);
print('all setors: ' + db.setors.countDocuments({}));

db.setors.find({ tenantId: tid }, { nome: 1, tipo: 1, parent: 1 }).forEach((s) => {
  print(s.nome + ' | ' + s.tipo + ' | parent=' + s.parent);
});
