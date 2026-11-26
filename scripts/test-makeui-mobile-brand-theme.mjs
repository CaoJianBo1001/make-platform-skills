import assert from 'node:assert/strict';
import { test } from 'node:test';

const { toMobileBrandTheme } = await import('../skills/makeui/assets/mobile-brand-theme.mjs');

test('PC theme exports only mobile brand colors and retains mobile filled actions', () => {
  const pc = Object.freeze({
    primary: '#f54e00', onPrimary: '#fff', primarySoft: '#fff0e8', link: '#c53e00', focusRing: '#f54e00',
    actionBackground: 'transparent', actionText: '#f54e00', actionBorder: '#f54e00',
    fontFamily: 'Desktop Brand Font', pageHeaderSize: '32px', controlTextSize: '20px',
    lineHeight: '2', letterSpacing: '.2em', controlRadius: '2px', shadow: '0 4px 20px black',
    page: '#000', surface: '#111', controlSurface: '#222', text: '#fff', danger: '#ff00ff',
    motionDuration: '500ms', iconStroke: '3', actionRadius: '0px',
  });
  assert.deepEqual(toMobileBrandTheme(pc), {
    primary: '#f54e00', onPrimary: '#fff', primarySoft: '#fff0e8', link: '#c53e00', focusRing: '#f54e00',
    actionBackground: '#f54e00', actionBorder: '#f54e00', actionText: '#fff',
  });
  assert.equal(pc.actionBackground, 'transparent');
});

test('changing desktop font, geometry, navigation or detail surface leaves phone color projection equal', () => {
  const brand = { primary: '#1677ff', onPrimary: '#fff', primarySoft: '#e6f4ff' };
  const first = { ...brand, fontFamily: 'A', controlRadius: '24px', contentSize: '20px', navigation: 'rail', detail: 'drawer' };
  const second = { ...brand, fontFamily: 'B', controlRadius: '0px', contentSize: '12px', navigation: 'top', detail: 'page' };
  assert.deepEqual(toMobileBrandTheme(first), toMobileBrandTheme(second));
});

test('omitted or blank values keep official phone defaults instead of manufacturing a palette', () => {
  for (const input of [undefined, null, {}, { primary: '', onPrimary: ' ', link: false, focusRing: 0 }]) {
    assert.deepEqual(toMobileBrandTheme(input), {});
  }
  assert.deepEqual(toMobileBrandTheme({ primary: 'rebeccapurple' }), {
    primary: 'rebeccapurple', actionBackground: 'rebeccapurple', actionBorder: 'rebeccapurple',
  });
});

test('a mutable PC input and returned color object do not alias each other', () => {
  const pc = { primary: '#1677ff', fontFamily: 'A' };
  const phone = toMobileBrandTheme(pc);
  pc.primary = '#f54e00';
  assert.equal(phone.primary, '#1677ff');
  assert.equal(toMobileBrandTheme(pc).primary, '#f54e00');
  assert.equal('fontFamily' in phone, false);
});
