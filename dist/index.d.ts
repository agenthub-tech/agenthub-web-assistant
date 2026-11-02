import { getSDKInstance } from './core/init';
import type { InitOptions, UserIdentity } from './types/channel';
declare function init(options: InitOptions): Promise<void>;
declare function identify(user: UserIdentity): Promise<void>;
declare function reset(): void;
export declare const AA: {
    init: typeof init;
    identify: typeof identify;
    reset: typeof reset;
};
export { getSDKInstance };
export type { InitOptions };
