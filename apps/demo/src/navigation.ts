import { useEffect, useState } from 'react';
export function currentPath() {
  const query = new URLSearchParams(window.location.search);
  return query.has('run') ? `/runs/${query.get('run')}` : query.get('view') === 'history' ? '/history' : '/';
}
export function hrefFor(path: string) {
  if (path.startsWith('/runs/')) return `${import.meta.env.BASE_URL}?run=${encodeURIComponent(path.slice(6))}`;
  return `${import.meta.env.BASE_URL}${path === '/history' ? '?view=history' : ''}`;
}
function push(path: string) {
  window.history.pushState(null, '', hrefFor(path));
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
export function useRouter() { return { push }; }
export function usePathname() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const changed = () => setPath(currentPath());
    window.addEventListener('popstate', changed);
    return () => window.removeEventListener('popstate', changed);
  }, []);
  return path;
}
