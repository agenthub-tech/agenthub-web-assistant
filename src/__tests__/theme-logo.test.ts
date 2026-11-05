import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { init } from '../core/init';

const config = vi.hoisted(() => ({
  ui_theme: {
    float_button: {
      position: 'bottom-right', color: '#1677ff', icon_url: null as string | null,
      background_transparent: undefined as boolean | undefined,
      shadow_enabled: undefined as boolean | undefined,
    },
    chat_panel: { primary_color: '#1677ff', logo_url: null as string | null },
  },
}));
const sdkInit = vi.hoisted(() => vi.fn());

vi.mock('agenthub-sdk', () => ({
  WebAASDK: class {
    channelConfig = config;
    async init(options: unknown) { sdkInit(options); }
    setDialogHandler() {}
    registerLocalSkill() {}
    onIdentify() {}
    onReset() {}
  },
}));

describe('configured assistant logos', () => {
  beforeEach(() => {
    sdkInit.mockClear();
    document.body.replaceChildren();
    sessionStorage.clear();
    config.ui_theme.float_button.icon_url = null;
    config.ui_theme.float_button.background_transparent = undefined;
    config.ui_theme.float_button.shadow_enabled = undefined;
    config.ui_theme.chat_panel.logo_url = 'https://example.com/logo.png';
    vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('uses an existing panel logo for the floating button when icon_url is null', async () => {
    await init({ channelKey: 'test', apiBase: 'https://example.com' });
    expect(document.querySelector('button[aria-label="AA 助手"] img')?.getAttribute('src')).toBe(config.ui_theme.chat_panel.logo_url);
    expect(document.querySelector('img[alt="Logo"]')?.getAttribute('src')).toBe(config.ui_theme.chat_panel.logo_url);
  });

  it('passes the domain account through assistant initialization', async () => {
    await init({ channelKey: 'test', apiBase: 'https://example.com', user: { userId: 'employee-123', account: 'alice' } });
    expect(sdkInit).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ userId: 'employee-123', account: 'alice' }) }));
  });

  it('preserves an explicitly configured floating icon', async () => {
    config.ui_theme.float_button.icon_url = 'https://example.com/icon.png';
    await init({ channelKey: 'test', apiBase: 'https://example.com' });
    expect(document.querySelector('button[aria-label="AA 助手"] img')?.getAttribute('src')).toBe(config.ui_theme.float_button.icon_url);
  });

  it('falls back to default icons when the image fails to load', async () => {
    await init({ channelKey: 'test', apiBase: 'https://example.com' });
    const icon = document.querySelector('button[aria-label="AA 助手"] img')!;
    const logo = document.querySelector('img[alt="Logo"]')!;
    const logoContainer = logo.parentElement!;
    icon.dispatchEvent(new Event('error'));
    logo.dispatchEvent(new Event('error'));
    expect(document.querySelector('button[aria-label="AA 助手"] svg')).not.toBeNull();
    expect(logoContainer.querySelector('svg')).not.toBeNull();
  });

  it('uses default icons after the logo is removed', async () => {
    config.ui_theme.chat_panel.logo_url = null;
    await init({ channelKey: 'test', apiBase: 'https://example.com' });
    expect(document.querySelector('button[aria-label="AA 助手"] img')).toBeNull();
    expect(document.querySelector('img[alt="Logo"]')).toBeNull();
  });

  it.each([
    [undefined, undefined],
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])('loads independent icon background and shadow settings (%s, %s)', async (transparent, shadow) => {
    config.ui_theme.float_button.background_transparent = transparent;
    config.ui_theme.float_button.shadow_enabled = shadow;
    await init({ channelKey: 'test', apiBase: 'https://example.com' });
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="AA 助手"]')!;
    expect(button.style.backgroundColor).toBe(transparent ? 'transparent' : 'rgb(22, 119, 255)');
    expect(button.style.filter).toBe(shadow ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.24))' : 'none');
    expect(button.querySelector('img')?.getAttribute('src')).toBe(config.ui_theme.chat_panel.logo_url);
  });

  it('reopens the same conversation from the floating icon after closing the panel', async () => {
    await init({ channelKey: 'test', apiBase: 'https://example.com' });
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="AA 助手"]')!;
    const close = document.querySelector<HTMLButtonElement>('button[aria-label="关闭对话框"]')!;
    const panel = close.parentElement!.parentElement!;
    const input = panel.querySelector('textarea')!;
    button.click();
    input.value = '未发送的草稿';
    close.click();
    expect(panel.style.display).toBe('none');
    button.click();
    expect(panel.style.display).toBe('flex');
    expect(panel.querySelector('textarea')).toBe(input);
    expect(input.value).toBe('未发送的草稿');
  });
});
