// DOM 元素与扫描结果类型定义
// 需求：4.3、4.4、4.5、4.6

export interface TableContext {
  row: number;          // 数据行号（从 1 开始，表头不计入）
  col: number;          // 列号（从 1 开始）
  header: string;       // 对应的表头文本
}

export interface DOMElement {
  id: string;           // "el_001"
  type: string;         // "button" | "input" | "textarea" | "select" | "a" | "table-row" | ...
  text: string | null;  // 可见文本，最多 100 字符
  selector: string;     // 唯一 CSS selector
  visible: boolean;
  placeholder?: string; // input/textarea 专有
  href?: string;        // a 标签专有
  table?: TableContext;  // 表格内元素的行列上下文
  label?: string;       // 关联的 label 文本（通过 aria-label、label[for]、父级 label 等）
  role?: string;        // 语义角色（表头元素标记为 "columnheader"）
  events?: string[];    // 绑定的事件类型（如 ["click", "change"]）
}

export interface ScanResult {
  elements: DOMElement[];
  truncated: boolean;
}
