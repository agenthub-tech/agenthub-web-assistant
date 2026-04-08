import * as esbuild from 'esbuild';
import path from 'path';
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
  alias: {
    '@webaa/sdk': path.resolve(__dirname, '../../sdks/js/src/index.ts'),
  },
  // Resolve node_modules from this package's directory for the SDK source
  nodePaths: [path.resolve(__dirname, 'node_modules')],
};

// IIFE bundle — for <script> tag usage (window.AA)
await esbuild.build({
  ...common,
  outfile: 'dist/aa.js',
  format: 'iife',
  globalName: 'AA',
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
  globalName: 'AA',
  minify: true,
  sourcemap: false,
});

console.log('Build complete: dist/aa.js (iife) | dist/aa.esm.js (esm) | dist/aa.min.js (minified)');
