// AA Web Assistant entry point — built on JS SDK
// Requirements: 10.1, 10.4

export { init } from './core/init';
export type { InitOptions } from './types/channel';

import { init } from './core/init';

const AA = { init };

export { AA };

// Expose as window.AA for UMD/IIFE usage
if (typeof window !== 'undefined') {
  (window as any).AA = AA;
}
