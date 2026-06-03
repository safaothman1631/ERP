/**
 * ImpersonationBanner — red fixed banner displayed at the top of every
 * authenticated route when the user is impersonating a tenant (G2 / R2.3).
 *
 * Renders nothing when the user is not impersonating.
 *
 * Place once at the root of the authenticated layout (e.g. AppShell). RTL
 * locales swap the "End session" button to the left automatically because
 * the host layout's `dir` attribute drives flex direction.
 */
import React from 'react';
import { Button, Space, Tag } from 'antd';
import { LogoutOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useImpersonationContext } from '../hooks/useImpersonationContext';
import { formatRemaining } from '../utils/impersonation';

const BANNER_HEIGHT = 44;

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, tenantId, secondsLeft, isExpired, endImpersonation } =
    useImpersonationContext();
  const { t } = useTranslation();

  if (!isImpersonating) return null;

  // When the token actually expires we leave the banner up but disable
  // its content — the next API call will trigger a redirect to /login.
  const countdown = formatRemaining(secondsLeft);

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="impersonation-banner"
      style={{
        position: 'fixed',
        top: 0,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        height: BANNER_HEIGHT,
        background: 'var(--danger-500)',
        color: '#fff',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        fontWeight: 600,
      }}
    >
      <Space size="middle">
        <ExclamationCircleFilled style={{ fontSize: 18 }} />
        <span>
          {t(
            'impersonation.banner',
            'VIEWING AS {{tenant}} — READ-ONLY',
            { tenant: tenantId || '(unknown tenant)' },
          )}
        </span>
        <Tag color={isExpired ? 'volcano' : 'gold'} style={{ marginInlineStart: 8 }}>
          {isExpired
            ? t('impersonation.expired', 'expired')
            : t('impersonation.expiresIn', '{{time}} remaining', {
                time: countdown,
              })}
        </Tag>
      </Space>

      <Button
        size="small"
        danger
        type="primary"
        icon={<LogoutOutlined />}
        onClick={endImpersonation}
        data-testid="impersonation-end-btn"
      >
        {t('impersonation.endSession', 'End session')}
      </Button>
    </div>
  );
};

ImpersonationBanner.displayName = 'ImpersonationBanner';

export default ImpersonationBanner;
