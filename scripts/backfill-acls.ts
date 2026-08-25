/**
 * scripts/backfill-acls.ts
 *
 * One-shot script: walks every fileItem row and flips its Spaces object to private.
 *
 * Usage:
 *   pnpm backfill:acls
 *
 * Requirements:
 *   DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_ENDPOINT, DO_SPACES_BUCKET must be
 *   set in the environment (or in .env via dotenv).
 */

import 'dotenv/config';
import { S3Client, PutObjectAclCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const endpoint =
    process.env.DO_SPACES_ENDPOINT || process.env.AWS_S3_ENDPOINT;
  const region =
    process.env.DO_SPACES_REGION || process.env.AWS_REGION || 'us-east-1';
  const accessKeyId =
    process.env.DO_SPACES_KEY || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.DO_SPACES_SECRET || process.env.AWS_SECRET_ACCESS_KEY;
  const bucket =
    process.env.DO_SPACES_BUCKET ||
    process.env.AWS_S3_BUCKET ||
    'isce-connect-files';

  if (!accessKeyId || !secretAccessKey) {
    console.error(
      'ERROR: S3/Spaces credentials not found in environment. Set DO_SPACES_KEY and DO_SPACES_SECRET.',
    );
    process.exit(1);
  }

  const client = new S3Client({
    endpoint: endpoint || undefined,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log(`Connecting to database...`);
  const files = await prisma.fileItem.findMany({
    where: { storage_key: { not: null } },
    select: { id: true, storage_key: true, filename: true },
  });

  console.log(
    `Found ${files.length} file(s) with a storage_key. Starting ACL backfill...\n`,
  );

  let success = 0;
  let failure = 0;

  for (const file of files) {
    if (!file.storage_key) continue;
    try {
      await client.send(
        new PutObjectAclCommand({
          Bucket: bucket,
          Key: file.storage_key,
          ACL: 'private',
        }),
      );
      console.log(`  OK   ${file.storage_key}  (id: ${file.id})`);
      success++;
    } catch (err: any) {
      console.error(
        `  FAIL ${file.storage_key}  (id: ${file.id}) -- ${err.message}`,
      );
      failure++;
    }
  }

  console.log(`\n------------------------------------------`);
  console.log(
    `Backfill complete.  OK: ${success}  FAILED: ${failure}`,
  );
  console.log(`------------------------------------------`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
