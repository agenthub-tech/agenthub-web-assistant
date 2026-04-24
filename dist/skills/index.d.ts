import type { SkillDefinition } from 'agenthub-sdk';
import type { PageScanner } from '../executor/page-scanner';
import type { DOMExecutor } from '../executor/dom-executor';
import type { DOMHighlight } from '../executor/dom-highlight';
import type { VirtualMouse } from '../executor/virtual-mouse';
import type { RunManager } from '../core/run-manager';
declare const PAGE_SKILL_SCHEMA: {
    type: string;
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                step_description: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
};
declare const DOM_SKILL_SCHEMA: {
    type: string;
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                step_description: {
                    type: string;
                    description: string;
                };
                action: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                el_id: {
                    type: string;
                    description: string;
                };
                value: {
                    type: string;
                    description: string;
                };
                direction: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                distance: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
};
declare const NAVIGATION_SKILL_SCHEMA: {
    type: string;
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                step_description: {
                    type: string;
                    description: string;
                };
                url: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
};
declare const CLIPBOARD_SKILL_SCHEMA: {
    type: string;
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                step_description: {
                    type: string;
                    description: string;
                };
                action: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                content: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
};
declare const PAGE_SKILL_PROMPT = "- \u6BCF\u6B21\u64CD\u4F5C\u524D\u5FC5\u987B\u5148\u8C03\u7528 page_skill \u786E\u8BA4\u5F53\u524D\u9875\u9762\u72B6\u6001\n- \u4E0D\u786E\u5B9A\u76EE\u6807\u5143\u7D20\u65F6\uFF0C\u4F18\u5148\u7528 page_skill \u626B\u63CF\uFF0C\u4E0D\u8981\u76F2\u76EE\u64CD\u4F5C\n- \u8868\u683C\u5185\u7684\u5143\u7D20\u4F1A\u643A\u5E26 table \u5B57\u6BB5\uFF08row/col/header\uFF09\uFF0C\u7528 header \u5339\u914D\u5217\u540D\uFF0C\u7528 row \u5B9A\u4F4D\u6570\u636E\u884C\n- \u8868\u5934\u5143\u7D20\uFF08role: \"columnheader\"\uFF09\u4E0D\u53EF\u7F16\u8F91\uFF0C\u8981\u64CD\u4F5C\u6570\u636E\u8BF7\u4F7F\u7528\u5BF9\u5E94\u884C\u7684\u5143\u7D20";
declare const DOM_SKILL_PROMPT = "- \u64CD\u4F5C\u5143\u7D20\u65F6\u53EA\u4F7F\u7528 el_id \u5F15\u7528\uFF0C\u4E0D\u8981\u81EA\u884C\u6784\u9020 CSS selector\n- \u6267\u884C DOM \u64CD\u4F5C\u524D\u786E\u4FDD\u76EE\u6807\u5143\u7D20\u5728\u6700\u65B0\u7684\u9875\u9762\u5FEB\u7167\u4E2D\u5B58\u5728\n- \u6EDA\u52A8\u9875\u9762\u67E5\u770B\u66F4\u591A\u5185\u5BB9\u65F6\uFF0C\u4F7F\u7528 dom_skill \u7684 scroll action\uFF0Cel_id \u4F20 \"window\"\uFF0Cdirection \u4F20 \"down\" \u6216 \"up\"\n- \u64CD\u4F5C\u8868\u683C\u65F6\uFF0C\u6839\u636E table.header \u5339\u914D\u5217\u540D\uFF0C\u6839\u636E table.row \u5B9A\u4F4D\u884C\uFF0C\u4E0D\u8981\u70B9\u51FB\u8868\u5934\uFF08role: \"columnheader\"\uFF09\n- \u5143\u7D20\u7684 events \u5B57\u6BB5\u5217\u51FA\u4E86\u5B9E\u9645\u7ED1\u5B9A\u7684\u4E8B\u4EF6\uFF08\u5982 click\u3001change\uFF09\uFF0C\u7528\u5B83\u5224\u65AD\u5143\u7D20\u7684\u771F\u5B9E\u4EA4\u4E92\u65B9\u5F0F\n- \u9009\u62E9\u8868\u683C\u884C\u65F6\uFF0C\u5BF9\u6BD4 table-row \u548C\u884C\u5185 radio/checkbox \u7684 events\uFF0C\u54EA\u4E2A\u6709 click \u4E8B\u4EF6\u5C31\u70B9\u54EA\u4E2A";
declare const NAVIGATION_SKILL_PROMPT = "- \u9875\u9762\u8DF3\u8F6C\u540E\u5FC5\u987B\u91CD\u65B0\u8C03\u7528 page_skill \u626B\u63CF\u9875\u9762\uFF0C\u4E0D\u80FD\u590D\u7528\u65E7\u7684\u5143\u7D20\u4FE1\u606F";
export interface SkillExecutorDeps {
    pageScanner: PageScanner;
    domExecutor: DOMExecutor;
    domHighlight: DOMHighlight;
    virtualMouse: VirtualMouse;
    runManager: RunManager;
}
export declare function buildWebSkills(deps: SkillExecutorDeps): SkillDefinition[];
export interface BuiltinSkillHandlerDeps {
    sdk: {
        registerLocalSkill: (name: string, execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>) => void;
    };
    chatPanel: {
        addConfirmMessage: (message: string, primaryColor: string, onResult: (confirmed: boolean) => void) => void;
        addInputMessage: (message: string, placeholder: string, inputType: 'text' | 'password', primaryColor: string, onSubmit: (value: string) => void) => void;
    };
    primaryColor: string;
}
export declare function registerBuiltinSkillHandlers(deps: BuiltinSkillHandlerDeps): void;
export { PAGE_SKILL_SCHEMA, DOM_SKILL_SCHEMA, NAVIGATION_SKILL_SCHEMA, CLIPBOARD_SKILL_SCHEMA, PAGE_SKILL_PROMPT, DOM_SKILL_PROMPT, NAVIGATION_SKILL_PROMPT, };
