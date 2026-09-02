#!/usr/bin/env node

import { copyFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'packages/host/dist/lcla-host.js');
const targets = [
  resolve(root, 'examples/blazor-server/wwwroot/lcla-host.js'),
  resolve(root, 'packages/clients/csharp/LightningChart.LA/Host/lcla-host.js'),
  resolve(root, 'packages/clients/flutter/lightning_chart_flutter/assets/lcla-host.js'),
];

for (const target of targets) {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`Copied ${source} -> ${target}`);
}
