/**
 * Expo launcher.
 *
 * Cursor's integrated terminal exports CI=1. The Expo CLI reads that as "non-interactive",
 * which suppresses the QR code and turns off Metro's file watching, so edits never
 * hot-reload. Stripping it here keeps `npm start` behaving the same inside and outside
 * the IDE. Every argument is forwarded, so `--lan`, `--clear`, `--web` all still work.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const cli = createRequire(import.meta.url).resolve('expo/bin/cli');

const env = { ...process.env };
delete env.CI;

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
