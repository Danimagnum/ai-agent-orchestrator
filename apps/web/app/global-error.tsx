'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
export default function GlobalError({ error, reset }: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return <html lang="en">
    <body style={{ background: '#0c101b', color: '#e7e9f3', padding: 40, fontFamily: 'sans-serif' }}>
      <h1>The workspace could not load</h1>
      <p>Try loading it again.</p>
      <button onClick={reset}>Try again</button>
    </body>
  </html>;
}
