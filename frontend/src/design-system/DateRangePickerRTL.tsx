import React from 'react';
import { DatePicker, type DatePickerProps } from 'antd';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

export interface DateRangePickerRTLProps {
  value?: [Dayjs | null, Dayjs | null] | null;
  onChange?: (range: [Dayjs | null, Dayjs | null] | null) => void;
  size?: DatePickerProps['size'];
  placeholder?: [string, string];
}

/**
 * DateRangePickerRTL — Sprint 10 — wraps AntD RangePicker with RTL-friendly defaults.
 * React.memo applied per Requirements 18.4.
 */
const DateRangePickerRTLInner: React.FC<DateRangePickerRTLProps> = ({ value, onChange, size, placeholder }) => {
  return (
    <RangePicker
      value={value ?? undefined}
      onChange={(v) => onChange?.((v as [Dayjs | null, Dayjs | null] | null) ?? null)}
      size={size}
      placeholder={placeholder}
      style={{ width: '100%' }}
    />
  );
};

export const DateRangePickerRTL = React.memo(DateRangePickerRTLInner);

export default DateRangePickerRTL;
