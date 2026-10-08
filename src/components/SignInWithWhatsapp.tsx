import React from 'react';
import style from './SignInWithWhatsapp.module.css';
import { Button } from '@_linked/primitives/components/Button';
import { cl } from '@_linked/react/utils/ClassNames';
import { packageName } from '../package.js';
import { Server } from '@_linked/server-utils/utils/Server';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  REGEXP_ONLY_DIGITS,
} from '@_linked/primitives/components/InputOTP';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import libphone from 'google-libphonenumber';
import { useAuth } from '@_linked/auth/hooks/useAuth';
import { asset } from '@_linked/core/utils/LinkedFileStorage';
import { useTranslate } from '@tolgee/react';

const PhoneNumberUtil = libphone.PhoneNumberUtil;

interface SigninWithWhatsappButton
  extends Omit<React.ComponentProps<typeof Button>, 'onClick' | 'children'> {
  label?: string;
  onSuccess: (data: boolean) => void;
}

export const SigninWithWhatsappButton = ({
  label = 'Sign in with Whatsapp',
  className,
  onSuccess,
  ...buttonProps
}: SigninWithWhatsappButton) => {
  const phoneUtil = PhoneNumberUtil.getInstance();
  const isPhoneValid = (phoneNumber: string) => {
    try {
      return phoneUtil.isValidNumber(
        phoneUtil.parseAndKeepRawInput(phoneNumber)
      );
    } catch {
      return false;
    }
  };
  const [otpField, setOTPField] = React.useState(false);
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [phoneNumberField, setPhoneNumberField] = React.useState(false);
  const [isLoading, setLoading] = React.useState(false);
  const [showPhoneError, setShowPhoneError] = React.useState(false);
  const isValid = isPhoneValid(phoneNumber);

  const auth = useAuth();
  const { t } = useTranslate();
  const prefix = 'signIn';

  const validateOTP = (phone: string, otp: string) => {
    if (!phone || !otp) return;
    Server.call(packageName, 'validateOTPWhatsapp', phone, otp).then(
      (response) => {
        if (response && response.auth) {
          auth.updateAuth({
            auth: response.auth,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          });
          onSuccess(true);
        } else if (response?.error) {
          alert(response.error);
        } else {
          onSuccess(false);
        }
      }
    );
  };

  const sendWhatsappMessage = (phone: string) => {
    if (!isValid) {
      setShowPhoneError(true);
      return;
    }
    setShowPhoneError(false);
    setLoading(true);
    Server.call(packageName, 'generateOTPWhatsapp', phone)
      .then(() => {
        setOTPField(true);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <>
      {!otpField && !phoneNumberField ? (
        <Button
          type="button"
          className={cl(style.root, className)}
          onClick={() => setPhoneNumberField(true)}
          variant="outline"
          {...buttonProps}
        >
          <img
            src={asset('/images/wa_icon.png')}
            alt=""
            className={style.WhatsappIcon}
          />
          {t(prefix + '.whatsapp', label)}
        </Button>
      ) : isLoading ? (
        <img
          src={asset('/images/loading.gif')}
          className={style.loading}
          alt="loading"
        />
      ) : phoneNumberField && !otpField ? (
        <div className={style.phoneStep}>
          <div className={style.phoneRow}>
            <PhoneInput
              className={style.phoneInput}
              defaultCountry="us"
              value={phoneNumber}
              onChange={(nextPhone) => setPhoneNumber(nextPhone)}
              inputProps={{
                placeholder: '+1 555 123 4567',
              }}
            />
            <button
              type="button"
              className={style.signButton}
              aria-label="Send code"
              onClick={() => sendWhatsappMessage(phoneNumber)}
            >
              <img src={asset('/images/signButton.png')} alt="" />
            </button>
          </div>
          {showPhoneError && !isValid ? (
            <div className={style.phoneError}>Phone is not valid</div>
          ) : null}
        </div>
      ) : (
        <>
          <h3>Enter your OTP code</h3>
          <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
            onComplete={(otp) => validateOTP(phoneNumber, otp)}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </>
      )}
    </>
  );
};
