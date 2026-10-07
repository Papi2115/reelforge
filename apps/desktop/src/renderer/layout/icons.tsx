/** Small inline SVG icons (no icon font or CDN under the CSP); decorative, labels go on buttons. */
import type { JSX } from 'react';

function Icon({ children }: { readonly children: JSX.Element | JSX.Element[] }): JSX.Element {
  return (
    <svg className="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {children}
    </svg>
  );
}

export function PlayIcon(): JSX.Element {
  return (
    <Icon>
      <path d="M4.5 2.5v11l9-5.5z" fill="currentColor" />
    </Icon>
  );
}

export function PauseIcon(): JSX.Element {
  return (
    <Icon>
      <rect x="3.5" y="2.5" width="3" height="11" rx="0.5" fill="currentColor" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="0.5" fill="currentColor" />
    </Icon>
  );
}

export function LoopIcon(): JSX.Element {
  return (
    <Icon>
      <path
        d="M3 9V7a3 3 0 0 1 3-3h7M13 7v2a3 3 0 0 1-3 3H3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M11 2l2.5 2L11 6zM5 10l-2.5 2L5 14z" fill="currentColor" />
    </Icon>
  );
}

export function SpeakerIcon({ muted }: { readonly muted: boolean }): JSX.Element {
  return (
    <Icon>
      <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
      {muted ? (
        <path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.4" />
      ) : (
        <path d="M11 5.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
    </Icon>
  );
}

export function CameraIcon(): JSX.Element {
  return (
    <Icon>
      <path
        d="M2 5h3l1.5-2h3L11 5h3v8H2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="9" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </Icon>
  );
}

export function StopIcon(): JSX.Element {
  return (
    <Icon>
      <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" />
    </Icon>
  );
}

export function SendIcon(): JSX.Element {
  return (
    <Icon>
      <path d="M2 8l12-5.5L10.5 14 8 9z" fill="currentColor" />
    </Icon>
  );
}

/** A padlock, closed when `locked` (shot locks, PLAN.md#11.4). */
export function LockIcon({ locked }: { readonly locked: boolean }): JSX.Element {
  return (
    <Icon>
      <rect x="3" y="7" width="10" height="7" rx="1" fill="currentColor" />
      <path
        d={locked ? 'M5 7V5a3 3 0 0 1 6 0v2' : 'M5 7V5a3 3 0 0 1 6 0'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        transform={locked ? undefined : 'translate(3 -1.5)'}
      />
    </Icon>
  );
}

/** A speech bubble (the Claude chat). */
export function ChatIcon(): JSX.Element {
  return (
    <Icon>
      <path
        d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/** A clapperboard on the pixel grid (the Director tab). */
export function DirectorIcon(): JSX.Element {
  return (
    <Icon>
      <path d="M2 7h12v6H2z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 3.5l11.5-1.5.4 3L2.4 6.5z" fill="currentColor" />
    </Icon>
  );
}

/** A chevron pointing `direction` (collapse / expand). */
export function ChevronIcon({
  direction,
}: {
  readonly direction: 'up' | 'down' | 'left' | 'right';
}): JSX.Element {
  const rotation = { right: 0, down: 90, left: 180, up: 270 }[direction];
  return (
    <Icon>
      <path
        d="M6 3.5L10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`rotate(${String(rotation)} 8 8)`}
      />
    </Icon>
  );
}

/** An "i" in a circle (explanations in tooltips). */
export function InfoIcon(): JSX.Element {
  return (
    <Icon>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4.8" r="0.9" fill="currentColor" />
    </Icon>
  );
}

/** A funnel (show only some items). */
export function FilterIcon(): JSX.Element {
  return (
    <Icon>
      <path
        d="M2.5 3.5h11L9.5 8.5v4l-3 1.5v-5.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </Icon>
  );
}
