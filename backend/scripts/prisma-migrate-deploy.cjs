const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const candidates = [
  join(process.cwd(), 'prisma', 'schema.prisma'),
  join(process.cwd(), 'backend', 'prisma', 'schema.prisma'),
  join(__dirname, '..', 'prisma', 'schema.prisma'),
];

const schema = candidates.find((p) => existsSync(p));
if (!schema) {
  console.error('[prisma-migrate] schema.prisma not found');
  process.exit(1);
}

console.log('[prisma-migrate] deploy with schema:', schema);
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'migrate', 'deploy', '--schema', schema],
  { stdio: 'inherit', shell: true, env: process.env },
);
process.exit(result.status === null ? 1 : result.status);
