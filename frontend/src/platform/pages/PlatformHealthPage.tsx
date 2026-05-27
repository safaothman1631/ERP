import SystemHealthPage from '../../pages/settings/SystemHealthPage';
import DataIntegrityPanel from '../components/DataIntegrityPanel';
import PlatformPageHeader from '../components/PlatformPageHeader';
import { useTranslation } from 'react-i18next';

export default function PlatformHealthPage() {
  const { t } = useTranslation();
  return (
    <>
      <PlatformPageHeader title={t('platform.nav.health', 'System health')} />
      <SystemHealthPage />
      <DataIntegrityPanel />
    </>
  );
}
