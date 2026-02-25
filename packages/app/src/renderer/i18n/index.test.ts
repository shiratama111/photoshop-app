import { afterEach, describe, expect, it } from 'vitest';
import { en, ja } from './messages';
import { getLocale, setLocale, t } from './index';

describe('renderer i18n', () => {
  afterEach((): void => {
    setLocale('ja');
  });

  it('uses Japanese locale by default', () => {
    expect(getLocale()).toBe('ja');
    expect(t('menu.file')).toBe('ファイル');
  });

  it('falls back to English when key is missing in active locale', () => {
    const key = '__test.fallback__';
    en[key] = 'English fallback value';
    delete ja[key];

    setLocale('ja');
    expect(t(key)).toBe('English fallback value');

    delete en[key];
  });

  it('returns raw key when missing in all locales', () => {
    setLocale('ja');
    expect(t('__test.missing__')).toBe('__test.missing__');
  });
});
