// SessionManager — 跨页面任务状态持久化
// 需求：14.1、14.4、14.5

const SESSION_KEY = 'aa_task_state';
const SESSION_ID_KEY = 'aa_session_id';
const PASSIVE_NAV_KEY = 'aa_passive_nav';

export class SessionManager {
  /** JSON.stringify 后写入 sessionStorage */
  save(state: unknown): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  }

  /** JSON.parse，失败时删除 key 并返回 null，不抛出异常 */
  load(): unknown | null {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      console.warn('[SessionManager] Failed to parse aa_task_state, removing key.');
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  /** 删除 sessionStorage['aa_task_state']、'aa_session_id'、'aa_passive_nav' */
  clear(): void {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
    sessionStorage.removeItem(PASSIVE_NAV_KEY);
  }

  /** 检查 key 存在且值可被 JSON.parse 解析 */
  hasTask(): boolean {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw === null) return false;
    try {
      JSON.parse(raw);
      return true;
    } catch {
      return false;
    }
  }

  /** 写入 sessionStorage['aa_session_id'] */
  saveSessionId(sessionId: string): void {
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  /** 读取 sessionStorage['aa_session_id']，不存在时返回 null */
  loadSessionId(): string | null {
    return sessionStorage.getItem(SESSION_ID_KEY);
  }

  /** 删除 sessionStorage['aa_session_id'] */
  clearSessionId(): void {
    sessionStorage.removeItem(SESSION_ID_KEY);
  }
}
