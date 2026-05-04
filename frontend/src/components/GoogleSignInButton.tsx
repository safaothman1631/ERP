import React from 'react';
import { Button } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface GoogleSignInButtonProps {
  onSuccess: (idToken: string) => void;
  onError?: (error: Error) => void;
  loading?: boolean;
  text?: string;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  loading = false,
  text = 'چوونەژوورەوە بە Google',
}) => {
  const [internalLoading, setInternalLoading] = React.useState(false);

  // Handle redirect-based sign-in result on mount (fallback path)
  React.useEffect(() => {
    let cancelled = false;
    getRedirectResult(auth)
      .then(async (result) => {
        if (cancelled || !result) return;
        const idToken = await result.user.getIdToken();
        onSuccess(idToken);
      })
      .catch((err: any) => {
        if (cancelled) return;
        if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
          onError?.(err);
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = async () => {
    // IMPORTANT: do NOT call setState before signInWithPopup, otherwise the
    // browser drops the user-gesture context and blocks the popup.
    try {
      const popupPromise = signInWithPopup(auth, googleProvider);
      setInternalLoading(true);
      const result = await popupPromise;
      const idToken = await result.user.getIdToken();
      onSuccess(idToken);
    } catch (err: any) {
      const code = err?.code;
      // user closed the popup — silent
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      // Browser blocked the popup → automatically fall back to redirect flow
      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return; // page will navigate away
        } catch (redirectErr: any) {
          onError?.(redirectErr);
          return;
        }
      }
      onError?.(err);
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
