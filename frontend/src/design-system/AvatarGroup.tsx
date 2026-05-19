import React from 'react';
import { Avatar, Tooltip } from 'antd';

export interface AvatarItem {
  name: string;
  src?: string;
  color?: string;
}

export interface AvatarGroupProps {
  users: AvatarItem[];
  max?: number;
  size?: number;
}

/**
 * AvatarGroup — Sprint 10 — overlapping avatars with overflow count.
 * React.memo applied per Requirements 18.4.
 */
const AvatarGroupInner: React.FC<AvatarGroupProps> = ({ users, max = 4, size = 28 }) => {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  return (
    <Avatar.Group size={size} maxCount={max}>
      {visible.map((u, i) => (
        <Tooltip key={i} title={u.name}>
          <Avatar src={u.src} style={{ backgroundColor: u.color ?? '#1F6FEB' }}>
            {u.name?.charAt(0).toUpperCase()}
          </Avatar>
        </Tooltip>
      ))}
      {overflow > 0 && <Avatar style={{ backgroundColor: '#94A3B8' }}>+{overflow}</Avatar>}
    </Avatar.Group>
  );
};

export const AvatarGroup = React.memo(AvatarGroupInner);

export default AvatarGroup;
