export declare class RunManager {
    /** JSON.stringify 后写入 sessionStorage */
    save(state: unknown): void;
    /** JSON.parse，失败时删除 key 并返回 null，不抛出异常 */
    load(): unknown | null;
    /** 删除 sessionStorage['aa_task_state']、'aa_run_id'、'aa_passive_nav'、'aa_thread_id' */
    clear(): void;
    /** 检查 key 存在且值可被 JSON.parse 解析 */
    hasTask(): boolean;
    /** 写入 sessionStorage['aa_run_id'] */
    saveRunId(runId: string): void;
    /** 读取 sessionStorage['aa_run_id']，不存在时返回 null */
    loadRunId(): string | null;
    /** 删除 sessionStorage['aa_run_id'] */
    clearRunId(): void;
    /** 写入 sessionStorage['aa_thread_id'] */
    saveThreadId(threadId: string): void;
    /** 读取 sessionStorage['aa_thread_id']，不存在时返回 null */
    loadThreadId(): string | null;
    /** 删除 sessionStorage['aa_thread_id'] */
    clearThreadId(): void;
}
