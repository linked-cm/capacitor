import React, { useRef, useState } from 'react';
import style from './SigninWithGoogleButton.module.css';
import { Button } from '@_linked/mui-base/components/Button';
import { cl } from '@_linked/react/utils/ClassNames';
import { useAuth } from '@_linked/auth/hooks/useAuth';
import type { AuthenticationResult } from '@_linked/auth/types/auth';
import { useTranslate } from '@tolgee/react';
import {
  classifySocialLoginError,
  loginWithGoogle,
} from '../auth/SocialLoginClient.js';
interface SigninWithGoogleButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'onClick' | 'children'> {
  label?: string;
  scopes?: string[];
  className?: string;
  onCallback: (data: AuthenticationResult) => void;
  onLoadingChange?: (loading: boolean) => void;
  restProps?: any;
}
export const SigninWithGoogleButton = ({
  label = 'Sign in with Google', // default text button
  scopes = ['profile', 'email'], // default scopes from google
  className, // additional CSS classNames to apply to the button
  onCallback, // callback function invoked when the Google authentication is successful
  onLoadingChange, // callback function invoked when the loading state changes, you can pass a function to handle the loading state when call the server
  restProps,
  disabled: disabledByCaller = false,
  ...buttonProps
}: SigninWithGoogleButtonProps) => {
  const auth = useAuth();
  const { t } = useTranslate();
  let prefix = 'signIn';

  const [loading, setLoading] = useState(false); // loading spinner
  const loginInFlight = useRef(false);

  const signInWithGoogle = async () => {
    if (loginInFlight.current) return;
    loginInFlight.current = true;
    setLoading(true);
    let result: AuthenticationResult | undefined;
    try {
      onLoadingChange?.(true);
      const payload = await loginWithGoogle(scopes);
      result = await auth.signinOAuth('google', payload);
    } catch (error) {
      const loginError = classifySocialLoginError(error);
      if (loginError.kind !== 'cancelled') {
        result = { error: loginError.message };
      }
    } finally {
      loginInFlight.current = false;
      setLoading(false);
      onLoadingChange?.(false);
    }
    if (result) onCallback(result);
  };

  return (
    <Button
      className={cl(style.root, className)}
      variant="outlined"
      fullWidth
      startIcon={
        <svg
          className={style.icon}
          preserveAspectRatio="xMidYMid"
          viewBox="0 0 256 262"
        >
          <path
            fill="#4285F4"
            d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
          />
          <path
            fill="#34A853"
            d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
          />
          <path
            fill="#FBBC05"
            d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"
          />
          <path
            fill="#EB4335"
            d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
          />
        </svg>
      }
      {...restProps}
      {...buttonProps}
      onClick={signInWithGoogle}
      disabled={loading || disabledByCaller || restProps?.disabled}
    >
      {t(prefix + '.google', label)}
    </Button>
  );
};
