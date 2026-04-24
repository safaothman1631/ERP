import React from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';

export interface ContextMenuItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onSelect?: () => void;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
  /** Disable wrapping / context behavior. */
  disabled?: boolean;
}

/**
 * ContextMenu — Sprint 10 — right-click menu wrapper around any element.
 * Built on AntD Dropdown with `trigger=['contextMenu']`.
 *
 * Usage:
 *   <ContextMenu items={[
 *     { key: 'edit', label: 'Edit', icon: <EditOutlined />, onSelect: () => ... },
 *     { key: 'd', divider: true, label: '' },
 *     { key: 'del', label: 'Delete', danger: true, onSelect: () => ... },
 *   ]}>
 *     <tr>...</tr>
 *   </ContextMenu>
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({ items, children, disabled }) => {
  if (disabled) return <>{children}</>;

  const menuItems: MenuProps['items'] = items.map((it) => {
    if (it.divider) return { type: 'divider' as const, key: it.key };
    return {
      key: it.key,
      label: it.label,
      icon: it.icon,
      danger: it.danger,
      disabled: it.disabled,
      onClick: () => it.onSelect?.(),
    };
  });

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
      <div>{children}</div>
    </Dropdown>
  );
};

export default ContextMenu;
