/**
 * Hash router.
 *
 * A hash router (not the History API) so the whole app keeps working when it is
 * opened from a plain static server — or even from `file://` for a quick look —
 * without any server-side rewrite rules.
 */

/**
 * Compile `/sura/:n/ayah/:a` into a matcher.
 * @param {string} pattern
 */
function compile(pattern) {
  const keys = [];
  const regexSource = pattern
    .replace(/\/+$/, '')
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      keys.push(segment.slice(1));
      return '([^/]+)';
    })
    .join('/');
  return { keys, regex: new RegExp(`^${regexSource || '/'}/?$`) };
}

/** @param {string} hash */
export function parseHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  /** @type {Record<string,string>} */
  const query = {};
  for (const [key, value] of new URLSearchParams(queryPart)) query[key] = value;
  return { path: path.replace(/\/+$/, '') || '/', query };
}

/** Build `#/path?a=1`. @param {string} path @param {Record<string, any>} [query] */
export function buildHash(path, query) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value != null && value !== '') search.set(key, String(value));
  }
  const suffix = search.toString();
  return `#${path}${suffix ? `?${suffix}` : ''}`;
}

/**
 * @param {{routes: {name:string, path:string}[], fallback?: string,
 *   onRoute:(route:{name:string, params:Record<string,string>,
 *   query:Record<string,string>, path:string}) => void}} options
 */
export function createRouter({ routes, fallback = 'home', onRoute }) {
  const compiled = routes.map((route) => ({ ...route, ...compile(route.path) }));

  /** @param {string} path */
  function resolve(path) {
    const { path: cleanPath, query } = parseHash(path);
    for (const route of compiled) {
      const match = route.regex.exec(cleanPath);
      if (!match) continue;
      /** @type {Record<string,string>} */
      const params = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1]);
      });
      return { name: route.name, params, query, path: cleanPath };
    }
    return { name: fallback, params: {}, query, path: cleanPath, unknown: true };
  }

  let current = resolve(globalThis.location?.hash ?? '/');

  function handleChange() {
    current = resolve(globalThis.location.hash);
    onRoute(current);
  }

  return {
    start() {
      globalThis.addEventListener('hashchange', handleChange);
      handleChange();
      return current;
    },
    stop() {
      globalThis.removeEventListener('hashchange', handleChange);
    },
    /** @param {string} path @param {{replace?: boolean}} [options] */
    navigate(path, options = {}) {
      const target = path.startsWith('#') ? path : buildHash(path);
      if (globalThis.location.hash === target) {
        handleChange();
        return;
      }
      if (options.replace) globalThis.location.replace(target);
      else globalThis.location.hash = target;
    },
    current() {
      return current;
    },
    resolve,
  };
}
