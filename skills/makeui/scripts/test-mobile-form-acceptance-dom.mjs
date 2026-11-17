// 仓库自测：MAKE_FEEDBACK_TEST_DEPENDENCIES 指向 CI 的隔离测试依赖目录。
// jsdom 仅用于测试真实 DOM／计算样式，不是公共断言的运行时依赖或几何证据。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { assertLoadingFeedback, assertLoadingGeometry } from './mobile-form-acceptance.mjs';

const require = createRequire(path.resolve(process.env.MAKE_FEEDBACK_TEST_DEPENDENCIES ?? '.', '__mobile_form_dom_test__.cjs'));
const { JSDOM } = require('jsdom');
const withLoading = check => {
  const dom = new JSDOM(`<style>
    .status { display:flex; align-items:center; justify-content:center }
    .wrapper { visibility:hidden }
  </style><div class="region"><div class="status"><i class="indicator"></i>
    <span class="message">正在加载候选项</span></div>
    <div class="wrapper"><button role="option">旧候选</button></div></div>`);
  try {
    const document = dom.window.document;
    const input = Object.fromEntries(['region', 'status', 'indicator', 'message'].map(name => [name, document.querySelector(`.${name}`)]));
    check({ ...input, optionSelector: '[role=option]' }, dom.window);
  } finally { dom.window.close(); }
};

test('真实 CSS 继承：隐藏候选可通过，子节点恢复可见后必须拒绝', () => withLoading((input, view) => {
  const option = input.region.querySelector('[role=option]');
  assert.equal(view.getComputedStyle(option).visibility, 'hidden');
  assertLoadingFeedback(input);
  option.style.visibility = 'visible';
  assert.equal(view.getComputedStyle(option).visibility, 'visible');
  assert.throws(() => assertLoadingFeedback(input), /旧候选/);
}));

test('候选自身隐藏但内部文字恢复可见时不能通过，祖先阻断仍有效', () => withLoading((input, view) => {
  const option = input.region.querySelector('[role=option]');
  const label = view.document.createElement('span');
  label.textContent = option.textContent;
  option.replaceChildren(label); label.style.visibility = 'visible';
  assert.equal(view.getComputedStyle(option).visibility, 'hidden');
  assert.equal(view.getComputedStyle(label).visibility, 'visible');
  assert.throws(() => assertLoadingFeedback(input), /旧候选/);
  for (const [property, value] of [['display', 'none'], ['opacity', '0'], ['contentVisibility', 'hidden']]) {
    option.style[property] = value;
    assertLoadingFeedback(input);
    option.style.removeProperty(property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`));
  }
  assert.throws(() => assertLoadingFeedback(input), /旧候选/);
  label.style.removeProperty('visibility');
  assert.equal(view.getComputedStyle(label).visibility, 'hidden');
  assertLoadingFeedback(input);
}));

test('真实 CSS 继承：文案恢复可见可通过，继承隐藏及祖先阻断仍拒绝', () => withLoading((input, view) => {
  const wrapper = view.document.createElement('span');
  wrapper.className = 'wrapper';
  input.message.replaceWith(wrapper); wrapper.append(input.message);
  input.message.style.visibility = 'visible';
  assert.equal(view.getComputedStyle(input.message).visibility, 'visible');
  assertLoadingFeedback(input);
  input.message.style.removeProperty('visibility');
  assert.equal(view.getComputedStyle(input.message).visibility, 'hidden');
  assert.throws(() => assertLoadingFeedback(input), /文案/);
  input.message.style.visibility = 'visible';
  for (const [property, value] of [['display', 'none'], ['opacity', '0']]) {
    wrapper.style[property] = value;
    assert.throws(() => assertLoadingFeedback(input), /文案/);
    wrapper.style.removeProperty(property);
  }
}));

test('定位加载反馈可做 DOM 验收，零矩形不能冒充居中证据', () => withLoading(input => {
  Object.assign(input.status.style, { display: 'block', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
  assertLoadingFeedback(input);
  assert.throws(() => assertLoadingGeometry(input), /真实浏览器/);
}));

for (const target of ['option', 'wrapper']) {
  test(`hidden 的 ${target} 被 CSS 恢复显示后必须拒绝旧候选`, () => withLoading((input, view) => {
    const option = input.region.querySelector('[role=option]');
    const wrapper = option.parentElement;
    wrapper.style.visibility = 'visible';
    const hidden = target === 'option' ? option : wrapper;
    hidden.hidden = true;
    assert.equal(view.getComputedStyle(hidden).display, 'none');
    assertLoadingFeedback(input);
    for (const display of ['block', 'flex']) {
      hidden.style.display = display;
      assert.equal(hidden.hidden, true);
      assert.equal(view.getComputedStyle(hidden).display, display);
      assert.equal(view.getComputedStyle(option).visibility, 'visible');
      assert.throws(() => assertLoadingFeedback(input), /旧候选/);
    }
    hidden.style.display = 'none';
    assertLoadingFeedback(input);
  }));
}

test('hidden 文案的默认隐藏仍拒绝，CSS 恢复显示后允许继续验收', () => withLoading((input, view) => {
  input.message.hidden = true;
  assert.equal(view.getComputedStyle(input.message).display, 'none');
  assert.throws(() => assertLoadingFeedback(input), /文案/);
  input.message.style.display = 'block';
  assert.equal(view.getComputedStyle(input.message).display, 'block');
  assertLoadingFeedback(input);
}));

test('content-visibility 隐藏文字及后代，不等于隐藏元素自身外框', () => withLoading((input, view) => {
  const wrapper = view.document.createElement('span');
  input.message.replaceWith(wrapper); wrapper.append(input.message);
  for (const target of [input.message, wrapper]) {
    target.style.contentVisibility = 'hidden';
    assert.equal(view.getComputedStyle(target).contentVisibility, 'hidden');
    assert.throws(() => assertLoadingFeedback(input), /文案|文字/);
    target.style.contentVisibility = 'visible';
    assertLoadingFeedback(input);
  }
  const option = input.region.querySelector('[role=option]');
  option.parentElement.style.visibility = 'visible';
  option.style.contentVisibility = 'hidden';
  assert.throws(() => assertLoadingFeedback(input), /旧候选/);
}));
