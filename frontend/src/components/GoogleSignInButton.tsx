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
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      onSuccess(idToken);
    } catch (err: any) {
      // user closed the popup — not an error worth surfacing
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
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
