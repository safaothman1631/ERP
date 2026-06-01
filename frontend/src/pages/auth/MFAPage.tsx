/**
 * MFAPage.tsx
 *
 * پەرەی پشتراستکردنی دووەم (MFA)
 *
 * Requirements 2.7:
 * - TOTP verification via Google Authenticator
 * - 6-digit OTP input with auto-submit on complete
 * - Uses mfa_session_token stored in sessionStorage by LoginPage
 * - On success: stores access token in memory (Zustand), refresh token is
 *   httpOnly cookie set by backend
 */
import React, { useState, useEffect, useRef } from 'react';
import { Button, Alert } from 'antd';
import { SafetyCertificateOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuthStore } from '../../store';
import api from '../../api';
import AuthLayout from '../../components/AuthLayout';

// ---------------------------------------------------------------------------
// OTP Input — 6 individual digit boxes
// ---------------------------------------------------------------------------

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, disabled }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  const handleChange = (index: number, char: string) => {
    // Accept only digits
    const digit = char.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    const newValue = newDigits.join('').replace(/\s/g, '');
    onChange(newValue);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move to previous input on backspace when current is empty
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join('').replace(/\s/g, ''));
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join('').replace(/\s/g, ''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    // Focus the last filled input or the next empty one
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        direction: 'ltr',
        margin: '24px 0',
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[i] || ''}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          style={{
            width: 48,
            height: 56,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 700,
            borderRadius: 12,
            border: digits[i] ? '2px solid #7B61FF' : '1.5px solid #E5E7EB',
            outline: 'none',
            background: digits[i] ? 'rgba(123,97,255,0.06)' : '#FAFBFC',
            color: '#0F172A',
            transition: 'border-color 0.18s, background 0.18s, box-shadow 0.18s',
            boxShadow: digits[i] ? '0 0 0 3px rgba(123,97,255,0.12)' : 'none',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.6 : 1,
          }}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// MFAPage
// ---------------------------------------------------------------------------

const MFAPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loginSecure } = useAuthStore();
  const prefersReducedMotion = useReducedMotion();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Retrieve the MFA session token set by LoginPage
  const mfaSessionToken = sessionStorage.getItem('mfa_session_token') || '';

  // If no session token, redirect back to login
  useEffect(() => {
    if (!mfaSessionToken) {
      navigate('/login', { replace: true });
    }
  }, [mfaSessionToken, navigate]);

  const handleVerify = async (code: string) => {
    if (code.length !== 6) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/api/v1/auth/mfa/verify', {
        mfa_session_token: mfaSessionToken,
        totp_code: code,
      });

      // Clear the temporary MFA session data
      sessionStorage.removeItem('mfa_session_token');
      sessionStorage.removeItem('mfa_user_id');

      // Store access token in memory (Zustand), refresh token is httpOnly cookie
      loginSecure(
        res.data.access_token,
        res.data.user_id,
        res.data.org_id,
        res.data.user_name,
      );
      navigate('/dashboard');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status;

      if (status === 401 || status === 422) {
        setErrorMsg(t('mfa_invalid_code'));
      } else if (status === 429) {
        setErrorMsg(t('mfa_too_many_attempts'));
      } else {
        setErrorMsg(detail || t('error'));
      }
      // Clear OTP on error so user can re-enter
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when all 6 digits are entered
  const handleOtpChange = (val: string) => {
    setOtp(val);
    setErrorMsg(null);
    if (val.length === 6) {
      handleVerify(val);
    }
  };

  return (
    <AuthLayout
      title={t('mfa_title')}
      subtitle={t('mfa_subtitle')}
    >
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      >
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(123,97,255,0.12) 0%, rgba(86,56,214,0.08) 100%)',
              border: '1.5px solid rgba(123,97,255,0.18)',
              marginBottom: 8,
            }}
          >
            <SafetyCertificateOutlined style={{ fontSize: 28, color: '#7B61FF' }} />
          </div>
        </div>

        {/* Instruction */}
        <p style={{
          textAlign: 'center',
          color: '#64748B',
          fontSize: 13,
          lineHeight: 1.7,
          margin: '0 0 4px',
          direction: 'rtl',
        }}>
          {t('mfa_instruction')}
        </p>

        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            closable
            onClose={() => setErrorMsg(null)}
            style={{ marginBottom: 16, borderRadius: 10, direction: 'rtl', textAlign: 'end' }}
          />
        )}

        {/* OTP Input */}
        <OtpInput
          value={otp}
          onChange={handleOtpChange}
          disabled={loading}
        />

        {/* Verify button */}
        <Button
          className="auth-btn"
          type="primary"
          block
          size="large"
          loading={loading}
          disabled={otp.length !== 6}
          onClick={() => handleVerify(otp)}
          style={{ marginBottom: 16 }}
        >
          {t('mfa_verify')}
        </Button>

        {/* Back to login */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Link
            to="/login"
            style={{ color: '#7B61FF', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={() => {
              sessionStorage.removeItem('mfa_session_token');
              sessionStorage.removeItem('mfa_user_id');
            }}
          >
            <ArrowLeftOutlined style={{ fontSize: 12 }} />
            {t('auth_back_to_login')}
          </Link>
        </div>

        {/* Help text */}
        <p style={{
          textAlign: 'center',
          color: '#94A3B8',
          fontSize: 11,
          marginTop: 20,
          lineHeight: 1.6,
          direction: 'rtl',
        }}>
          {t('mfa_help_text')}
        </p>
      </motion.div>
    </AuthLayout>
  );
};

export default MFAPage;
