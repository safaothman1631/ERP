import React from 'react';
import { Button } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { signInWithRedirect, getRedirectResult } from 'firebase/auth';
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

  // After Google redirects back to our page, finish the sign-in
  React.useEffect(() => {
    let cancelled = false;
    setInternalLoading(true);
    getRedirectResult(auth)
      .then(async (result) => {
        if (cancelled) return;
        if (!result) {
          setInternalLoading(false);
          return;
        }
        const idToken = await result.user.getIdToken();
        onSuccess(idToken);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setInternalLoading(false);
        if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
          onError?.(err);
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = async () => {
    setInternalLoading(true);
    try {
      // Use redirect flow exclusively — avoids popup blockers and COOP warnings.
      await signInWithRedirect(auth, googleProvider);
      // Page will navigate away; no further code runs here.
    } catch (err: any) {
      setInternalLoading(false);
      onError?.(err);
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
