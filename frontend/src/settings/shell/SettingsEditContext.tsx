import React from 'react';

export const SettingsEditContext = React.createContext(true);

export function useSettingsEdit(): boolean {
  return React.useContext(SettingsEditContext);
}
