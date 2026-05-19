/**
 * SaveSplitButton — "Save / Save & New / Save & Send" split button.
 *
 * Renders a primary button for the default action (first in the list)
 * with a dropdown arrow for secondary actions.
 *
 * Requirements: 15.6
 */
import React from 'react';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export interface SaveAction {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
}

export interface SaveSplitButtonProps {
  /** List of save actions. First item is the primary (default) action. */
  actions: SaveAction[];
  /** Whether the primary button is in loading state */
  loading?: boolean;
  /** Whether all actions are disabled */
  disabled?: boolean;
  /** Button size */
  size?: 'small' | 'middle' | 'large';
}

export const SaveSplitButton: React.FC<SaveSplitButtonProps> = ({
  actions,
  loading = false,
  disabled = false,
  size = 'middle',
}) => {
  const { t } = useTranslation();

  if (actions.length === 0) return null;

  const [primary, ...secondary] = actions;

  const menuItems: MenuProps['items'] = secondary.map((action) => ({
    key: action.key,
    label: action.label,
    icon: action.icon,
    disabled: action.disabled || disabled,
    danger: action.danger,
    onClick: () => {
      void action.onClick?.();
    },
  }));

  const handlePrimaryClick = () => {
    void primary.onClick?.();
  };

  if (secondary.length === 0) {
    // No secondary actions — render a plain primary button
    return (
      <Button
        type="primary"
        icon={primary.icon}
        loading={loading}
        disabled={disabled || primary.disabled}
        onClick={handlePrimaryClick}
        size={size}
        aria-label={typeof primary.label === 'string' ? primary.label : undefined}
      >
        {primary.label}
      </Button>
    );
  }

  return (
    <Button.Group>
      <Button
        type="primary"
        icon={primary.icon}
        loading={loading}
        disabled={disabled || primary.disabled}
        onClick={handlePrimaryClick}
        size={size}
        aria-label={typeof primary.label === 'string' ? primary.label : undefined}
      >
        {primary.label}
      </Button>
      <Dropdown
        menu={{ items: menuItems }}
        placement="bottomEnd"
        disabled={disabled || loading}
        trigger={['click']}
      >
        <Button
          type="primary"
          size={size}
          disabled={disabled || loading}
          aria-label={t('save_split_button.more_options', 'More save options')}
          aria-haspopup="menu"
          style={{ paddingInline: 8 }}
        >
          <DownOutlined />
        </Button>
      </Dropdown>
    </Button.Group>
  );
};

export default SaveSplitButton;
