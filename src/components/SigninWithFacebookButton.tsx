import React, { useRef, useState } from 'react';
import style from './SigninWithFacebookButton.module.css';
import { Button } from '@_linked/primitives/components/Button';
import { cl } from '@_linked/react/utils/ClassNames';
import { useAuth } from '@_linked/auth/hooks/useAuth';
import type { AuthenticationResult } from '@_linked/auth/types/auth';
import {
  classifySocialLoginError,
  loginWithFacebook,
} from '../auth/SocialLoginClient.js';

interface SigninWithFacebookButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'onClick' | 'children'> {
  label?: string;
  scopes?: string[];
  className?: string;
  onCallback: (data: AuthenticationResult) => void;
  onLoadingChange?: (loading: boolean) => void;
  restProps?: any;
}

export const SigninWithFacebookButton = ({
  label = 'Sign in with Facebook',
  scopes = ['email'],
  className,
  onCallback,
  onLoadingChange,
  restProps,
  disabled: disabledByCaller = false,
  ...buttonProps
}: SigninWithFacebookButtonProps) => {
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const loginInFlight = useRef(false);

  const onSignin = async () => {
    if (loginInFlight.current) return;
    loginInFlight.current = true;
    setLoading(true);
    let result: AuthenticationResult | undefined;
    try {
      onLoadingChange?.(true);
      const payload = await loginWithFacebook(scopes);
      result = await auth.signinOAuth('facebook', payload);
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
      type="button"
      className={cl(style.root, className)}
      variant="outline"
      {...restProps}
      {...buttonProps}
      onClick={onSignin}
      disabled={loading || disabledByCaller || restProps?.disabled}
    >
      <svg className={style.icon} width="24" height="24" fill="none">
          <g clipPath="url(#a)">
            <path
              d="M24 12c0-6.62742-5.3726-12-12-12C5.37258 0 0 5.37258 0 12c0 5.9895 4.3882 10.954 10.125 11.8542v-8.3854H7.07812V12H10.125V9.35625c0-3.0075 1.7916-4.66875 4.5326-4.66875 1.3125 0 2.6862.23438 2.6862.23438V7.875h-1.5132c-1.4906 0-1.9556.92508-1.9556 1.875V12h3.3281l-.532 3.4688H13.875v8.3854C19.6118 22.954 24 17.9895 24 12Z"
              fill="#1877F2"
            />
            <path
              d="M16.6711 15.4688 17.2031 12H13.875V9.75c0-.94898.465-1.875 1.9556-1.875h1.5132V4.92188s-1.3733-.23438-2.6862-.23438c-2.741 0-4.5326 1.66125-4.5326 4.66875V12H7.07812v3.4688H10.125v8.3854c1.2424.1944 2.5076.1944 3.75 0v-8.3854h2.7961Z"
              fill="#fff"
            />
          </g>
          <defs>
            <clipPath id="a">
              <path fill="#fff" d="M0 0h24v24H0z" />
            </clipPath>
          </defs>
      </svg>
      {label}
    </Button>
  );
};
