import styles from '../theme/PlatformGlass.module.css';

interface KpiStatProps {
  label: string;
  value: string | number;
}

export default function KpiStat({ label, value }: KpiStatProps) {
  return (
    <div className={styles.kpiStat}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
    </div>
  );
}
