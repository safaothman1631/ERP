import { type ReactNode } from 'react';
import { Button, Typography } from 'antd';
import {
  ClockCircleOutlined, CloseCircleOutlined, CheckCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { MODULES, type ModuleKey } from './industries';
import styles from './OnboardingWizard.module.css';

const { Text } = Typography;

export interface ModuleRequestRow {
  id: string;
  status: 'pending' | 'approved' | 'partially_approved' | 'rejected';
  requested_modules: ModuleKey[];
  approved_modules?: ModuleKey[];
  reason?: string;
  created_at?: string;
  reviewed_at?: string;
}

interface Props {
  request: ModuleRequestRow | null;
  onResubmit?: () => void;
  loading?: boolean;
}

const TONE_CLASS = {
  pending: styles.glassStatus_pending,
  error: styles.glassStatus_error,
  success: styles.glassStatus_success,
  info: styles.glassStatus_info,
} as const;

function StatusCard({
  tone,
  icon,
  title,
  description,
}: {
  tone: 'pending' | 'error' | 'success' | 'info';
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className={`${styles.glassStatusCard} ${TONE_CLASS[tone]}`}>
      <div className={styles.glassStatusIconWrap}>
        {tone === 'pending' && <span className={styles.glassStatusPulse} aria-hidden />}
        <span className={styles.glassStatusIcon}>{icon}</span>
      </div>
      <div className={styles.glassStatusText}>
        <h3 className={styles.glassStatusTitle}>{title}</h3>
        <p className={styles.glassStatusDesc}>{description}</p>
      </div>
    </div>
  );
}

export default function PendingApprovalScreen({ request, onResubmit, loading }: Props) {
  const { t } = useTranslation();

  if (!request) {
    return (
      <StatusCard
        tone="info"
        icon={<ClockCircleOutlined />}
        title={t('modreq_none', 'No module request yet')}
        description={t('modreq_none_hint', 'Select modules in the wizard and submit your request.')}
      />
    );
  }

  const mods = (request.requested_modules || [])
    .map(k => MODULES.find(m => m.key === k))
    .filter(Boolean);

  if (request.status === 'pending') {
    return (
      <div className={styles.pendingGlassLayout}>
        <StatusCard
          tone="pending"
          icon={<ClockCircleOutlined />}
          title={t('modreq_pending_title', 'Awaiting admin approval')}
          description={t('modreq_pending_hint', 'Your module request has been sent. An org admin will review it shortly.')}
        />
        <div className={styles.glassModulePanel}>
          <Text className={styles.glassModuleLabel}>{t('modreq_requested', 'Requested modules')}</Text>
          <div className={styles.reviewTags}>
            {mods.map(m => m && (
              <span key={m.key} className={styles.glassModuleChip}>
                <span className={styles.glassModuleChipIcon}>{m.icon}</span>
                {t(m.labelKey, m.title)}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (request.status === 'rejected') {
    return (
      <div className={styles.pendingGlassLayout}>
        <StatusCard
          tone="error"
          icon={<CloseCircleOutlined />}
          title={t('modreq_rejected_title', 'Request rejected')}
          description={request.reason || t('modreq_rejected_hint', 'Contact your administrator or submit a new request.')}
        />
        {onResubmit && (
          <Button
            type="primary"
            size="large"
            icon={<ReloadOutlined />}
            onClick={onResubmit}
            loading={loading}
            className={styles.glassPrimaryBtn}
          >
            {t('modreq_resubmit', 'Submit new request')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.pendingGlassLayout}>
      <StatusCard
        tone="success"
        icon={<CheckCircleOutlined />}
        title={t('modreq_approved_title', 'Modules approved')}
        description={t('modreq_approved_hint', 'Your approved modules are now active.')}
      />
      <div className={styles.glassModulePanel}>
        <div className={styles.reviewTags}>
          {(request.approved_modules || request.requested_modules || []).map(k => {
            const m = MODULES.find(x => x.key === k);
            return m ? (
              <span key={k} className={`${styles.glassModuleChip} ${styles.glassModuleChipApproved}`}>
                <span className={styles.glassModuleChipIcon}>{m.icon}</span>
                {t(m.labelKey, m.title)}
              </span>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}
