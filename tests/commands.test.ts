import { describe, expect, it } from 'vitest';
import config from '../wxt.config';

describe('capture keyboard shortcut', () => {
  it('declares platform defaults without additional permissions', () => {
    expect(config.manifest).toMatchObject({
      commands: {
        'toggle-tab-capture': {
          suggested_key: { default: 'Ctrl+Shift+V', mac: 'Command+Shift+V' },
          description: 'Start or stop tab audio capture',
        },
      },
      permissions: ['tabCapture', 'activeTab', 'storage'],
    });
  });
});
