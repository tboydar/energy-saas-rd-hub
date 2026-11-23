import { raw, type Safe } from './dom';

// 自繪的線條圖示（24×24、stroke 1.8），不依賴任何圖示套件。
const PATHS: Record<string, string> = {
  dashboard: '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z"/>',
  team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.4"/><path d="M16 14.2c2.9.2 5 2.5 5 5.8"/>',
  projects: '<path d="M4 6h10M4 12h16M4 18h7"/><path d="M17 4v4M14 16v4"/>',
  governance: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  systems: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  collab: '<path d="M4 5h11v8H9l-5 4z"/><path d="M15 9h5v9l-3-2h-6v-3"/>',
  rbac: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16M15 4v16"/>',
  about: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7.5v.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  reset: '<path d="M4 12a8 8 0 108-8H7"/><path d="M10 1L7 4l3 3"/>',
  alert: '<path d="M12 3l10 17H2z"/><path d="M12 10v5M12 17.5v.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  retry: '<path d="M20 12a8 8 0 11-8-8h5"/><path d="M14 1l3 3-3 3"/>',
  left: '<path d="M14 6l-6 6 6 6"/>',
  right: '<path d="M10 6l6 6-6 6"/>',
  focus: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
};

export type IconName = keyof typeof PATHS;

export function icon(name: string, size = 18): Safe {
  return raw(
    `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ''}</svg>`,
  );
}
