#!/usr/bin/env node
import 'dotenv/config';
import { syncAllPharmacySources, syncPharmacySource } from '../src/lib/pharmacy/sync.js';
import { prisma } from '../src/lib/prisma.js';

function parseArgs(argv) {
  const args = { source: 'ALL', maxPages: undefined };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--source=')) {
      args.source = a.slice('--source='.length).toUpperCase();
    } else if (a === '--source' && argv[i + 1]) {
      args.source = argv[i + 1].toUpperCase();
      i += 1;
    } else if (a.startsWith('--max-pages=')) {
      args.maxPages = parseInt(a.slice('--max-pages='.length), 10);
    } else if (a === '--max-pages' && argv[i + 1]) {
      args.maxPages = parseInt(argv[i + 1], 10);
      i += 1;
    }
  }
  return args;
}

async function main() {
  const { source, maxPages } = parseArgs(process.argv);
  const opts = {};
  if (maxPages) opts.maxPages = maxPages;

  if (source === 'ALL') {
    const result = await syncAllPharmacySources(opts);
    console.log('Sync complete:', result);
  } else {
    const result = await syncPharmacySource(source, opts);
    console.log('Sync complete:', result);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
