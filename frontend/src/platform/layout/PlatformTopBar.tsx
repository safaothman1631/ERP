import { Avatar, Button, Space } from 'antd';
import { MenuOutlined, LogoutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import styles from '../theme/PlatformGlass.module.css';

interface PlatformTopBarProps {
  onMenuClick?: () => void;
  showMenu?: boolean;
}

export default function PlatformTopBar({ onMenuClick, showMenu }: PlatformTopBarProps) {
  const { t } = useTranslation();
  const { userName, theme, toggleTheme, logout } = useAuthStore();

  return (
    <header className={styles.topBar}>
      <Space>
        {showMenu && (
          <Button type="text" icon={<MenuOutlined />} onClick={onMenuClick} aria-label={t('platform.menu', 'Menu')} />
        )}
        <Space size={8}>
          <Avatar size={28} style={{ background: '#6366F1', fontWeight: 700 }}>
            {(userName || 'P').slice(0, 1).toUpperCase()}
          </Avatar>
          <span>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#6366F1', textTransform: 'uppercase' }}>
              {t('roles.platform_admin', 'Platform Admin')}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{userName || t('platform.admin', 'Platform Admin')}</span>
          </span>
        </Space>
      </Space>
      <Space>
        <LanguageSwitcher />
        <Button type="text" onClick={toggleTheme}>
          {theme === 'dark' ? t('platform.light', 'Light') : t('platform.dark', 'Dark')}
        </Button>
        <Button type="text" icon={<LogoutOutlined />} onClick={logout}>
          {t('logout', 'Logout')}
        </Button>
      </Space>
    </header>
  );
}
