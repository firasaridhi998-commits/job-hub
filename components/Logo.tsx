export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#FFD400" />
      <path d="M38 14v22a10 10 0 0 1-10 10h-2a8 8 0 0 1-8-8" fill="none" stroke="#0B0B0D" strokeWidth="8" strokeLinecap="round" />
      <circle cx="46" cy="46" r="5" fill="#0B0B0D" />
    </svg>
  );
}

/** Original mark: a J whose hook ends beside a hub dot, plus a two-weight wordmark. Works on dark and light grounds via currentColor. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Job Hub">
      <LogoMark size={size} />
      <span className="text-xl leading-none tracking-tight">
        <span className="font-extrabold">Job</span>
        <span className="font-light"> Hub</span>
      </span>
    </span>
  );
}
