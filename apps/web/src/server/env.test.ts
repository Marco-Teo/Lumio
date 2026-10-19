import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './env';

describe('environment configuration', () => {
  it('provides a safe local default', () => {
    expect(parseEnvironment({}).APP_URL).toBe('http://localhost:3000');
  });

  it('accepts an explicit HTTP or HTTPS application URL', () => {
    expect(parseEnvironment({ APP_URL: 'https://lumio.example' }).APP_URL).toBe(
      'https://lumio.example',
    );
  });

  it.each(['not-a-url', '', 'ftp://lumio.example'])(
    'rejects invalid URL %j',
    (url) => {
      expect(() => parseEnvironment({ APP_URL: url })).toThrow(
        'Invalid environment configuration: APP_URL',
      );
    },
  );

  it('does not disclose invalid values in errors', () => {
    expect(() =>
      parseEnvironment({ APP_URL: 'private-invalid-value' }),
    ).toThrow(/^Invalid environment configuration: APP_URL$/);
  });
});
