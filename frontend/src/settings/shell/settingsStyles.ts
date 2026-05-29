// Auto-generated from Settings.tsx
import { palette } from '../../theme/tokens';

export const settingsCss = `
.st-shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 0;
  min-height: calc(100vh - 120px);
  background: ${palette.bg};
  margin: -24px;
}
[data-theme="dark"] .st-shell { background: ${palette.darkBg}; }

.st-aside {
  background: ${palette.surface};
  border-inline-end: 1px solid ${palette.border};
  padding: 16px 0;
  position: sticky;
  top: 60px;
  height: calc(100vh - 60px);
  overflow-y: auto;
}
[data-theme="dark"] .st-aside { background: ${palette.darkSurface}; border-color: ${palette.darkBorder}; }

.st-aside-head {
  padding: 8px 16px 16px;
  border-bottom: 1px solid ${palette.border};
  margin-bottom: 12px;
}
[data-theme="dark"] .st-aside-head { border-color: ${palette.darkBorder}; }

.st-aside-title {
  font-size: 16px;
  font-weight: 700;
  color: ${palette.ink900};
  display: flex;
  align-items: center;
}
[data-theme="dark"] .st-aside-title { color: ${palette.darkInk}; }

.st-aside-nav { padding: 0 8px; }

.st-group { margin-bottom: 16px; }

.st-group-label {
  font-size: 11px;
  font-weight: 600;
  color: ${palette.ink300};
  text-transform: uppercase;
  letter-spacing: 0.6px;
  padding: 8px 12px 4px;
}

.st-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: ${palette.ink700};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  text-align: start;
  text-decoration: none;
  transition: background 160ms cubic-bezier(0.2,0,0,1), color 160ms;
}
[data-theme="dark"] .st-nav-item { color: ${palette.darkInkMuted}; }

.st-nav-item:hover {
  background: rgba(15,23,42,0.04);
  color: ${palette.ink900};
}
[data-theme="dark"] .st-nav-item:hover {
  background: rgba(255,255,255,0.04);
  color: ${palette.darkInk};
}

.st-nav-item.is-active {
  background: color-mix(in srgb, var(--role-accent, #1F6FEB) 10%, transparent);
  color: var(--role-accent, ${palette.primary600});
  font-weight: 600;
}
[data-theme="dark"] .st-nav-item.is-active {
  background: color-mix(in srgb, var(--role-accent, #1F6FEB) 18%, transparent);
  color: var(--role-accent, ${palette.primary300});
}

.st-nav-active-bar {
  position: absolute;
  inset-inline-start: 0;
  top: 20%;
  bottom: 20%;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--role-accent, ${palette.primary500});
}

.st-nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  font-size: 15px;
  color: inherit;
  opacity: 0.85;
}

.st-nav-label { flex: 1; }
.st-nav-arrow { font-size: 11px; opacity: 0.6; }

.st-nav-badge {
  font-size: 9.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  margin-inline-start: 4px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  line-height: 1.4;
  flex-shrink: 0;
}
.st-nav-badge--soon { background: rgba(245,158,11,0.14); color: #B45309; }
.st-nav-badge--beta { background: rgba(31,111,235,0.14); color: #1858BF; }
.st-nav-badge--new  { background: rgba(22,163,74,0.14);  color: #15803D; }
[data-theme="dark"] .st-nav-badge--soon { background: rgba(245,158,11,0.18); color: #FBBF24; }
[data-theme="dark"] .st-nav-badge--beta { background: rgba(96,165,250,0.18); color: #93C5FD; }
[data-theme="dark"] .st-nav-badge--new  { background: rgba(74,222,128,0.18); color: #86EFAC; }

.st-nav-active-bar {
  position: absolute;
  inset-inline-start: -8px;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(180deg, ${palette.primary500}, ${palette.primary700});
}

.st-main {
  padding: 24px 32px 48px;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.st-content { padding-bottom: 24px; }

@media (max-width: 900px) {
  .st-shell {
    grid-template-columns: 1fr;
    margin: 0;
    min-height: auto;
  }
  .st-aside { display: none; }
  .st-main { padding: 0 0 64px; }
  .st-mobile-nav-bar { margin: 0 0 12px; }
  .st-content {
    padding: 0;
    max-width: 100%;
    box-sizing: border-box;
  }
  /* Ensure all direct children of st-content are constrained */
  .st-content > * {
    max-width: 100%;
    box-sizing: border-box;
  }
}

/* ── Mobile: sticky section picker bar ─────────────────────── */
.st-mobile-nav-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 16px;
  margin: 0 0 16px;
  border: none;
  background: linear-gradient(135deg, rgba(31,111,235,0.07) 0%, rgba(99,102,241,0.05) 100%);
  border-radius: 14px;
  border: 1.5px solid rgba(31,111,235,0.18);
  cursor: pointer;
  text-align: start;
  box-shadow: 0 2px 12px rgba(31,111,235,0.08);
  transition: background 0.18s, box-shadow 0.18s, border-color 0.18s, transform 0.12s;
  -webkit-tap-highlight-color: transparent;
}
[data-theme="dark"] .st-mobile-nav-bar {
  background: linear-gradient(135deg, rgba(31,111,235,0.12) 0%, rgba(99,102,241,0.08) 100%);
  border-color: rgba(99,102,241,0.28);
  box-shadow: 0 2px 12px rgba(31,111,235,0.14);
}
.st-mobile-nav-bar:hover {
  background: linear-gradient(135deg, rgba(31,111,235,0.11) 0%, rgba(99,102,241,0.08) 100%);
  border-color: rgba(31,111,235,0.30);
  box-shadow: 0 4px 16px rgba(31,111,235,0.13);
}
.st-mobile-nav-bar:active {
  transform: scale(0.985);
  box-shadow: 0 1px 6px rgba(31,111,235,0.10);
}

.st-mobile-nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1F6FEB 0%, #6366F1 100%);
  color: #fff;
  font-size: 17px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(31,111,235,0.30);
}

.st-mobile-nav-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.st-mobile-nav-eyebrow {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: ${palette.primary600};
  line-height: 1;
  opacity: 0.75;
}
[data-theme="dark"] .st-mobile-nav-eyebrow { color: ${palette.primary300}; }

.st-mobile-nav-label {
  font-size: 15px;
  font-weight: 700;
  color: ${palette.ink900};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
[data-theme="dark"] .st-mobile-nav-label { color: ${palette.darkInk}; }

.st-mobile-nav-hint {
  font-size: 11px;
  color: ${palette.ink300};
  font-weight: 400;
  line-height: 1;
  margin-top: 1px;
}
[data-theme="dark"] .st-mobile-nav-hint { color: rgba(255,255,255,0.30); }

.st-mobile-nav-chevron-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(31,111,235,0.10);
  color: ${palette.primary600};
  font-size: 11px;
  flex-shrink: 0;
  transition: background 0.15s;
}
[data-theme="dark"] .st-mobile-nav-chevron-wrap {
  background: rgba(99,102,241,0.18);
  color: ${palette.primary300};
}
.st-mobile-nav-bar:hover .st-mobile-nav-chevron-wrap {
  background: rgba(31,111,235,0.18);
}

/* ── Mobile: bottom-sheet drawer header ─────────────────────── */
.st-drawer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px 10px;
  border-bottom: 1px solid ${palette.border};
  flex-shrink: 0;
}
[data-theme="dark"] .st-drawer-header { border-color: ${palette.darkBorder}; }

.st-drawer-handle {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(15,23,42,0.15);
}
[data-theme="dark"] .st-drawer-handle { background: rgba(255,255,255,0.18); }

.st-drawer-title {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: ${palette.ink900};
  display: flex;
  align-items: center;
  margin-top: 8px;
}
[data-theme="dark"] .st-drawer-title { color: ${palette.darkInk}; }

.st-drawer-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(15,23,42,0.06);
  border-radius: 8px;
  cursor: pointer;
  color: ${palette.ink700};
  font-size: 13px;
  margin-top: 8px;
  transition: background 0.15s;
}
[data-theme="dark"] .st-drawer-close {
  background: rgba(255,255,255,0.08);
  color: ${palette.darkInkMuted};
}
.st-drawer-close:active { background: rgba(31,111,235,0.10); }

.sc-card:hover { border-color: rgba(31,111,235,0.20); }
[data-theme="dark"] .sc-card:hover { border-color: rgba(96,165,250,0.30); }
`;
