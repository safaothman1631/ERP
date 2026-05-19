import React from 'react';
import { Button } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface GoogleSignInButtonProps {
  onSuccess: (idToken: string) => void;
  onError?: (error: Error) => void;
  loading?: boolean;
  text?: string;
}

/**
 * Google Sign-In button using popup flow.
 *
 * Opens Google authentication in a NEW window/popup instead of redirecting
 * the current page. The user stays on erpiq.systems while the popup handles
 * the OAuth flow with Google. After successful auth, the popup closes and
 * the ID token is returned via onSuccess.
 *
 * Note: Browsers may block popups if not triggered by direct user interaction.
 * Since this fires from an onClick handler, it should pass the popup blocker.
 */
const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  loading = false,
  text = 'چوونەژوورەوە بە Google',
}) => {
  const [internalLoading, setInternalLoading] = React.useState(false);

  const handleClick = async () => {
    setInternalLoading(true);
    try {
      // Open Google sign-in in a popup window — keeps user on the current page.
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      onSuccess(idToken);
    } catch (err: any) {
      // Ignore user cancellation — these are expected, not real errors.
      if (
        err?.code !== 'auth/popup-closed-by-user' &&
        err?.code !== 'auth/cancelled-popup-request' &&
        err?.code !== 'auth/user-cancelled'
      ) {
        onError?.(err);
      }
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Button
      className="auth-google-btn"
      block
      size="large"
      icon={<GoogleOutlined />}
      loading={loading || internalLoading}
      onClick={handleClick}
    >
      {text}
    </Button>
  );
};

export default GoogleSignInButton;
