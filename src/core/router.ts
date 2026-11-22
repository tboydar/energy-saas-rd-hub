// Hash 路由：#/projects?tab=kanban。
// GitHub Pages 是純靜態主機，沒有伺服器端改寫；用 hash 可以保證重新整理不會 404。

export interface Route {
  path: string;
  query: URLSearchParams;
}

export function currentRoute(): Route {
  const raw = location.hash.replace(/^#/, '') || '/dashboard';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/dashboard', query: new URLSearchParams(qs) };
}

export function href(path: string, query?: Record<string, string>): string {
  const qs = query ? new URLSearchParams(query).toString() : '';
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(path: string, query?: Record<string, string>): void {
  const next = href(path, query);
  if (location.hash === next) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = next;
}

export function onRouteChange(fn: () => void): void {
  window.addEventListener('hashchange', fn);
}
