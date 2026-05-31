import React, { useMemo } from 'react';
import { useRoleUx } from '../../hooks/useRoleUx';

export const RoleAccentContext = React.createContext<string>('#7B61FF');

export const RoleAccentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useRoleUx();
  const style = useMemo(
    () =>
      ({
        '--role-accent': theme.accent,
        '--role-accent-muted': theme.accentMuted,
        '--role-glass-glow': theme.glassBorderGlow,
      }) as React.CSSProperties,
    [theme.accent, theme.accentMuted, theme.glassBorderGlow],
  );

  return (
    <RoleAccentContext.Provider value={theme.accent}>
      <div className="role-accent-root" style={style}>
        {children}
      </div>
    </RoleAccentContext.Provider>
  );
};
