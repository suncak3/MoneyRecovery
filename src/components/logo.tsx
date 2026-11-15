export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect width="26" height="26" rx="7" fill="var(--color-accent)" />
        <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16.2 7.4A6.8 6.8 0 1 1 10.5 7.1" />
          <path d="M8.4 6l2.5.9-1.2 2.4" />
          <path d="M15.3 11.6c-.3-.8-1.2-1.3-2.3-1.3-1.3 0-2.2.7-2.2 1.6 0 2.1 4.6 1.2 4.6 3.5 0 1-1 1.7-2.4 1.7-1.2 0-2.1-.5-2.4-1.3M13 9.1v1.2M13 17.1v1.2" />
        </g>
      </svg>
      MoneyRecover
    </span>
  );
}
