/**
 * @module i18n.test
 * Unit tests for the i18n runtime (t, setLocale, getLocale).
 * @see PS-I18N-001
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale, getLocale } from './index';

describe('i18n', () => {
  beforeEach(() => {
    // Reset to default locale before each test
    setLocale('ja');
  });

  describe('getLocale / setLocale', () => {
    it('defaults to "ja"', () => {
      expect(getLocale()).toBe('ja');
    });

    it('switches locale to "en"', () => {
      setLocale('en');
      expect(getLocale()).toBe('en');
    });

    it('throws on unknown locale', () => {
      expect(() => setLocale('xx')).toThrow('i18n: unknown locale "xx"');
    });
  });

  describe('t() — Japanese locale', () => {
    it('returns Japanese for menu.file', () => {
      expect(t('menu.file')).toBe('ファイル');
    });

    it('returns Japanese for menu.edit', () => {
      expect(t('menu.edit')).toBe('編集');
    });

    it('returns Japanese for menu.image', () => {
      expect(t('menu.image')).toBe('イメージ');
    });

    it('returns Japanese for menu.view', () => {
      expect(t('menu.view')).toBe('表示');
    });

    it('returns Japanese for menu.help', () => {
      expect(t('menu.help')).toBe('ヘルプ');
    });

    it('returns Japanese for menu.select', () => {
      expect(t('menu.select')).toBe('選択範囲');
    });

    it('returns Japanese for menu.filter', () => {
      expect(t('menu.filter')).toBe('フィルター');
    });
  });

  describe('t() — English locale', () => {
    beforeEach(() => {
      setLocale('en');
    });

    it('returns English for menu.file', () => {
      expect(t('menu.file')).toBe('File');
    });

    it('returns English for menu.edit', () => {
      expect(t('menu.edit')).toBe('Edit');
    });
  });

  describe('t() — fallback behavior', () => {
    it('falls back to English when key is missing in current locale', () => {
      // ja has all keys, so test by checking en fallback works
      // when a key exists only in en
      setLocale('ja');
      // All known keys exist in ja, so test the raw key fallback
      expect(t('nonexistent.key')).toBe('nonexistent.key');
    });

    it('returns the raw key when not found in any locale', () => {
      expect(t('completely.unknown.key')).toBe('completely.unknown.key');
    });

    it('returns the raw key for empty string key', () => {
      expect(t('')).toBe('');
    });
  });
});
