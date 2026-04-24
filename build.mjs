import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE_URL = 'http://192.168.101.173:30103';

const common = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'browser',
  target: ['es2017'],
  sourcemap: true,
  define: {
    __AA_API_BASE__: JSON.stringify(API_BASE_URL),
  },
  // Resolve node_modules from this package's directory
  nodePaths: [path.resolve(__dirname, 'node_modules')],
};

// IIFE bundle — for <script> tag usage (window.AA set inside code)
await esbuild.build({
  ...common,
  outfile: 'dist/aa.js',
  format: 'iife',
  minify: false,
});

// ESM bundle — for npm / import usage
await esbuild.build({
  ...common,
  outfile: 'dist/aa.esm.js',
  format: 'esm',
  minify: false,
});

// Minified IIFE — for CDN production
await esbuild.build({
  ...common,
  outfile: 'dist/aa.min.js',
  format: 'iife',
  minify: true,
  sourcemap: false,
});

console.log('Build complete: dist/aa.js (iife) | dist/aa.esm.js (esm) | dist/aa.min.js (minified)');

// Copy standalone type declaration for third-party integration
fs.copyFileSync(
  path.resolve(__dirname, 'src/aa.d.ts'),
  path.resolve(__dirname, 'dist/aa.d.ts'),
);
console.log('Copied: dist/aa.d.ts (standalone type declarations)');
