import React from 'react';
import { Popover } from 'antd';
import type { PopoverProps } from 'antd';
import { getGlassStyle } from '../../theme/glassStyles';

export interface GlassPopoverProps extends PopoverProps {
  roleAccent?: boolean;
}

const GlassPopover: React.FC<GlassPopoverProps> = ({ roleAccent = true, overlayInnerStyle, ...rest }) => {
  const glass = getGlassStyle('popover', roleAccent);

  return (
    <Popover
      {...rest}
      overlayInnerStyle={{
        ...glass,
        borderRadius: 12,
        padding: 12,
        ...overlayInnerStyle,
      }}
    />
  );
};

export default GlassPopover;
