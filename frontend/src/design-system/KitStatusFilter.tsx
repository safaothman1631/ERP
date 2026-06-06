/**
 * KitStatusFilter — the Vertex kit's toolbar "Status ⌄" dropdown, 1:1.
 *
 * A kit-styled outline button that shows the current status (or a placeholder)
 * and opens a menu of statuses (+ "Any"). Turns accent when a value is active.
 * Reusable across every list: pass the entity's own status options.
 */
import React from 'react';
import { Dropdown, Button, type MenuProps } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export interface KitStatusOption { value: string; label: React.ReactNode; }

export interface KitStatusFilterProps {
  options: KitStatusOption[];
  /** '' / undefined = no filter (any). */
  value?: string;
  onChange: (value: string) => void;
  /** Button label shown when nothing is selected (default: "Status"). */
  label?: React.ReactNode;
  /** First menu entry label (default: "Any status"). */
  anyLabel?: React.ReactNode;
}

const KitStatusFilter: React.FC<KitStatusFilterProps> = ({ options, value = '', onChange, label, anyLabel }) => {
  const { t } = useTranslation();
  const active = !!value;
  const current = options.find((o) => o.value === value);

  const items: MenuProps['items'] = [
    { key: '__any', label: anyLabel ?? t('any_status', 'Any status') },
    ...options.map((o) => ({ key: o.value, label: o.label })),
  ];

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items,
        selectable: true,
        selectedKeys: [value || '__any'],
        onClick: ({ key }) => onChange(key === '__any' ? '' : key),
      }}
    >
      <Button
        size="small"
        style={{
          height: 32,
          paddingInline: 10,
          fontSize: 12.5,
          ...(active ? { borderColor: 'var(--accent-500)', color: 'var(--accent-500)' } : null),
        }}
      >
        {current ? current.label : (label ?? t('status', 'Status'))}
        <DownOutlined style={{ fontSize: 11, marginInlineStart: 2 }} />
      </Button>
    </Dropdown>
  );
};

export default KitStatusFilter;
