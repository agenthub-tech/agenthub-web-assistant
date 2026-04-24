import { WebAASDK } from 'agenthub-sdk';
import type { InitOptions } from '../types/channel';
export declare function getSDKInstance(): WebAASDK | null;
export declare function init(options: InitOptions): Promise<void>;
