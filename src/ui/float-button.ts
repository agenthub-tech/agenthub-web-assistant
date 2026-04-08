// FloatButton — 悬浮入口按钮
// 需求：19.1、19.2、19.3、19.4、19.5、19.6、19.7、19.8

export interface FloatButtonConfig {
  position: 'bottom-right' | 'bottom-left';
  color: string;
  icon_url?: string;
}

export type FloatButtonState = 'open' | 'closed' | 'running';

const DEFAULT_CONFIG: FloatButtonConfig = {
  position: 'bottom-right',
  color: '#6366F1',
};

const AA_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
  <rect x="2" y="6" width="24" height="16" rx="4" fill="white" opacity="0.9"/>
  <text x="14" y="18" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#6366F1" text-anchor="middle">AA</text>
</svg>`;

const PULSE_STYLE_ID = 'aa-sdk-pulse-style';

function injectPulseStyles(): void {
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.setAttribute('data-aa-sdk', 'true');
  style.textContent = `
@keyframes aa-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.6); }
  70%  { box-shadow: 0 0 0 12px rgba(99, 102, 241, 0); }
  100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
}
.aa-float-btn-pulse {
  animation: aa-pulse 1.4s ease-in-out infinite;
}
`;
  document.head.appendChild(style);
}

export class FloatButton {
  private el: HTMLButtonElement;
  private iconEl: HTMLSpanElement;
  private config: FloatButtonConfig;
  private state: FloatButtonState = 'closed';

  constructor(config: FloatButtonConfig, onToggle: () => void) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    injectPulseStyles();

    this.el = document.createElement('button');
    this.el.setAttribute('data-aa-sdk', 'true');
    this.el.setAttribute('aria-label', 'AA 助手');

    this.iconEl = document.createElement('span');
    this.iconEl.setAttribute('data-aa-sdk', 'true');
    this.iconEl.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;pointer-events:none;';
    this.el.appendChild(this.iconEl);

    this.applyBaseStyles();
    this.applyConfig(this.config);

    this.el.addEventListener('click', () => onToggle());

    document.body.appendChild(this.el);
  }

  private applyBaseStyles(): void {
    this.el.style.cssText = `
      position: fixed;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      outline: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      bottom: 24px;
    `;
  }

  private applyConfig(config: FloatButtonConfig): void {
    // Apply color
    this.el.style.backgroundColor = config.color;

    // Apply position
    if (config.position === 'bottom-left') {
      this.el.style.left = '24px';
      this.el.style.right = '';
    } else {
      this.el.style.right = '24px';
      this.el.style.left = '';
    }

    // Apply icon
    if (config.icon_url) {
      this.iconEl.innerHTML = `<img src="${config.icon_url}" width="28" height="28" alt="" style="border-radius:50%;object-fit:cover;" data-aa-sdk="true" />`;
    } else {
      this.iconEl.innerHTML = AA_ICON_SVG;
    }
  }

  setState(state: FloatButtonState): void {
    this.state = state;

    if (state === 'running') {
      this.el.classList.add('aa-float-btn-pulse');
    } else {
      this.el.classList.remove('aa-float-btn-pulse');
    }
    // open/closed: no visual change to position/color per spec
  }

  updateConfig(config: FloatButtonConfig): void {
    this.config = { ...this.config, ...config };
    this.applyConfig(this.config);
  }

  getState(): FloatButtonState {
    return this.state;
  }

  getElement(): HTMLButtonElement {
    return this.el;
  }
}
