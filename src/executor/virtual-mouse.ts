// VirtualMouse — 虚拟鼠标动画
// 需求：16.5、16.6、16.7、16.8

const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="#333" stroke-width="1.5"><path d="M4 2l16 10-7 1-4 7z"/></svg>`;

const CURSOR_STYLE_ID = 'aa-sdk-cursor-style';

function injectCursorStyles(): void {
  if (document.getElementById(CURSOR_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = CURSOR_STYLE_ID;
  style.setAttribute('data-aa-sdk', 'true');
  style.textContent = `
@keyframes aa-cursor-glow {
  0%   { filter: drop-shadow(0 0 6px rgba(255,107,107,0.9)) drop-shadow(0 0 12px rgba(255,107,107,0.5)); }
  20%  { filter: drop-shadow(0 0 6px rgba(255,217,61,0.9))  drop-shadow(0 0 12px rgba(255,217,61,0.5)); }
  40%  { filter: drop-shadow(0 0 6px rgba(107,203,119,0.9)) drop-shadow(0 0 12px rgba(107,203,119,0.5)); }
  60%  { filter: drop-shadow(0 0 6px rgba(77,150,255,0.9))  drop-shadow(0 0 12px rgba(77,150,255,0.5)); }
  80%  { filter: drop-shadow(0 0 6px rgba(199,125,255,0.9)) drop-shadow(0 0 12px rgba(199,125,255,0.5)); }
  100% { filter: drop-shadow(0 0 6px rgba(255,107,107,0.9)) drop-shadow(0 0 12px rgba(255,107,107,0.5)); }
}
`;
  document.head.appendChild(style);
}

export class VirtualMouse {
  private cursor: HTMLDivElement | null = null;
  private isAnimating = false;
  private queue: Array<{ x: number; y: number }> = [];

  private ensureCursor(): HTMLDivElement {
    if (!this.cursor) {
      injectCursorStyles();
      const el = document.createElement('div');
      el.setAttribute('data-aa-sdk', 'true');

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      el.style.cssText = `
        position: fixed;
        z-index: 999999;
        pointer-events: none;
        width: 28px;
        height: 28px;
        opacity: 0;
        transition: none;
        left: ${cx}px;
        top: ${cy}px;
        animation: aa-cursor-glow 2.5s linear infinite;
      `;
      el.innerHTML = CURSOR_SVG;
      document.body.appendChild(el);

      void el.offsetWidth;
      el.style.transition = 'left 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease';

      this.cursor = el;
    }
    return this.cursor;
  }

  private animate(x: number, y: number): void {
    const el = this.ensureCursor();
    this.isAnimating = true;

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'left' && e.propertyName !== 'top') return;
      el.removeEventListener('transitionend', onTransitionEnd);
      this.isAnimating = false;

      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.queue = [];
        this.animate(next.x, next.y);
      }
    };

    el.addEventListener('transitionend', onTransitionEnd);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    // 保底：600ms 后强制解锁（transition 时长 500ms + buffer）
    setTimeout(() => {
      if (this.isAnimating) {
        el.removeEventListener('transitionend', onTransitionEnd);
        this.isAnimating = false;
        if (this.queue.length > 0) {
          const next = this.queue.shift()!;
          this.queue = [];
          this.animate(next.x, next.y);
        }
      }
    }, 600);
  }

  moveTo(x: number, y: number): void {
    if (this.isAnimating) {
      this.queue = [{ x, y }];
      return;
    }
    this.animate(x, y);
  }

  // 在页面中央显示光标（任务开始时调用）
  show(): void {
    const el = this.ensureCursor();
    el.style.opacity = '1';
  }

  remove(): void {
    // 不销毁元素，只隐藏，下次 show() 从当前位置继续
    if (this.cursor) {
      this.cursor.style.opacity = '0';
    }
    this.isAnimating = false;
    this.queue = [];
  }
}
