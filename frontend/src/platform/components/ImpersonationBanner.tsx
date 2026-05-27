import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { useImpersonationStore } from '../store/impersonationStore';
import { usePlatformAccess } from '../hooks/usePlatformAccess';
import styles from '../theme/PlatformGlass.module.css';

export default function ImpersonationBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { isImpersonating } = usePlatformAccess();
  const { adminSession, clearAdminSession } = useImpersonationStore();

  if (!isImpersonating || !adminSession) return null;

  const exitImpersonation = async () => {
    try {
      await fetch('/api/platform/impersonate/exit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
    } catch { /* restore locally anyway */ }
    login(
      adminSession.token,
      adminSession.userId,
      adminSession.orgId,
      adminSession.userName,
      adminSession.userRole || undefined,
    );
    clearAdminSession();
    navigate('/platform');
  };

  return (
    <div className={styles.impersonationBanner} role="status">
      <span>{t('platform.impersonating', 'You are viewing as another user')}</span>
      <Button size="small" type="primary" ghost onClick={exitImpersonation}>
        {t('platform.exit_impersonation', 'Exit impersonation')}
      </Button>
    </div>
  );
}
