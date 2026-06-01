/**
 * OnboardingShell (T-LR.3.2)
 *
 * Spec: launch-readiness design.md §4.2
 *
 * 5-step "first 60 seconds" wizard shell:
 *   - Header with brand + progress bar (1/5 … 5/5)
 *   - Main: animated step slot (Framer Motion slide, RTL-aware)
 *   - Footer: Back / Skip / Next (Antd buttons)
 *   - Auto-save on step change (handled inside the store's `next`/`skip`/`back`)
 *   - Confetti animation on complete (CSS-only, lightweight)
 *   - prefers-reduced-motion fallback to crossfade
 *
 * Route wiring TODO: `App.routes.tsx` must mount this at `/onboarding`.
 * That wiring is owned by another agent — see `_deltas/R3-frontend-summary.md`.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Button, Progress, theme as antdTheme } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, RocketOutlined } from '@ant-design/icons';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { useOnboardingWizardStore, type StepNumber } from './state';
import { telemetry } from './telemetry';

import StepCompanyInfo from './steps/StepCompanyInfo';
import StepIraqRegion from './steps/StepIraqRegion';
import StepChartOfAccounts from './steps/StepChartOfAccounts';
import StepPOSHardware from './steps/StepPOSHardware';
import StepFirstSale from './steps/StepFirstSale';

const STEP_COMPONENTS: Record<StepNumber, React.ComponentType> = {
  1: StepCompanyInfo,
  2: StepIraqRegion,
  3: StepChartOfAccounts,
  4: StepPOSHardware,
  5: StepFirstSale,
};

interface OnboardingShellProps {
  onExit?: () => void;
}

export default function OnboardingShell({ onExit }: OnboardingShellProps) {
  const { t, i18n } = useTranslation('onboarding');
  const { token } = antdTheme.useToken();
  const reducedMotion = useReducedMotion();

  const currentStep = useOnboardingWizardStore((s) => s.currentStep);
  const canProceed = useOnboardingWizardStore((s) => s.canProceed);
  const completedAt = useOnboardingWizardStore((s) => s.completedAt);
  const startedAt = useOnboardingWizardStore((s) => s.startedAt);

  const next = useOnboardingWizardStore((s) => s.next);
  const back = useOnboardingWizardStore((s) => s.back);
  const skip = useOnboardingWizardStore((s) => s.skip);
  const start = useOnboardingWizardStore((s) => s.start);
  const hydrate = useOnboardingWizardStore((s) => s.hydrate);

  const isRtl = i18n.dir() === 'rtl';
  const StepComponent = STEP_COMPONENTS[currentStep];
  const stepTitleKey = `step.${currentStep}.title`;
  const stepDescKey = `step.${currentStep}.description`;

  // Mount: hydrate from backend, mark wizard as started
  useEffect(() => {
    void hydrate().finally(() => {
      start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track abandonment on unmount (still incomplete)
  const startedAtRef = useRef<number | null>(null);
  startedAtRef.current = startedAt;
  const currentStepRef = useRef<StepNumber>(currentStep);
  currentStepRef.current = currentStep;
  const completedRef = useRef<boolean>(false);
  completedRef.current = !!completedAt;

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!completedRef.current && startedAtRef.current) {
        telemetry.abandoned(currentStepRef.current, Date.now() - startedAtRef.current);
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const stepLabels = useMemo(
    () => [1, 2, 3, 4, 5].map((n) => t(`step.${n}.label`)),
    [t],
  );

  // Slide animation variants (RTL-aware). prefers-reduced-motion -> crossfade.
  const slideVariants = useMemo(
    () =>
      reducedMotion
        ? {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
          }
        : {
            initial: { opacity: 0, x: isRtl ? -32 : 32 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: isRtl ? 32 : -32 },
          },
    [reducedMotion, isRtl],
  );

  // Completion screen
  if (completedAt) {
    return <CompletionScreen onExit={onExit} />;
  }

  return (
    <div
      role="region"
      aria-label={t('title')}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: token.colorBgLayout,
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '20px 24px 12px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RocketOutlined style={{ fontSize: 20, color: token.colorPrimary }} aria-hidden />
            <strong style={{ fontSize: 18, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{t('title')}</strong>
          </div>
          <span
            style={{ fontSize: 12, color: token.colorTextSecondary }}
            aria-live="polite"
          >
            {t('progress.label', { current: currentStep, total: 5 })}
          </span>
        </div>
        <Progress
          percent={(currentStep / 5) * 100}
          showInfo={false}
          strokeColor={token.colorPrimary}
          trailColor={token.colorFillSecondary}
          aria-label={t('progress.label', { current: currentStep, total: 5 })}
        />
        <nav aria-label={t('progress.label', { current: currentStep, total: 5 })} style={{ marginTop: 8 }}>
          <ol style={{ display: 'flex', gap: 8, padding: 0, margin: 0, listStyle: 'none', flexWrap: 'wrap' }}>
            {stepLabels.map((label, i) => {
              const n = (i + 1) as StepNumber;
              const isActive = n === currentStep;
              const isDone = n < currentStep;
              return (
                <li
                  key={n}
                  aria-current={isActive ? 'step' : undefined}
                  style={{
                    fontSize: 12,
                    color: isActive
                      ? token.colorPrimary
                      : isDone
                      ? token.colorSuccess
                      : token.colorTextSecondary,
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {isDone ? '✓' : `${n}.`} {label}
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      {/* Main step area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          padding: '32px 16px',
          overflowY: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: 880 }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 24, color: token.colorTextHeading, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.02em' }}>
              {t(stepTitleKey)}
            </h2>
            <p style={{ margin: '8px 0 0', color: token.colorTextSecondary }}>
              {t(stepDescKey)}
            </p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={currentStep}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: reducedMotion ? 0.15 : 0.24, ease: 'easeInOut' }}
              aria-live="polite"
            >
              <StepComponent />
            </motion.section>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: '16px 24px',
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div>
          {currentStep > 1 && (
            <Button
              icon={isRtl ? <ArrowRightOutlined /> : <ArrowLeftOutlined />}
              onClick={back}
            >
              {t('cta.back')}
            </Button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button type="text" onClick={skip} aria-label={t('cta.skip')}>
            {t('cta.skip')}
          </Button>
          {currentStep < 5 ? (
            <Button
              type="primary"
              disabled={!canProceed}
              onClick={next}
              iconPosition={isRtl ? 'start' : 'end'}
              icon={isRtl ? <ArrowLeftOutlined /> : <ArrowRightOutlined />}
            >
              {t('cta.next')}
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<RocketOutlined />}
              disabled={!canProceed}
              onClick={() => void useOnboardingWizardStore.getState().complete()}
            >
              {t('cta.finish')}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Completion screen — confetti (CSS-only) + dashboard CTA
// ─────────────────────────────────────────────────────────────────────────────

function CompletionScreen({ onExit }: { onExit?: () => void }) {
  const { t } = useTranslation('onboarding');
  const { token } = antdTheme.useToken();
  const reducedMotion = useReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
        background: token.colorBgLayout,
      }}
    >
      {!reducedMotion && <ConfettiBurst />}
      <div style={{ fontSize: 64, marginBottom: 16 }} aria-hidden>🎉</div>
      <h1 style={{ margin: 0, fontSize: 32, color: token.colorTextHeading, textAlign: 'center' }}>
        {t('complete.title')}
      </h1>
      <p style={{ marginTop: 12, fontSize: 16, color: token.colorTextSecondary, textAlign: 'center', maxWidth: 520 }}>
        {t('complete.message')}
      </p>
      <Button
        type="primary"
        size="large"
        style={{ marginTop: 32 }}
        icon={<RocketOutlined />}
        onClick={() => {
          if (onExit) onExit();
          else window.location.href = '/dashboard?welcome=true';
        }}
      >
        {t('complete.go_to_dashboard')}
      </Button>
    </div>
  );
}

function ConfettiBurst() {
  // CSS-only confetti: 24 absolutely-positioned colored dots that fall + rotate.
  const colors = ['#f43f5e', '#fb923c', '#facc15', '#22c55e', '#06b6d4', '#7B61FF', '#a855f7'];
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    left: `${(i / 24) * 100}%`, /* rtl-ignore */
    delay: `${(i % 8) * 0.12}s`,
    color: colors[i % colors.length],
    duration: `${1.6 + ((i * 13) % 800) / 1000}s`,
    size: 6 + (i % 4) * 2,
  }));
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <style>{`
        @keyframes onb-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            left: p.left, /* rtl-ignore */
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: 2,
            animation: `onb-confetti-fall ${p.duration} ease-in ${p.delay} forwards`,
          }}
        />
      ))}
    </div>
  );
}
