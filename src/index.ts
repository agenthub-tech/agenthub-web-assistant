// AA Web Assistant — shared core logic
// Used by both IIFE (index-iife.ts) and ESM (index-esm.ts) entry points

import { init as _initInternal, getSDKInstance } from './core/init';
import type { InitOptions } from './types/channel';

let _initPromise: Promise<void> | null = null;

function init(options: InitOptions): Promise<void> {
  _initPromise = _initInternal(options);
  return _initPromise;
}

/** Wait for init to finish (swallow errors — init handles its own error UI). */
async function _waitInit(): Promise<void> {
  if (_initPromise) {
    try { await _initPromise; } catch { /* init shows error in ChatPanel */ }
  }
}

async function identify(user: { userId: string; name?: string; avatar?: string; metadata?: Record<string, unknown> }) {
  await _waitInit();
  const sdk = getSDKInstance();
  if (sdk) {
    await sdk.identify(user);
  } else {
    console.warn('[AA] SDK not initialized. Call AA.init() first.');
  }
}

function reset() {
  const sdk = getSDKInstance();
  if (sdk) {
    sdk.reset();
  }
}

export const AA = { init, identify, reset };
export { getSDKInstance };
export type { InitOptions };

// Expose as window.AA for IIFE/script-tag usage
if (typeof window !== 'undefined') {
  (window as any).AA = AA;
}
