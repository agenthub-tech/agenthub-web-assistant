/**
 * WebAA Web Assistant — standalone type declarations for third-party integration.
 *
 * Usage in your project:
 *
 * 1. Copy aa.esm.js (or aa.js) and aa.d.ts to your project (e.g. public/)
 * 2. Add a triple-slash reference or include aa.d.ts in your tsconfig
 *
 * Example (triple-slash):
 *   /// <reference path="./public/aa.d.ts" />
 *   AA.init({ channelKey: 'your-key' });
 *
 * Example (tsconfig include):
 *   { "include": ["src", "public/aa.d.ts"] }
 */

export interface UserIdentity {
  userId: string;
  name?: string;
  avatar?: string;
  metadata?: Record<string, unknown>;
}

export interface InitOptions {
  channelKey: string;
  apiBase?: string;
  user?: UserIdentity;
}

export interface AA {
  init(options: InitOptions): Promise<void>;
  identify(user: UserIdentity): Promise<void>;
  reset(): void;
}

export declare const AA: AA;

declare global {
  interface Window {
    AA: AA;
  }
  /** Available when loaded via `<script src="aa.js">` */
  const AA: AA;
}
