export type StepState = 'running' | 'done';
export interface Step {
    tool_call_id: string;
    tool_name: string;
    label: string;
    state: StepState;
    startTime: number;
    endTime?: number;
}
export declare const TOOL_LABEL_MAP: Record<string, string>;
export declare class StepTracker {
    private container;
    private steps;
    private stepEls;
    constructor(container: HTMLElement);
    addStep(tool_call_id: string, tool_name: string, params?: Record<string, unknown>): void;
    completeStep(tool_call_id: string): void;
    getLastRunningStep(): string | null;
    clear(): void;
}
