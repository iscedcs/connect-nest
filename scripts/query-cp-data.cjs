const { PrismaClient } = require('./src/generated/prisma/client');
const db = new PrismaClient();

async function main() {
  const orgs = await db.cpOrganization.findMany({
    take: 5,
    select: { id: true, creatorAuthId: true, name: true },
  });
  console.log('=== CP Organizations ===');
  console.log(JSON.stringify(orgs, null, 2));

  const members = await db.cpWorkspaceMember.findMany({
    take: 5,
    select: { id: true, authUserId: true, role: true, workspaceId: true },
  });
  console.log('\n=== Workspace Members ===');
  console.log(JSON.stringify(members, null, 2));

  const workspaces = await db.cpWorkspace.findMany({
    take: 5,
    select: { id: true, name: true, slug: true, organizationId: true },
  });
  console.log('\n=== Workspaces ===');
  console.log(JSON.stringify(workspaces, null, 2));
}

main()
  .catch(e => console.error(e.message))
  .finally(() => db.$disconnect());
