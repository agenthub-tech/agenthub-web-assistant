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
                query: {
                    type: string;
                    description: string;
                };
                block_id: {
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
declare const PAGE_SKILL_PROMPT = "- \u6BCF\u6B21\u64CD\u4F5C\u524D\u5FC5\u987B\u5148\u8C03\u7528 page_skill \u786E\u8BA4\u5F53\u524D\u9875\u9762\u72B6\u6001\n- \u4E09\u79CD\u4F7F\u7528\u65B9\u5F0F\uFF1A\n  1. \u641C\u7D22\uFF08query=\"\u5173\u952E\u8BCD\"\uFF09\uFF1A\u76F4\u8FBE\u76F8\u5173\u5143\u7D20\u2014\u2014\u77E5\u9053\u76EE\u6807\u662F\u4EC0\u4E48\u65F6\u4F18\u5148\u7528\u641C\u7D22\uFF08\u5982 query=\"\u4FEE\u6539\"\u3001query=\"xxx\"\u3001query=\"\u586B\u62A5\u4EBA\"\uFF09\uFF0C\u652F\u6301\u591A\u5173\u952E\u8BCD\u7A7A\u683C\u5206\u9694\uFF08AND \u8BED\u4E49\uFF09\n  2. \u603B\u89C8\uFF08\u4E0D\u5E26\u53C2\u6570\uFF09\uFF1A\u770B page_outline\uFF08\u9875\u9762\u6A21\u5757\u7ED3\u6784\uFF09\u3001regions\uFF08\u9875\u9762\u533A\u57DF\u5212\u5206\uFF09\u3001data_tables/charts/text_blocks\uFF08\u5185\u5BB9\u5757\u6458\u8981\uFF09\u2014\u2014\u4E0D\u4E86\u89E3\u9875\u9762\u7ED3\u6784\u65F6\u7528\n  3. \u6DF1\u5165\uFF08block_id=region_001/el_xxxx/table_001/chart_001/text_001\uFF09\uFF1A\u67E5\u770B\u533A\u57DF\u5143\u7D20\u5217\u8868\u3001\u5143\u7D20\u5B8C\u6574\u5185\u5BB9\u3001\u8868\u683C\u5168\u90E8\u884C\u3001\u56FE\u8868\u6570\u636E\u3001\u6587\u672C\u5168\u6587\n- \u5DE5\u4F5C\u6D41\u5EFA\u8BAE\uFF1A\u5148\u641C\u7D22\u627E\u76EE\u6807\u5143\u7D20 \u2192 \u627E\u4E0D\u5230\u518D\u603B\u89C8\u770B\u7ED3\u6784 \u2192 \u6DF1\u5165\u533A\u57DF/\u5143\u7D20\u786E\u8BA4\u7EC6\u8282 \u2192 \u6267\u884C\u64CD\u4F5C\n- \u9700\u8981\u8BFB\u53D6\u9875\u9762\u6570\u636E\u65F6\u4F18\u5148\u7528\u6458\u8981\u548C block_id\uFF0C\u4E0D\u8981\u901A\u8FC7\u70B9\u51FB\u7F16\u8F91\u6309\u94AE\u6216\u6EDA\u52A8\u53BB\u5BFB\u627E\u5185\u5BB9\n- \u8868\u683C\u5185\u7684\u5143\u7D20\u4F1A\u643A\u5E26 table \u5B57\u6BB5\uFF08row/col/header\uFF09\uFF0C\u7528 header \u5339\u914D\u5217\u540D\uFF0C\u7528 row \u5B9A\u4F4D\u6570\u636E\u884C\n- \u8868\u5934\u5143\u7D20\uFF08role: \"columnheader\"\uFF09\u4E0D\u53EF\u7F16\u8F91\uFF0C\u8981\u64CD\u4F5C\u6570\u636E\u8BF7\u4F7F\u7528\u5BF9\u5E94\u884C\u7684\u5143\u7D20\n- el_id \u662F\u7A33\u5B9A\u6807\u8BC6\uFF08\u57FA\u4E8E\u5143\u7D20 selector \u7684 hash\uFF09\uFF0C\u540C\u4E00\u5143\u7D20\u591A\u6B21\u626B\u63CF id \u4E0D\u53D8";
declare const DOM_SKILL_PROMPT = "- \u64CD\u4F5C\u5143\u7D20\u65F6\u53EA\u4F7F\u7528 el_id \u5F15\u7528\uFF0C\u4E0D\u8981\u81EA\u884C\u6784\u9020 CSS selector\n- \u6267\u884C DOM \u64CD\u4F5C\u524D\u786E\u4FDD\u76EE\u6807\u5143\u7D20\u5728\u6700\u65B0\u7684\u9875\u9762\u5FEB\u7167\u4E2D\u5B58\u5728\n- \u6EDA\u52A8\u9875\u9762\u67E5\u770B\u66F4\u591A\u5185\u5BB9\u65F6\uFF0C\u4F7F\u7528 dom_skill \u7684 scroll action\uFF0Cel_id \u4F20 \"window\"\uFF0Cdirection \u4F20 \"down\" \u6216 \"up\"\n- \u64CD\u4F5C\u8868\u683C\u65F6\uFF0C\u6839\u636E table.header \u5339\u914D\u5217\u540D\uFF0C\u6839\u636E table.row \u5B9A\u4F4D\u884C\uFF0C\u4E0D\u8981\u70B9\u51FB\u8868\u5934\uFF08role: \"columnheader\"\uFF09\n- \u5143\u7D20\u7684 events \u5B57\u6BB5\u5217\u51FA\u4E86\u5B9E\u9645\u7ED1\u5B9A\u7684\u4E8B\u4EF6\uFF08\u5982 click\u3001change\uFF09\uFF0C\u7528\u5B83\u5224\u65AD\u5143\u7D20\u7684\u771F\u5B9E\u4EA4\u4E92\u65B9\u5F0F\n- \u9009\u62E9\u8868\u683C\u884C\u65F6\uFF0C\u5BF9\u6BD4 table-row \u548C\u884C\u5185 radio/checkbox \u7684 events\uFF0C\u54EA\u4E2A\u6709 click \u4E8B\u4EF6\u5C31\u70B9\u54EA\u4E2A\n- \u70B9\u51FB\u540E\u5982\u679C\u6CA1\u53CD\u5E94\uFF0C\u5148\u8C03 page_skill \u91CD\u65B0\u626B\u63CF\u786E\u8BA4\u9875\u9762\u72B6\u6001\u53D8\u5316\uFF0C\u4E0D\u8981\u76F2\u76EE\u91CD\u8BD5\n- \u4E0D\u786E\u5B9A\u5143\u7D20\u600E\u4E48\u4EA4\u4E92\u65F6\uFF0C\u5148\u7528 page_skill(block_id=el_xxxx) \u67E5\u770B\u5143\u7D20\u7684\u5B8C\u6574\u5185\u5BB9\uFF08outerHTML\u3001\u4E8B\u4EF6\u3001\u8BA1\u7B97\u6837\u5F0F\uFF09\uFF0C\u518D\u51B3\u5B9A\u600E\u4E48\u64CD\u4F5C";
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
}
export declare function registerBuiltinSkillHandlers(deps: BuiltinSkillHandlerDeps): void;
export { PAGE_SKILL_SCHEMA, DOM_SKILL_SCHEMA, NAVIGATION_SKILL_SCHEMA, CLIPBOARD_SKILL_SCHEMA, PAGE_SKILL_PROMPT, DOM_SKILL_PROMPT, NAVIGATION_SKILL_PROMPT, };
