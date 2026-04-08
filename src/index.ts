// AA Web Assistant entry point — built on JS SDK
// Requirements: 10.1, 10.4

export { init } from './core/init';
export { getSDKInstance } from './core/init';
export type { InitOptions } from './types/channel';

import { init, getSDKInstance } from './core/init';

async function identify(user: { userId: string; name?: string; avatar?: string; metadata?: Record<string, unknown> }) {
  const sdk = getSDKInstance();
  if (sdk) {
    await sdk.identify(user);
  } else {
    console.warn('[AA] SDK not initialized. Call AA.init() first.');
  }
}

const AA = { init, identify };

export { AA };

// Expose as window.AA for UMD/IIFE usage
if (typeof window !== 'undefined') {
  (window as any).AA = AA;
}
