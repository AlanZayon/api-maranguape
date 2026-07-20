import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { User } from '../modules/auth/schemas/user.schema';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  console.log('Promoting earliest admin per tenant → owner...');

  const tenantsWithOwner = await userModel.distinct('tenantId', {
    role: 'owner',
    tenantId: { $ne: null },
  });
  const ownerSet = new Set(tenantsWithOwner.map(String));

  const admins = await userModel
    .find({ role: 'admin', tenantId: { $ne: null } })
    .sort({ createdAt: 1 })
    .lean();

  let promoted = 0;
  for (const admin of admins) {
    const tid = String(admin.tenantId);
    if (ownerSet.has(tid)) continue;

    await userModel.updateOne({ _id: admin._id }, { $set: { role: 'owner' } });
    ownerSet.add(tid);
    promoted += 1;
    console.log(
      `  ${admin.username} (${admin.id}) → owner [tenant ${tid}]`,
    );
  }

  console.log(`Done. Promoted ${promoted} user(s).`);
  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
