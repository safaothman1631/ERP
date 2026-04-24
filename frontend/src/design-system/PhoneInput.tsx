import React from 'react';
import { Input, type InputProps } from 'antd';

export interface PhoneInputProps extends Omit<InputProps, 'addonBefore' | 'type'> {
  countryCode?: string;
}

/**
 * PhoneInput — Sprint 10 — phone field with +964 (Iraq) default prefix.
 */
export const PhoneInput: React.FC<PhoneInputProps> = ({ countryCode = '+964', ...rest }) => {
  return <Input addonBefore={countryCode} type="tel" inputMode="tel" placeholder="7XX XXX XXXX" {...rest} />;
};

export default PhoneInput;
