/**
 * Tiny DOM helpers. No framework, no build step.
 */

/**
 * Create an element.
 *
 * @param {string} tag
 * @param {Record<string, any>} [props]
 *   `class`/`className`, `text`, `html`, `dataset`, `style`, `on*` handlers,
 *   anything else becomes an attribute.
 * @param {Array<Node|string|null|undefined|false>} [children]
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class' || key === 'className') element.className = value;
    else if (key === 'text') element.textContent = value;
    else if (key === 'html') element.innerHTML = value;
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else element.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

/** @param {Array<Node|string|null|undefined|false>} children */
export function frag(children) {
  const fragment = document.createDocumentFragment();
  for (const child of children) {
    if (child == null || child === false) continue;
    fragment.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return fragment;
}

/** @param {Element} element */
export function clear(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
  return element;
}

/** @param {string} selector @param {ParentNode} [scope] */
export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

/** @param {string} selector @param {ParentNode} [scope] */
export function qsa(selector, scope = document) {
  return [...scope.querySelectorAll(selector)];
}

/**
 * @param {EventTarget} target
 * @param {string} type
 * @param {(event:any) => void} handler
 * @param {AddEventListenerOptions} [options]
 * @returns {() => void} unsubscribe
 */
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/** @param {(...args:any[]) => void} fn @param {number} wait */
export function debounce(fn, wait = 200) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Replace an element's content in one call.
 * @param {Element} element
 * @param {Array<Node|string|null|undefined|false>} children
 */
export function render(element, children) {
  clear(element);
  element.append(frag(children));
  return element;
}

/** Show a transient toast message. */
export function toast(message, { timeout = 2600 } = {}) {
  const host = document.getElementById('toast-host') ?? document.body;
  const node = h('div', { class: 'toast', role: 'status', text: message });
  host.append(node);
  setTimeout(() => {
    node.classList.add('toast--out');
    setTimeout(() => node.remove(), 300);
  }, timeout);
  return node;
}
