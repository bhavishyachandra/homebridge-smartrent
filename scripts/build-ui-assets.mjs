#!/usr/bin/env node
/**
 * Copies the custom Homebridge UI static assets from src/ui/public into
 * dist/ui/public so the published tarball contains everything the
 * config-ui-x server fork needs (server.js + public/).
 */
import { cpSync, existsSync } from 'node:fs';

const SRC = 'src/ui/public';
const DEST = 'dist/ui/public';

if (!existsSync(SRC)) {
  console.error(`build-ui-assets: source directory "${SRC}" does not exist`);
  process.exit(1);
}

cpSync(SRC, DEST, { recursive: true });
console.log(`build-ui-assets: copied ${SRC} → ${DEST}`);
