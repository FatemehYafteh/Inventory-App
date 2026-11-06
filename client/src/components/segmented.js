import { cn } from '@/lib/utils';

/**
 * One look for the language and theme switchers: a bordered container (h-8, same radius) that
 * splits its width into equal segments. `tone="sidebar"` is for the navy surfaces; the selected
 * segment is a filled background in both tones, and the ring shows for keyboard focus only.
 */
export function segmentedGroupClass(tone) {
  return cn(
    'grid h-8 auto-cols-fr grid-flow-col gap-0.5 rounded-md border p-0.5',
    tone === 'sidebar' ? 'border-sidebar-accent' : 'border-input bg-background',
  );
}

const SEGMENT =
  'flex h-full min-w-8 cursor-pointer items-center justify-center rounded-sm px-2 text-sm transition-colors';

const SEGMENT_TONES = {
  page: {
    active: 'bg-primary font-medium text-primary-foreground',
    idle: 'text-foreground hover:bg-accent hover:text-accent-foreground',
    focus: 'focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none',
    peerFocus: 'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring',
  },
  sidebar: {
    active: 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
    idle: 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
    focus:
      'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring focus-visible:outline-none',
    peerFocus: 'peer-focus-visible:ring-[3px] peer-focus-visible:ring-sidebar-ring',
  },
};

/** Segment class. `peer` is for a visible span after a hidden native radio. */
export function segmentClass(tone, active, { peer = false } = {}) {
  const t = SEGMENT_TONES[tone];
  return cn(SEGMENT, active ? t.active : t.idle, peer ? t.peerFocus : t.focus);
}
