import { env } from './env.js';
import app from './app.js';
import { prisma } from './db.js';

const port = env.PORT;

async function start() {
  await prisma.$connect();
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

start().catch((e) => {
  console.error('Failed to start server', e);
  process.exit(1);
});
