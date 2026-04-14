// RunManager — 跨页面任务状态持久化
// 需求：14.1、14.4、14.5

const TASK_STATE_KEY = 'aa_task_state';
const RUN_ID_KEY = 'aa_run_id';
const PASSIVE_NAV_KEY = 'aa_passive_nav';
const THREAD_ID_KEY = 'aa_thread_id';

export class RunManager {
  /** JSON.stringify 后写入 sessionStorage */
  save(state: unknown): void {
    sessionStorage.setItem(TASK_STATE_KEY, JSON.stringify(state));
  }

  /** JSON.parse，失败时删除 key 并返回 null，不抛出异常 */
  load(): unknown | null {
    const raw = sessionStorage.getItem(TASK_STATE_KEY);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      console.warn('[RunManager] Failed to parse aa_task_state, removing key.');
      sessionStorage.removeItem(TASK_STATE_KEY);
      return null;
    }
  }

  /** 删除 sessionStorage['aa_task_state']、'aa_run_id'、'aa_passive_nav'、'aa_thread_id' */
  clear(): void {
    sessionStorage.removeItem(TASK_STATE_KEY);
    sessionStorage.removeItem(RUN_ID_KEY);
    sessionStorage.removeItem(PASSIVE_NAV_KEY);
    sessionStorage.removeItem(THREAD_ID_KEY);
  }

  /** 检查 key 存在且值可被 JSON.parse 解析 */
  hasTask(): boolean {
    const raw = sessionStorage.getItem(TASK_STATE_KEY);
    if (raw === null) return false;
    try {
      JSON.parse(raw);
      return true;
    } catch {
      return false;
    }
  }

  /** 写入 sessionStorage['aa_run_id'] */
  saveRunId(runId: string): void {
    sessionStorage.setItem(RUN_ID_KEY, runId);
  }

  /** 读取 sessionStorage['aa_run_id']，不存在时返回 null */
  loadRunId(): string | null {
    return sessionStorage.getItem(RUN_ID_KEY);
  }

  /** 删除 sessionStorage['aa_run_id'] */
  clearRunId(): void {
    sessionStorage.removeItem(RUN_ID_KEY);
  }

  /** 写入 sessionStorage['aa_thread_id'] */
  saveThreadId(threadId: string): void {
    sessionStorage.setItem(THREAD_ID_KEY, threadId);
  }

  /** 读取 sessionStorage['aa_thread_id']，不存在时返回 null */
  loadThreadId(): string | null {
    return sessionStorage.getItem(THREAD_ID_KEY);
  }

  /** 删除 sessionStorage['aa_thread_id'] */
  clearThreadId(): void {
    sessionStorage.removeItem(THREAD_ID_KEY);
  }
}
