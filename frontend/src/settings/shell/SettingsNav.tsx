import React from 'react';
import { Link } from 'react-router-dom';
import type { TFunction } from 'i18next';
import type { SectionGroup, SectionKey } from '../registry/types';
import { SETTINGS_NAV_GROUPS } from './settingsNavGroups';

export interface SettingsNavSection {
  key: SectionKey;
  group: SectionGroup;
  label: string;
  icon: React.ReactNode;
  link?: string;
  badge?: 'beta' | 'new' | 'soon';
}

interface Props {
  sections: SettingsNavSection[];
  active: SectionKey;
  groupLabels: Record<SectionGroup, string>;
  onSelect: (key: SectionKey) => void;
  onExternalNav?: () => void;
  t: TFunction;
}

const SettingsNav: React.FC<Props> = ({
  sections,
  active,
  groupLabels,
  onSelect,
  onExternalNav,
  t,
}) => (
  <nav className="st-aside-nav">
    {SETTINGS_NAV_GROUPS.map((group) => {
      const items = sections.filter((s) => s.group === group);
      if (items.length === 0) return null;
      return (
        <div key={group} className="st-group">
          <div className="st-group-label">{groupLabels[group]}</div>
          {items.map((s) => {
            const isActive = s.key === active;
            const badgeNode = s.badge ? (
              <span className={`st-nav-badge st-nav-badge--${s.badge}`}>
                {s.badge === 'soon' ? t('coming_soon_short', 'soon')
                  : s.badge === 'beta' ? 'beta'
                  : 'new'}
              </span>
            ) : null;
            if (s.link) {
              return (
                <Link
                  key={s.key}
                  to={s.link}
                  className="st-nav-item"
                  onClick={() => onExternalNav?.()}
                >
                  <span className="st-nav-icon">{s.icon}</span>
                  <span className="st-nav-label">{s.label}</span>
                  {badgeNode}
                  <span className="st-nav-arrow">↗</span>
                </Link>
              );
            }
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onSelect(s.key)}
                className={`st-nav-item${isActive ? ' is-active' : ''}`}
              >
                <span className="st-nav-icon">{s.icon}</span>
                <span className="st-nav-label">{s.label}</span>
                {badgeNode}
                {isActive && <span className="st-nav-active-bar" aria-hidden />}
              </button>
            );
          })}
        </div>
      );
    })}
  </nav>
);

export default SettingsNav;
