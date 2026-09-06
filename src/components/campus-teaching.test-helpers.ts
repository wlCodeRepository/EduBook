import { vi } from 'vitest';

/** Drive the same breakpoint as production without depending on jsdom layout. */
export function mockCampusViewport(initialMobile = false) {
  const listeners = new Set<() => void>();
  const media = {
    matches: initialMobile,
    addEventListener: vi.fn((_event: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_event: string, listener: () => void) => listeners.delete(listener)),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  return {
    media,
    listeners,
    resize(mobile: boolean) { media.matches = mobile; listeners.forEach(listener => listener()); },
  };
}
