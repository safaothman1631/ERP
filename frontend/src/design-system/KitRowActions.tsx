/**
 * KitRowActions — the Vertex kit's per-row "⋯" action menu, 1:1.
 *
 * In the kit each table row ends with a small "⋯" button that opens a menu:
 *   👁 View · ⚙ Edit · ⧉ Duplicate · ─── · ✕ Delete (red/danger)
 *
 * Our pages previously rendered two inline icon buttons (edit + delete), which
 * did not match the kit. This restores the single "⋯" menu. Pages pass an
 * `actions` array so each module chooses its own verbs; the styling (dark kit
 * popover, accent-soft hover, red danger row) comes from vertex-kit.css.
 */
import React from 'react';
import { Button, Dropdown, type MenuProps } from 'antd';
import { MoreOutlined } from '@ant-design/icons';

export interface KitRowActionItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}
export type KitRowEntry = KitRowActionItem | { type: 'divider' };

export interface KitRowActionsProps {
  actions: KitRowEntry[];
  ariaLabel?: string;
}

const KitRowActions: React.FC<KitRowActionsProps> = ({ actions, ariaLabel = 'Actions' }) => {
  const items: MenuProps['items'] = actions.map((a, i) =>
    'type' in a
      ? { type: 'divider' as const, key: `divider-${i}` }
      : {
          key: a.key,
          label: a.label,
          icon: a.icon,
          danger: a.danger,
          disabled: a.disabled,
          onClick: ({ domEvent }) => { domEvent.stopPropagation(); a.onClick(); },
        },
  );

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
      <Button
        type="text"
        size="small"
        icon={<MoreOutlined />}
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      />
    </Dropdown>
  );
};

export default KitRowActions;
