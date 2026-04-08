// TaskBorder — 任务执行中的页面边框高亮

const STYLE_ID = 'aa-sdk-task-border-style';
const BORDER_ID = 'aa-sdk-task-border';

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.setAttribute('data-aa-sdk', 'true');
  style.textContent = `
@keyframes aa-glow-cycle {
  0%   { box-shadow: inset 0 0 10px 4px rgba(255,107,107,0.8), inset 0 0 4px 1px rgba(255,107,107,0.4); }
  20%  { box-shadow: inset 0 0 10px 4px rgba(255,217,61,0.8),  inset 0 0 4px 1px rgba(255,217,61,0.4); }
  40%  { box-shadow: inset 0 0 10px 4px rgba(107,203,119,0.8), inset 0 0 4px 1px rgba(107,203,119,0.4); }
  60%  { box-shadow: inset 0 0 10px 4px rgba(77,150,255,0.8),  inset 0 0 4px 1px rgba(77,150,255,0.4); }
  80%  { box-shadow: inset 0 0 10px 4px rgba(199,125,255,0.8), inset 0 0 4px 1px rgba(199,125,255,0.4); }
  100% { box-shadow: inset 0 0 10px 4px rgba(255,107,107,0.8), inset 0 0 4px 1px rgba(255,107,107,0.4); }
}
@keyframes aa-border-fadein {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes aa-border-fadeout {
  from { opacity: 1; }
  to   { opacity: 0; }
}
#${BORDER_ID} {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 999998;
  animation: aa-glow-cycle 2.5s linear infinite;
}
`;
  document.head.appendChild(style);
}

export class TaskBorder {
  private el: HTMLDivElement | null = null;
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null;

  show(): void {
    injectStyles();

    if (this.fadeOutTimer !== null) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }

    if (!this.el) {
      const el = document.createElement('div');
      el.id = BORDER_ID;
      el.setAttribute('data-aa-sdk', 'true');
      document.body.appendChild(el);
      this.el = el;
    }

    this.el.style.opacity = '1';
    this.el.style.animation = `aa-glow-cycle 2.5s linear infinite`;
  }

  hide(): void {
    if (!this.el) return;
    const el = this.el;
    el.style.animation = 'aa-border-fadeout 0.6s ease forwards';
    this.fadeOutTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.animation = '';
      this.fadeOutTimer = null;
    }, 600);
  }
}
