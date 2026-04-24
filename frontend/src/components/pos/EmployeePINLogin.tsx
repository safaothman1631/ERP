import React, { useState } from 'react';
import { Modal, App } from 'antd';
import { useTranslation } from 'react-i18next';
import PINPad from './PINPad';
import api from '../../api';

interface EmployeePINLoginProps {
  visible: boolean;
  configId: string;
  onSuccess: (employee: any, token: string) => void;
  onCancel: () => void;
}

const EmployeePINLogin: React.FC<EmployeePINLoginProps> = ({
  visible,
  configId,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const handlePINSubmit = async (pin: string) => {
    setLoading(true);
    try {
      const res = await api.post('/api/pos/employees/login', {
        pin,
        config_id: configId,
      });
      
      const { token, employee, expires_at } = res.data;
      message.success(t('login_successful', { name: employee.name }));
      onSuccess(employee, token);
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 403) {
        const lockedUntil = error.response?.data?.locked_until;
        if (lockedUntil) {
          message.error(t('employee_locked', { until: new Date(lockedUntil).toLocaleTimeString() }));
        } else {
          message.error(t('invalid_pin'));
        }
      } else {
        message.error(t('login_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PINPad
      visible={visible}
      onComplete={handlePINSubmit}
      onCancel={onCancel}
      title={t('employee_login')}
      maxLength={6}
    />
  );
};

export default EmployeePINLogin;
