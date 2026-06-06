/* ============================================================================
   VertexAuthShell — pixel-faithful port of the Vertex kit's AuthScreen
   (ui_kits/vertex-next/login.jsx): dark split-screen with a brand rail (46%)
   and a centred form (max-width 380). Handles all four auth modes the kit does
   — signin / signup / forgot / reset — plus the post-submit success screens.

   It is presentational + owns the form input state, and calls back into the
   real auth logic via `onSubmit` / `onGoogleToken`:
     - LoginPage      → mode="signin"
     - RegisterPage   → mode="signup"
     - ForgotPassword → mode="forgot"  (set `done` to show the sent screen)
     - ResetPassword  → mode="reset"   (set `done` to show the success screen)

   Markup + classes match the kit 1:1 so vx-kit.css styles it identically;
   tokens come from theme/vertex-tokens.css (global).
   ============================================================================ */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase';
import { Icon, Logo } from '../../vertex-proof/vx';
import '../../vertex-proof/vx-kit.css';

export type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

// ─── Values passed back to the page on submit ───────────────────────────────
export interface AuthSubmitValues {
  email: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  fullName: string;
  remember: boolean;
}

export interface VertexAuthShellProps {
  mode: AuthMode;
  loading?: boolean;
  /** Disable the form (e.g. login locked-out, or reset link missing). */
  disabled?: boolean;
  /** Rich error / notice content rendered in a danger banner above the form. */
  error?: React.ReactNode;
  /** Override the submit button label (e.g. "Account locked"). */
  submitLabel?: string;
  /** Show the post-submit success screen: 'sent' (forgot) | 'success' (reset) |
   *  'created' (signup — confirms the account was created). */
  done?: 'sent' | 'success' | 'created';
  /** Email to show on the signup "created" confirmation screen. */
  createdEmail?: string;
  /** Continue handler for the signup "created" screen (→ onboarding). */
  onContinue?: () => void;
  onSubmit: (values: AuthSubmitValues) => void;
  /** Resend handler for the forgot "Check your email" screen. */
  onResend?: () => void;
  /** Receives a Firebase ID token + the current form values after a Google popup. */
  onGoogleToken?: (idToken: string, values: AuthSubmitValues) => void;
  onGoogleError?: (err: unknown) => void;
}

// ─── Tiny kit primitives (Field + password-capable Input) ────────────────────
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-700)' }}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: -1, lineHeight: 1.45 }}>{hint}</div>}
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

// ─── Password strength (signup) ──────────────────────────────────────────────
function pwChecks(pw: string) {
  return {
    minLength: pw.length >= 8,
    hasUppercase: /[A-Z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw),
  };
}
function pwScore(pw: string): number {
  const c = pwChecks(pw);
  return [c.minLength, c.hasUppercase, c.hasNumber, c.hasSpecial].filter(Boolean).length;
}

// ─── Shell ───────────────────────────────────────────────────────────────────
const VertexAuthShell: React.FC<VertexAuthShellProps> = ({
  mode, loading = false, disabled = false, error, submitLabel, done, createdEmail, onContinue,
  onSubmit, onResend, onGoogleToken, onGoogleError,
}) => {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ku').slice(0, 2) as 'ku' | 'en' | 'ar';
  const tr = (en: string, ku: string, ar?: string) => (lang === 'ku' ? ku : lang === 'ar' ? (ar ?? en) : en);

  const signup = mode === 'signup';
  const signin = mode === 'signin';
  const forgot = mode === 'forgot';
  const reset = mode === 'reset';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const values = (): AuthSubmitValues => ({ email, password, confirmPassword, businessName, fullName, remember });

  // Client-side validation per mode; returns an error string or null.
  const validate = (): string | null => {
    if (signup) {
      // Business name is OPTIONAL — an individual can register without a company
      // (the workspace is named after them). Only the person's name is required.
      if (!fullName.trim()) return tr('Your name is required', 'ناوت پێویستە', 'الاسم مطلوب');
    }
    if ((signin || signup || forgot) && !email.trim()) return tr('Email is required', 'ئیمەیڵ پێویستە', 'البريد الإلكتروني مطلوب');
    if (signin || signup || reset) {
      if (!password) return tr('Password is required', 'تێپەڕەوشە پێویستە', 'كلمة المرور مطلوبة');
    }
    if (signup && pwScore(password) < 4) {
      return tr('Password needs 8+ characters, an uppercase letter, a number and a symbol.',
        'تێپەڕەوشە پێویستی بە ٨+ پیت، پیتی گەورە، ژمارە و هێما هەیە.',
        'تحتاج كلمة المرور إلى ٨+ أحرف وحرف كبير ورقم ورمز.');
    }
    if (reset && password.length < 6) {
      return tr('Password must be at least 6 characters', 'تێپەڕەوشە دەبێت لانیکەم ٦ پیت بێت', 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل');
    }
    if ((signup || reset) && password !== confirmPassword) {
      return tr('Passwords do not match', 'تێپەڕەوشەکان وەک یەک نین', 'كلمتا المرور غير متطابقتين');
    }
    return null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || loading) return;
    const v = validate();
    if (v) { setLocalError(v); return; }
    setLocalError(null);
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

  const bannerError = error || localError;
  const eyeSuffix = (
    <button
      type="button" onClick={() => setShowPw((s) => !s)}
      aria-label={showPw ? tr('Hide password', 'شاردنەوەی تێپەڕەوشە', 'إخفاء كلمة المرور') : tr('Show password', 'پیشاندانی تێپەڕەوشە', 'إظهار كلمة المرور')}
      style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', color: 'var(--ink-300)', display: 'flex' }}
    >
      <Icon name="eye" size={16} />
    </button>
  );

  // ── Headline + subtitle per mode ──
  const headline = signup
    ? tr('Create your account', 'هەژمارەکەت دروست بکە', 'أنشئ حسابك')
    : forgot
      ? tr('Forgot password?', 'تێپەڕەوشەت بیرچووە؟', 'نسيت كلمة المرور؟')
      : reset
        ? tr('Set a new password', 'تێپەڕەوشەی نوێ دابنێ', 'عيّن كلمة مرور جديدة')
        : tr('Welcome back', 'بەخێربێیتەوە', 'مرحبًا بعودتك');
  const subtitle = signup
    ? tr('Start your free trial — no card required.', 'تاقیکردنەوەی بەخۆڕایی دەست پێبکە — پێویست بە کارت ناکات.', 'ابدأ تجربتك المجانية — لا حاجة لبطاقة.')
    : forgot
      ? tr('Enter the email linked to your account and we’ll send you a reset link.', 'ئەو ئیمەیڵە بنووسە کە بەستراوەتەوە بە هەژمارەکەت، لینکی ڕێکخستنەوەت بۆ دەنێرین.', 'أدخل البريد المرتبط بحسابك وسنرسل لك رابط إعادة التعيين.')
      : reset
        ? tr('Choose a strong password you haven’t used before.', 'تێپەڕەوشەیەکی بەهێز هەڵبژێرە کە پێشتر بەکارت نەهێناوە.', 'اختر كلمة مرور قوية لم تستخدمها من قبل.')
        : tr('Sign in to your workspace.', 'بچۆ ژوورەوە بۆ شوێنی کارەکەت.', 'سجّل الدخول إلى مساحة عملك.');

  const score = pwScore(password);
  const strengthLabel = [
    tr('Too weak', 'زۆر لاواز', 'ضعيفة جدًا'),
    tr('Weak', 'لاواز', 'ضعيفة'),
    tr('Fair', 'مامناوەند', 'متوسطة'),
    tr('Good', 'باش', 'جيدة'),
    tr('Strong', 'بەهێز', 'قوية'),
  ][score];
  const strengthColor = ['var(--danger-500)', 'var(--danger-500)', 'var(--warning-500)', 'var(--accent-500)', 'var(--success-500)'][score];

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

          {/* ---------- DONE: reset link sent ---------- */}
          {forgot && done === 'sent' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--success-bg)', color: 'var(--success-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}><Icon name="mail" size={26} /></div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-900)', margin: 0 }}>{tr('Check your email', 'ئیمەیڵەکەت بپشکنە', 'تحقّق من بريدك')}</h1>
              <p style={{ fontSize: 14, color: 'var(--ink-500)', margin: '8px 0 24px', lineHeight: 1.6 }}>
                {tr('We sent a password reset link to ', 'لینکی ڕێکخستنەوەی تێپەڕەوشەمان نارد بۆ ', 'أرسلنا رابط إعادة تعيين كلمة المرور إلى ')}
                <b style={{ color: 'var(--ink-700)' }} dir="ltr">{email || 'your email'}</b>.
                {' '}{tr('It expires in 30 minutes.', 'دوای ٣٠ خولەک بەسەردەچێت.', 'تنتهي صلاحيته خلال ٣٠ دقيقة.')}
              </p>
              <Link to="/login" className="vx-btn vx-btn-accent vx-btn-lg" style={{ width: '100%' }}>{tr('Back to sign in', 'گەڕانەوە بۆ چوونەژوورەوە', 'العودة لتسجيل الدخول')}</Link>
              {onResend && (
                <p style={{ marginTop: 18, fontSize: 13, color: 'var(--ink-500)' }}>
                  {tr("Didn't get it? ", 'وەرتنەگرت؟ ', 'لم يصلك؟ ')}
                  <a onClick={() => onResend()} style={{ color: 'var(--accent-400)', fontWeight: 600, cursor: 'pointer' }}>{tr('Resend', 'دووبارە ناردن', 'إعادة الإرسال')}</a>
                </p>
              )}
            </div>
          )}

          {/* ---------- DONE: password reset success ---------- */}
          {reset && done === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--success-bg)', color: 'var(--success-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}><Icon name="checkCircle" size={26} /></div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-900)', margin: 0 }}>{tr('Password reset', 'تێپەڕەوشە ڕێکخرایەوە', 'تمت إعادة التعيين')}</h1>
              <p style={{ fontSize: 14, color: 'var(--ink-500)', margin: '8px 0 24px', lineHeight: 1.6 }}>{tr('Your password has been updated. You can now sign in.', 'تێپەڕەوشەکەت نوێکرایەوە. ئێستا دەتوانیت بچیتە ژوورەوە.', 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.')}</p>
              <Link to="/login" className="vx-btn vx-btn-accent vx-btn-lg" style={{ width: '100%' }}>{tr('Sign in', 'چوونەژوورەوە', 'تسجيل الدخول')}</Link>
            </div>
          )}

          {/* ---------- DONE: account created (signup confirmation) ---------- */}
          {signup && done === 'created' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--success-bg)', color: 'var(--success-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><Icon name="checkCircle" size={30} /></div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink-900)', margin: 0 }}>{tr('Account created 🎉', 'هەژمارەکەت دروستکرا 🎉', 'تم إنشاء الحساب 🎉')}</h1>
              <p style={{ fontSize: 14, color: 'var(--ink-500)', margin: '10px 0 6px', lineHeight: 1.6 }}>
                {tr('Your account is ready', 'هەژمارەکەت ئامادەیە', 'حسابك جاهز')}
                {createdEmail ? <> — <b style={{ color: 'var(--ink-700)' }} dir="ltr">{createdEmail}</b></> : null}.
              </p>
              <p style={{ fontSize: 13.5, color: 'var(--ink-500)', margin: '0 0 24px', lineHeight: 1.6 }}>
                {tr('You can sign in any time with this email and password.',
                  'هەر کاتێک دەتوانیت بە هەمان ئیمەیڵ و تێپەڕەوشە بچیتە ژوورەوە.',
                  'يمكنك تسجيل الدخول في أي وقت بهذا البريد وكلمة المرور.')}
              </p>
              <button type="button" className="vx-btn vx-btn-accent vx-btn-lg" style={{ width: '100%' }} onClick={() => onContinue?.()} disabled={loading}>
                {loading ? tr('Please wait…', 'تکایە چاوەڕێ بکە…', 'يرجى الانتظار…') : tr('Continue to setup', 'بەردەوامبە بۆ ڕێکخستن', 'المتابعة إلى الإعداد')}
              </button>
            </div>
          )}

          {/* ---------- FORM (signin / signup / forgot / reset) ---------- */}
          {!done && (<>
            {(forgot || reset) && (
              <Link to="/login" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ paddingInlineStart: 0, marginBottom: 14 }}>
                <Icon name="chevronLeft" size={15} style={{ transform: lang === 'ku' || lang === 'ar' ? 'scaleX(-1)' : 'none' }} />
                {tr('Back to sign in', 'گەڕانەوە بۆ چوونەژوورەوە', 'العودة لتسجيل الدخول')}
              </Link>
            )}

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-900)', margin: 0 }}>{headline}</h1>
            <p style={{ fontSize: 14, color: 'var(--ink-500)', margin: '7px 0 28px', lineHeight: 1.55 }}>{subtitle}</p>

            {bannerError && (
              <div
                role="alert"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 13px', marginBottom: 16,
                  borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', color: 'var(--danger-fg)',
                  border: '1px solid color-mix(in srgb, var(--danger-500) 32%, transparent)', fontSize: 13, lineHeight: 1.5,
                }}
              >
                <span style={{ marginTop: 1, flexShrink: 0 }}><Icon name="clock" size={15} /></span>
                <span>{bannerError}</span>
              </div>
            )}

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {signup && (
                <Field label={tr('Full name', 'ناوی تەواو', 'الاسم الكامل')}>
                  <VxField icon="users" name="name" autoComplete="name" value={fullName} onChange={setFullName} disabled={disabled}
                    placeholder={tr('e.g. Safa Othman', 'بۆ نموونە: سەفا عوسمان', 'مثال: صفا عثمان')} ariaLabel={tr('Full name', 'ناوی تەواو', 'الاسم الكامل')} />
                </Field>
              )}
              {signup && (
                <Field
                  label={tr('Business name (optional)', 'ناوی بزنس (ئیختیاری)', 'اسم النشاط (اختياري)')}
                  hint={tr(
                    'Have a company? Add it. Registering as an individual? Leave it empty — we’ll name your workspace after you.',
                    'کۆمپانیات هەیە؟ زیادی بکە. وەک کەسێک تۆمار دەبیت؟ بەتاڵی بهێڵە — شوێنی کارەکەت بە ناوی خۆت دادەنێین.',
                    'لديك شركة؟ أضِفها. تسجّل كفرد؟ اتركه فارغًا — سنسمّي مساحة عملك باسمك.',
                  )}
                >
                  <VxField icon="building" name="organization" autoComplete="organization" value={businessName} onChange={setBusinessName} disabled={disabled}
                    placeholder={tr('e.g. Zagros Trading', 'بۆ نموونە: بازرگانی زاگرۆس', 'مثال: زاكروس للتجارة')} ariaLabel={tr('Business name', 'ناوی بزنس', 'اسم النشاط')} />
                </Field>
              )}

              {(signin || signup || forgot) && (
                <Field label={tr('Email', 'ئیمەیڵ', 'البريد الإلكتروني')}>
                  <VxField icon="mail" type="email" name="email" autoComplete="email" dir="ltr" value={email} onChange={setEmail} disabled={disabled}
                    placeholder="you@business.iq" ariaLabel={tr('Email', 'ئیمەیڵ', 'البريد الإلكتروني')} />
                </Field>
              )}

              {(signin || signup || reset) && (
                <Field label={reset ? tr('New password', 'تێپەڕەوشەی نوێ', 'كلمة المرور الجديدة') : tr('Password', 'تێپەڕەوشە', 'كلمة المرور')}>
                  <VxField icon="lock" type={showPw ? 'text' : 'password'} name="password" dir="ltr"
                    autoComplete={signin ? 'current-password' : 'new-password'} value={password} onChange={setPassword} disabled={disabled}
                    placeholder="••••••••" ariaLabel={tr('Password', 'تێپەڕەوشە', 'كلمة المرور')} suffix={eyeSuffix} />
                </Field>
              )}

              {/* password strength meter (signup) */}
              {signup && password && (
                <div style={{ marginTop: -6 }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i < score ? strengthColor : 'var(--border-strong)', transition: 'background .15s' }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 5 }}>{strengthLabel}</div>
                </div>
              )}

              {(signup || reset) && (
                <Field label={tr('Confirm password', 'دڵنیاکردنەوەی تێپەڕەوشە', 'تأكيد كلمة المرور')}>
                  <VxField icon="lock" type={showPw ? 'text' : 'password'} name="confirm_password" dir="ltr"
                    autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} disabled={disabled}
                    placeholder="••••••••" ariaLabel={tr('Confirm password', 'دڵنیاکردنەوەی تێپەڕەوشە', 'تأكيد كلمة المرور')} />
                </Field>
              )}

              {signin && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ink-600)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ accentColor: 'var(--accent-500)', width: 18, height: 18, flexShrink: 0 }} />
                    {tr('Remember me', 'بیرم بمێنێتەوە', 'تذكّرني')}
                  </label>
                  <Link to="/forgot-password" style={{ color: 'var(--accent-400)', fontWeight: 500 }}>{tr('Forgot password?', 'تێپەڕەوشەت بیرچووە؟', 'نسيت كلمة المرور؟')}</Link>
                </div>
              )}

              <button type="submit" className="vx-btn vx-btn-accent vx-btn-lg" style={{ width: '100%', marginTop: 4 }} disabled={disabled || loading}>
                {loading
                  ? tr('Please wait…', 'تکایە چاوەڕێ بکە…', 'يرجى الانتظار…')
                  : submitLabel || (
                    signup ? tr('Create account', 'دروستکردنی هەژمار', 'إنشاء حساب')
                      : forgot ? tr('Send reset link', 'ناردنی لینکی ڕێکخستنەوە', 'إرسال رابط إعادة التعيين')
                        : reset ? tr('Reset password', 'ڕێکخستنەوەی تێپەڕەوشە', 'إعادة تعيين كلمة المرور')
                          : tr('Sign in', 'چوونەژوورەوە', 'تسجيل الدخول'))}
              </button>
            </form>

            {/* social + mode toggle (signin / signup only) */}
            {(signin || signup) && (<>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0', color: 'var(--ink-300)', fontSize: 12 }}>
                <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />{tr('or', 'یان', 'أو')}<span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button type="button" className="vx-btn vx-btn-default" style={{ width: '100%' }} onClick={handleGoogle} disabled={disabled || googleLoading}>Google</button>
                <button type="button" className="vx-btn vx-btn-default" style={{ width: '100%' }} aria-disabled="true">Microsoft</button>
              </div>
              <p style={{ marginTop: 20, fontSize: 13, color: 'var(--ink-500)', textAlign: 'center' }}>
                {signup ? tr('Already have an account? ', 'پێشتر هەژمارت هەیە؟ ', 'لديك حساب بالفعل؟ ') : tr("Don't have an account? ", 'هەژمارت نییە؟ ', 'ليس لديك حساب؟ ')}
                <Link to={signup ? '/login' : '/signup'} style={{ color: 'var(--accent-400)', fontWeight: 600 }}>
                  {signup ? tr('Sign in', 'بچۆ ژوورەوە', 'سجّل الدخول') : tr('Create one', 'یەکێک دروست بکە', 'أنشئ حسابًا')}
                </Link>
              </p>
            </>)}
          </>)}
        </div>
      </div>

      <style>{`@media (max-width:820px){.auth-rail{display:none!important}}`}</style>
    </div>
  );
};

export default VertexAuthShell;
