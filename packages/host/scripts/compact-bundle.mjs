#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { transformSync } from 'esbuild';
import { resolve } from 'path';

const bundlePath = resolve(process.cwd(), 'dist/lcla-host.js');
const source = readFileSync(bundlePath, 'utf8');

const result = transformSync(source, {
  loader: 'js',
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  target: 'es2015',
  supported: {
    'template-literal': false,
  },
});

writeFileSync(bundlePath, result.code);
