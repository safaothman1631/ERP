import React from 'react';
import { Select, Avatar, type SelectProps } from 'antd';

export interface UserOption {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface UserSelectProps extends Omit<SelectProps, 'options' | 'mode'> {
  users: UserOption[];
  multiple?: boolean;
}

/**
 * UserSelect — Sprint 10 — searchable user picker with avatar.
 */
export const UserSelect: React.FC<UserSelectProps> = ({ users, multiple, ...rest }) => {
  return (
    <Select
      {...rest}
      mode={multiple ? 'multiple' : undefined}
      showSearch
      optionFilterProp="label"
      style={{ width: '100%', ...(rest.style ?? {}) }}
      options={users.map((u) => ({
        label: u.name,
        value: u.id,
        // Custom render via labelInValue not used; keep simple for type safety.
      }))}
      optionRender={(opt) => {
        const u = users.find((x) => x.id === opt.value);
        if (!u) return opt.label;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Avatar size={20} src={u.avatar} style={{ background: '#1F6FEB' }}>{u.name.charAt(0).toUpperCase()}</Avatar>
            <span>{u.name}</span>
            {u.email && <span style={{ color: '#94A3B8', fontSize: 12 }}>{u.email}</span>}
          </span>
        );
      }}
    />
  );
};

export default UserSelect;
