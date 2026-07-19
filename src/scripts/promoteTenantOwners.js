/**
 * Promote the earliest admin of each tenant to owner.
 * Safe to re-run: tenants that already have an owner are skipped.
 *
 * Usage: npm run migrate:owners
 */
require('dotenv').config();

const User = require('../models/usuariosSchema');

async function main() {
  console.log('Promoting earliest admin per tenant → owner...');

  const tenantsWithOwner = await User.distinct('tenantId', {
    role: 'owner',
    tenantId: { $ne: null },
  });
  const ownerSet = new Set(tenantsWithOwner.map(String));

  const admins = await User.find({
    role: 'admin',
    tenantId: { $ne: null },
  })
    .sort({ createdAt: 1 })
    .lean();

  let promoted = 0;
  for (const admin of admins) {
    const tid = String(admin.tenantId);
    if (ownerSet.has(tid)) continue;

    await User.updateOne({ _id: admin._id }, { $set: { role: 'owner' } });
    ownerSet.add(tid);
    promoted += 1;
    console.log(
      `  ${admin.username} (${admin.id}) → owner [tenant ${tid}]`
    );
  }

  console.log(`Done. Promoted ${promoted} user(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
