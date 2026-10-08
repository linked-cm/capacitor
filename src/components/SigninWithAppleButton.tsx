import React, { useRef, useState } from 'react';
import style from './SigninWithAppleButton.module.css';
import { Button } from '@_linked/primitives/components/Button';
import { cl } from '@_linked/react/utils/ClassNames';
import { useAuth } from '@_linked/auth/hooks/useAuth';
import type { AuthenticationResult } from '@_linked/auth/types/auth';
import {
  classifySocialLoginError,
  isAppleLoginSupported,
  loginWithApple,
} from '../auth/SocialLoginClient.js';

interface SigninWithAppleButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'onClick' | 'children'> {
  label?: string;
  scopes?: string;
  className?: string;
  onCallback: (data: AuthenticationResult) => void;
  restProps?: any;
  onLoadingChange?: (loading: boolean) => void;
}
export const SigninWithAppleButton = ({
  label = 'Sign in with Apple',
  scopes = 'email name',
  className,
  onCallback,
  onLoadingChange,
  restProps,
  disabled: disabledByCaller = false,
  ...buttonProps
}: SigninWithAppleButtonProps) => {
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const loginInFlight = useRef(false);
  const isSupportedPlatform = isAppleLoginSupported();

  const signInWithApple = async () => {
    if (loginInFlight.current) return;
    loginInFlight.current = true;
    setLoading(true);
    let result: AuthenticationResult | undefined;
    try {
      onLoadingChange?.(true);
      const payload = await loginWithApple(scopes.split(/\s+/).filter(Boolean));
      result = await auth.signinOAuth('apple', payload);
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

  if (!isSupportedPlatform) {
    return null;
  }

  return (
    <Button
      type="button"
      className={cl(style.root, className)}
      variant="outline"
      {...restProps}
      {...buttonProps}
      onClick={signInWithApple}
      disabled={loading || disabledByCaller || restProps?.disabled}
    >
      <svg className={style.icon} viewBox="-1.5 0 20 20">
          <path
            d="M11.570887 3.19296C12.29996 2.34797 12.791401 1.17098 12.656912 0c-1.050633.04-2.321706.67099-3.075048 1.51498-.67649.74899-1.267029 1.94597-1.10827 3.09396 1.171976.08699 2.36822-.57 3.097293-1.41598m2.6281 7.43189C14.22831 13.65181 16.969663 14.65879 17 14.67179c-.022246.071-.437848 1.43498-1.443988 2.84496-.87064 1.21799-1.773639 2.43097-3.196392 2.45697-1.397473.025-1.847455-.79399-3.446157-.79399-1.59769 0-2.09722.76799-3.419865.81899-1.373205.049-2.419793-1.31798-3.2965-2.53196C.403236 14.98379-.966935 10.44985.873442 7.3899c.914121-1.51898 2.547203-2.48197 4.320842-2.50597 1.347924-.025 2.62102.86899 3.445145.86899s2.371256-1.07499 3.99726-.91699c.680534.027 2.591695.263 3.818276 1.98397-.099097.059-2.280247 1.27499-2.255979 3.80495"
            fill="currentColor"
            fillRule="evenodd"
          />
      </svg>
      {label}
    </Button>
  );
};
