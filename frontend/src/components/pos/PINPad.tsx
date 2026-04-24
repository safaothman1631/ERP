import React, { useState } from 'react';
import { Modal, Button, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface PINPadProps {
  onComplete: (pin: string) => void;
  onCancel: () => void;
  visible: boolean;
  title?: string;
  maxLength?: number;
}

const PINPad: React.FC<PINPadProps> = ({
  onComplete,
  onCancel,
  visible,
  title = 'Enter PIN',
  maxLength = 6,
}) => {
  const [pin, setPin] = useState('');

  const handleDigit = (digit: string) => {
    if (pin.length < maxLength) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === maxLength) {
        // Auto-submit when max length reached
        setTimeout(() => {
          onComplete(newPin);
          setPin('');
        }, 200);
      }
    }
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSubmit = () => {
    if (pin.length >= 4) {
      onComplete(pin);
      setPin('');
    }
  };

  const handleClose = () => {
    setPin('');
    onCancel();
  };

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      footer={null}
      title={title}
      centered
      width={400}
    >
      <div style={{ textAlign: 'center' }}>
        {/* PIN Display */}
        <div
          style={{
            fontSize: 32,
            letterSpacing: 12,
            marginBottom: 24,
            height: 50,
            lineHeight: '50px',
            background: '#f0f0f0',
            borderRadius: 8,
          }}
        >
          {pin ? '•'.repeat(pin.length) : ' '}
        </div>

        {/* Number Pad */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <Button
              key={digit}
              size="large"
              onClick={() => handleDigit(digit.toString())}
              style={{ height: 70, fontSize: 24 }}
            >
              {digit}
            </Button>
          ))}
          <Button
            size="large"
            danger
            icon={<DeleteOutlined />}
            onClick={handleClear}
            style={{ height: 70 }}
          >
            Clear
          </Button>
          <Button
            size="large"
            onClick={() => handleDigit('0')}
            style={{ height: 70, fontSize: 24 }}
          >
            0
          </Button>
          <Button
            size="large"
            type="primary"
            onClick={handleSubmit}
            disabled={pin.length < 4}
            style={{ height: 70 }}
          >
            OK
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PINPad;
