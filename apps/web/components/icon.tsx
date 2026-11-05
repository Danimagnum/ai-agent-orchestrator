export function Icon({ name, size = 18 }: {
  name: string;
  size?: number;
}) {
  const paths: Record<string, React.ReactNode> = {
    graph: <>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
      <path d="m11 7-5 9m7-9 5 9M8 19h8" />
    </>,
    history: <>
      <path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7" />
      <path d="M12 7v5l3 2" />
    </>,
    arrow: <>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </>,
    plus: <path d="M12 5v14M5 12h14" />,
    code: <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18" />,
    search: <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 5 5" />
    </>,
    pen: <>
      <path d="m4 16 12-12 4 4L8 20H4v-4Zm10-10 4 4" />
    </>,
    check: <>
      <path d="m5 12 4 4L19 6" />
      <path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h8" />
    </>,
    clock: <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
    bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z" />,
    copy: <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V4H4v12h4" />
    </>,
    chevron: <path d="m9 5 7 7-7 7" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.graph}</svg>;
}
