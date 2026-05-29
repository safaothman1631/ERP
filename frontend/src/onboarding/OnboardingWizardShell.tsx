import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloseOutlined } from '@ant-design/icons';
import { useViewport } from '../hooks/useViewport';
import styles from './OnboardingWizard.module.css';

interface OnboardingWizardShellProps {
  open: boolean;
  title: string;
  subtitle?: string;
  step: number;
  stepLabels: string[];
  onClose?: () => void;
  closable?: boolean;
  toolbar?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

export default function OnboardingWizardShell({
  open,
  title,
  subtitle,
  step,
  stepLabels,
  onClose,
  closable = true,
  toolbar,
  footer,
  children,
}: OnboardingWizardShellProps) {
  const { isMobile } = useViewport();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.backdrop} role="presentation">
      <div className={styles.ambientScene} aria-hidden>
        <div className={styles.orbA} />
        <div className={styles.orbB} />
        <div className={styles.orbC} />
        <div className={styles.gridOverlay} />
      </div>
      <div
        className={`${styles.shell} ${isMobile ? styles.shellMobile : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-wizard-title"
      >
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroTop}>
              <div>
                <h2 id="onb-wizard-title" className={styles.heroTitle}>{title}</h2>
                {subtitle && <p className={styles.heroSub}>{subtitle}</p>}
              </div>
              <div className={styles.heroActions}>
                {toolbar}
                {closable && onClose && (
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={onClose}
                    aria-label="Close"
                  >
                    <CloseOutlined />
                  </button>
                )}
              </div>
            </div>

            {isMobile && (
              <div className={styles.stepMetaMobile}>
                {step + 1} / {stepLabels.length} — {stepLabels[step]}
              </div>
            )}

            <nav className={styles.stepRow} aria-label="Progress">
              {stepLabels.map((label, i) => (
                <div key={label} className={styles.stepItem}>
                  <div
                    className={[
                      styles.stepDot,
                      i === step ? styles.stepDotActive : '',
                      i < step ? styles.stepDotDone : '',
                    ].filter(Boolean).join(' ')}
                    aria-current={i === step ? 'step' : undefined}
                  >
                    {i < step ? '✓' : i + 1}
                  </div>
                  {!isMobile && (
                    <span
                      className={[
                        styles.stepLabel,
                        i === step ? styles.stepLabelActive : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {label}
                    </span>
                  )}
                  {i < stepLabels.length - 1 && (
                    <div
                      className={[
                        styles.stepLine,
                        i < step ? styles.stepLineDone : '',
                      ].filter(Boolean).join(' ')}
                    />
                  )}
                </div>
              ))}
            </nav>
          </div>
        </header>

        <div className={styles.body}>{children}</div>
        <footer className={styles.footer}>{footer}</footer>
      </div>
    </div>,
    document.body,
  );
}
