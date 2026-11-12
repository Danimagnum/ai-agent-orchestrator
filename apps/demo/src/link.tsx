import type { AnchorHTMLAttributes } from 'react';
import { hrefFor, useRouter } from './navigation';
export default function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const router = useRouter();
  return <a {...props} href={hrefFor(href)} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); router.push(href);
    }
  }} />;
}
