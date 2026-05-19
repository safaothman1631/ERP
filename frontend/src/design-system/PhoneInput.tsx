import React from 'react';
import { Input, type InputProps } from 'antd';

export interface PhoneInputProps extends Omit<InputProps, 'addonBefore' | 'type'> {
  countryCode?: string;
}

/**
 * PhoneInput — Sprint 10 — phone field with +964 (Iraq) default prefix.
 * React.memo applied per Requirements 18.4.
 */
const PhoneInputInner: React.FC<PhoneInputProps> = ({ countryCode = '+964', ...rest }) => {
  return <Input addonBefore={countryCode} type="tel" inputMode="tel" placeholder="7XX XXX XXXX" {...rest} />;
};

export const PhoneInput = React.memo(PhoneInputInner);

export default PhoneInput;
