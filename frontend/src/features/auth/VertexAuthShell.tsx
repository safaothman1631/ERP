/* ============================================================================
   VertexAuthShell — pixel-faithful port of the Vertex kit's AuthScreen
   (ui_kits/vertex-next/login.jsx): dark split-screen with a brand rail (46%)
   and a centred form (max-width 380). It is presentational + owns the form
   input state, and calls back into the real auth logic via `onSubmit` /
   `onGoogleToken`. LoginPage uses mode="signin", RegisterPage uses
   mode="signup". Markup + classes match the kit 1:1 so vx-kit.css styles it
   identically; tokens come from theme/vertex-tokens.css (global).
   ============================================================================ */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase';
import { Icon, Logo } from '../../vertex-proof/vx';
import '../../vertex-proof/vx-kit.css';

// ─── Values passed back to the page on submit ───────────────────────────────
export interface AuthSubmitValues {
  email: string;
  password: string;
  businessName: string;
  remember: boolean;
}

export interface VertexAuthShellProps {
  mode: 'signin' | 'signup';
  loading?: boolean;
  /** Disable the form (e.g. login locked-out). */
  disabled?: boolean;
  /** Rich error / notice content rendered in a danger banner above the form. */
  error?: React.ReactNode;
  /** Override the submit button label (e.g. "Account locked"). */
  submitLabel?: string;
  onSubmit: (values: AuthSubmitValues) => void;
  /** Receives a Firebase ID token + the current form values after a Google popup. */
  onGoogleToken?: (idToken: string, values: AuthSubmitValues) => void;
  onGoogleError?: (err: unknown) => void;
}

// ─── Demo personas (kit parity: role indicator + demo-account chips) ─────────
interface Role { id: string; en: string; ku: string; ar: string; accent: string }
const ROLES: Role[] = [
  { id: 'owner',      en: 'Owner',      ku: 'خاوەن',     ar: 'المالك',    accent: '#7B61FF' },
  { id: 'accountant', en: 'Accountant', ku: 'ژمێریار',   ar: 'محاسب',     accent: '#1FAE63' },
  { id: 'sales',      en: 'Sales',      ku: 'فرۆشتن',    ar: 'مبيعات',    accent: '#2E8FE0' },
  { id: 'inventory',  en: 'Inventory',  ku: 'کۆگا',      ar: 'المخزون',   accent: '#06B6D4' },
  { id: 'cashier',    en: 'Cashier',    ku: 'خەزنەدار',  ar: 'الصندوق',   accent: '#F59E0B' },
  { id: 'hr',         en: 'HR',         ku: 'مرۆیی',     ar: 'الموارد',   accent: '#C026D3' },
];
const ROLE_BY_ID: Record<string, Role> = ROLES.reduce((m, r) => { m[r.id] = r; return m; }, {} as Record<string, Role>);
function roleForEmail(email: string): string {
  const local = (email.split('@')[0] || '').toLowerCase();
  const hit = ROLES.find(r => local === r.id || local.startsWith(r.id));
  return hit ? hit.id : 'owner';
}

// ─── Tiny kit primitives (Field + password-capable Input) ────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-700)' }}>{label}</label>
    {children}
  </div>
);

const VxField: React.FC<{
  icon: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  name?: string;
  dir?: 'ltr' | 'rtl';
  disabled?: boolean;
  ariaLabel: string;
  suffix?: React.ReactNode;
}> = ({ icon, type = 'text', value, onChange, placeholder, autoComplete, name, dir, disabled, ariaLabel, suffix }) => (
  <div className="vx-input lg">
    <span className="ic"><Icon name={icon} size={16} /></span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      name={name}
      dir={dir}
      disabled={disabled}
      aria-label={ariaLabel}
      style={dir === 'ltr' ? { textAlign: 'start', direction: 'ltr' } : undefined}
    />
    {suffix && <span className="ic">{suffix}</span>}
  </div>
);

// ─── Shell ───────────────────────────────────────────────────────────────────
const VertexAuthShell: React.FC<VertexAuthShellProps> = ({
  mode, loading = false, disabled = false, error, submitLabel, onSubmit, onGoogleToken, onGoogleError,
}) => {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ku').slice(0, 2) as 'ku' | 'en' | 'ar';
  const tr = (en: string, ku: string, ar?: string) => (lang === 'ku' ? ku : lang === 'ar' ? (ar ?? en) : en);

  const signup = mode === 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const values = (): AuthSubmitValues => ({ email, password, businessName, remember });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || loading) return;
    onSubmit(values());
  };

  const handleGoogle = async () => {
    if (disabled || googleLoading) return;
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      onGoogleToken?.(idToken, values());
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request' && code !== 'auth/user-cancelled') {
        onGoogleError?.(err);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const cycleLang = () => {
    const order: Array<'ku' | 'en' | 'ar'> = ['ku', 'en', 'ar'];
    const next = order[(order.indexOf(lang) + 1) % order.length];
    void i18n.changeLanguage(next);
  };

  const feats: Array<[string, string]> = [
    ['box',     tr('Accounting, sales, inventory & POS in one app', 'ژمێریاری، فرۆشتن، کۆگا و POS لە یەک ئەپدا', 'المحاسبة والمبيعات والمخزون ونقاط البيع في تطبيق واحد')],
    ['globe',   tr('Arabic · Kurdish · English, full RTL', 'عەرەبی · کوردی · ئینگلیزی، RTL ی تەواو', 'العربية · الكردية · الإنجليزية، دعم كامل لليمين')],
    ['settings',tr('Role-based access & audit trails', 'دەستڕاگەیشتنی ڕۆڵ-بنەما و تۆماری چاودێری', 'صلاحيات حسب الدور وسجلّات تدقيق')],
    ['trendUp', tr('Live dashboards across every module', 'داشبۆردی زیندوو بۆ هەموو مۆدیوولێک', 'لوحات بيانات حية لكل وحدة')],
  ];

  const role = useMemo(() => ROLE_BY_ID[roleForEmail(email)], [email]);

  return (
    <div className="vx-root" data-theme="dark" style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      {/* language switch */}
      <button
        onClick={cycleLang}
        title="Language / زمان"
        style={{
          position: 'fixed', top: 18, insetInlineEnd: 20, zIndex: 80,
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 999,
          border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink-700)', fontSize: 12.5, fontWeight: 600,
        }}
      >
        <Icon name="globe" size={15} />{lang === 'ku' ? 'کوردی' : lang === 'ar' ? 'عربي' : 'English'}
      </button>

      {/* ── brand rail ── */}
      <div
        className="auth-rail"
        style={{
          flex: '0 0 46%', position: 'relative', overflow: 'hidden', borderInlineEnd: '1px solid var(--border)',
          background: 'linear-gradient(160deg, var(--surface), var(--bg))',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '44px 48px',
        }}
      >
        <div style={{ position: 'absolute', top: -160, insetInlineStart: -100, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,97,255,0.4), transparent 68%)', filter: 'blur(80px)', opacity: 0.6 }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(127,127,127,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(127,127,127,0.06) 1px,transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(ellipse 70% 70% at 30% 30%,#000,transparent)', WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 30% 30%,#000,transparent)' }} />
        <div style={{ position: 'relative' }}><Logo size={30} wordmark={false} /></div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--ink-900)', maxWidth: '15ch' }}>
            {tr('Run your whole business on one platform.', 'هەموو بزنسەکەت لە یەک پلاتفۆرمدا بەڕێوەببە.', 'أدِر عملك بالكامل على منصة واحدة.')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
            {feats.map((f) => (
              <div key={f[1]} style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: 14, color: 'var(--ink-700)' }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={f[0]} size={15} />
                </span>{f[1]}
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', fontSize: 12.5, color: 'var(--ink-500)' }}>
          {tr('Trusted by growing businesses across Iraq', 'پشتبەستراو لەلایەن بزنسە گەشەسەندووەکانی عێراق', 'موثوق من الشركات النامية في العراق')}
        </div>
      </div>

      {/* ── form ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }} className="vx-scroll">
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-900)', margin: 0 }}>
            {signup ? tr('Create your account', 'هەژمارەکەت دروست بکە', 'أنشئ حسابك') : tr('Welcome back', 'بەخێربێیتەوە', 'مرحبًا بعودتك')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-500)', margin: '7px 0 28px' }}>
            {signup
              ? tr('Start your free trial — no card required.', 'تاقیکردنەوەی بەخۆڕایی دەست پێبکە — پێویست بە کارت ناکات.', 'ابدأ تجربتك المجانية — لا حاجة لبطاقة.')
              : tr('Sign in to your workspace.', 'بچۆ ژوورەوە بۆ شوێنی کارەکەت.', 'سجّل الدخول إلى مساحة عملك.')}
          </p>

          {error && (
            <div
              role="alert"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 13px', marginBottom: 16,
                borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', color: 'var(--danger-fg)',
                border: '1px solid color-mix(in srgb, var(--danger-500) 32%, transparent)', fontSize: 13, lineHeight: 1.5,
              }}
            >
              <span style={{ marginTop: 1, flexShrink: 0 }}><Icon name="clock" size={15} /></span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {signup && (
              <Field label={tr('Business name', 'ناوی بزنس', 'اسم النشاط')}>
                <VxField
                  icon="building" name="organization" autoComplete="organization"
                  value={businessName} onChange={setBusinessName} disabled={disabled}
                  placeholder={tr('e.g. Zagros Trading', 'بۆ نموونە: بازرگانی زاگرۆس', 'مثال: زاكروس للتجارة')}
                  ariaLabel={tr('Business name', 'ناوی بزنس', 'اسم النشاط')}
                />
              </Field>
            )}
            <Field label={tr('Email', 'ئیمەیڵ', 'البريد الإلكتروني')}>
              <VxField
                icon="mail" type="email" name="email" autoComplete="email" dir="ltr"
                value={email} onChange={setEmail} disabled={disabled}
                placeholder="you@business.iq" ariaLabel={tr('Email', 'ئیمەیڵ', 'البريد الإلكتروني')}
              />
            </Field>
            <Field label={tr('Password', 'تێپەڕەوشە', 'كلمة المرور')}>
              <VxField
                icon="lock" type={showPw ? 'text' : 'password'} name="password" dir="ltr"
                autoComplete={signup ? 'new-password' : 'current-password'}
                value={password} onChange={setPassword} disabled={disabled}
                placeholder="••••••••" ariaLabel={tr('Password', 'تێپەڕەوشە', 'كلمة المرور')}
                suffix={
                  <button
                    type="button" onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? tr('Hide password', 'شاردنەوەی تێپەڕەوشە', 'إخفاء كلمة المرور') : tr('Show password', 'پیشاندانی تێپەڕەوشە', 'إظهار كلمة المرور')}
                    style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', color: 'var(--ink-300)', display: 'flex' }}
                  >
                    <Icon name="eye" size={16} />
                  </button>
                }
              />
            </Field>

            {!signup && role && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-500)', marginTop: -4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: role.accent, boxShadow: `0 0 0 3px color-mix(in srgb, ${role.accent} 22%, transparent)` }} />
                {tr('Signing in as', 'چوونەژوورەوە وەک', 'تسجيل الدخول كـ')} <b style={{ color: 'var(--ink-700)' }}>{lang === 'ku' ? role.ku : lang === 'ar' ? role.ar : role.en}</b>
              </div>
            )}

            {!signup && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ink-600)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ accentColor: 'var(--accent-500)', width: 15, height: 15 }} />
                  {tr('Remember me', 'بیرم بمێنێتەوە', 'تذكّرني')}
                </label>
                <Link to="/forgot-password" style={{ color: 'var(--accent-400)', fontWeight: 500 }}>{tr('Forgot password?', 'تێپەڕەوشەت بیرچووە؟', 'نسيت كلمة المرور؟')}</Link>
              </div>
            )}

            <button type="submit" className="vx-btn vx-btn-accent vx-btn-lg" style={{ width: '100%', marginTop: 4 }} disabled={disabled || loading}>
              {loading
                ? tr('Please wait…', 'تکایە چاوەڕێ بکە…', 'يرجى الانتظار…')
                : submitLabel || (signup ? tr('Create account', 'دروستکردنی هەژمار', 'إنشاء حساب') : tr('Sign in', 'چوونەژوورەوە', 'تسجيل الدخول'))}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0', color: 'var(--ink-300)', fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />{tr('or', 'یان', 'أو')}<span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button type="button" className="vx-btn vx-btn-default" style={{ width: '100%' }} onClick={handleGoogle} disabled={disabled || googleLoading}>Google</button>
            <button type="button" className="vx-btn vx-btn-default" style={{ width: '100%' }} onClick={handleGoogle} disabled={disabled || googleLoading}>Microsoft</button>
          </div>

          <p style={{ marginTop: 20, fontSize: 13, color: 'var(--ink-500)', textAlign: 'center' }}>
            {signup ? tr('Already have an account? ', 'پێشتر هەژمارت هەیە؟ ', 'لديك حساب بالفعل؟ ') : tr("Don't have an account? ", 'هەژمارت نییە؟ ', 'ليس لديك حساب؟ ')}
            <Link to={signup ? '/login' : '/signup'} style={{ color: 'var(--accent-400)', fontWeight: 600 }}>
              {signup ? tr('Sign in', 'بچۆ ژوورەوە', 'سجّل الدخول') : tr('Create one', 'یەکێک دروست بکە', 'أنشئ حسابًا')}
            </Link>
          </p>

          {!signup && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-300)', marginBottom: 10, textAlign: 'center' }}>
                {tr('Demo accounts — tap to fill', 'هەژماری دیمۆ — بۆ پڕکردنەوە دایگرە', 'حسابات تجريبية — انقر للتعبئة')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
                {ROLES.map((r) => {
                  const on = email === r.id + '@zagros.iq';
                  return (
                    <button
                      key={r.id} type="button" onClick={() => setEmail(r.id + '@zagros.iq')}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 999,
                        border: '1px solid ' + (on ? r.accent : 'var(--border-strong)'),
                        background: on ? `color-mix(in srgb, ${r.accent} 14%, transparent)` : 'var(--surface)',
                        color: on ? r.accent : 'var(--ink-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.accent }} />{lang === 'ku' ? r.ku : lang === 'ar' ? r.ar : r.en}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-300)', textAlign: 'center', marginTop: 10, fontFamily: 'var(--font-mono)' }}>
                {tr('password', 'تێپەڕەوشە', 'كلمة المرور')}: demo
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@media (max-width:820px){.auth-rail{display:none!important}}`}</style>
    </div>
  );
};

export default VertexAuthShell;
