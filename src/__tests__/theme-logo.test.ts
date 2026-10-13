import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { init } from '../core/init';

const config = vi.hoisted(() => ({
  ui_theme: {
    float_button: { position: 'bottom-right', color: '#1677ff', icon_url: null as string | null },
    chat_panel: { primary_color: '#1677ff', logo_url: null as string | null },
  },
}));

vi.mock('agenthub-sdk', () => ({
  WebAASDK: class {
    channelConfig = config;
    async init() {}
    setDialogHandler() {}
    registerLocalSkill() {}
    onIdentify() {}
    onReset() {}
  },
}));

describe('configured assistant logos', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    sessionStorage.clear();
    config.ui_theme.float_button.icon_url = null;
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
});
