import React, { useEffect, useCallback } from 'react';
import style from './SignInWithWhatsapp.module.css';
import { Button } from '@_linked/mui-base/components/Button';
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
import { Person } from 'profile-plus/shapes/Person';
import { UserAccount } from 'profile-plus/shapes/UserAccount';
import { useAuth } from '@_linked/auth/hooks/useAuth';
import { asset } from '@_linked/core/utils/LinkedFileStorage';
import { useTranslate } from '@tolgee/react';

const PhoneNumberUtil = libphone.PhoneNumberUtil;
interface SigninWithWhatsappButton {
  label?: string;
  className?: string;
  clientNumber?: string;
  onCallback?: (data, message) => void;
  restProps?: any;
  onSuccess: (data: boolean) => void;
}

export const SigninWithWhatsappButton = ({
  label = 'Sign in with Whatsapp', // default text button
  className, // additional CSS classNames to apply to the button
  onCallback, // callback function invoked when the Google authentication is successful.
  restProps,
  onSuccess,
}: SigninWithWhatsappButton) => {
  const phoneUtil = PhoneNumberUtil.getInstance();
  const isPhoneValid = (phoneNumber: string) => {
    try {
      return phoneUtil.isValidNumber(
        phoneUtil.parseAndKeepRawInput(phoneNumber)
      );
    } catch (error) {
      return false;
    }
  };
  const [otpField, setOTPField] = React.useState(false);
  const [OTPNumber, setOTPNumber] = React.useState('');
  const [user, setUser] = React.useState({});
  const [OTPRetrieve, setOTPRetrieve] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [phoneNumberField, setPhoneNumberField] = React.useState(false);
  const [isLoading, setLoading] = React.useState(false);
  const [messageData, setMessageData] = React.useState({});
  const isValid = isPhoneValid(phoneNumber);

  const auth = useAuth();
  const { t } = useTranslate();
  const prefix = 'signIn';

  const OTP_Received = (OPT_input: string) => {
    // if (OTP === OTPRetrieve.toString()) {
    validateOTP(phoneNumber, OPT_input);
    // } else {
    //   validateOTP(false, messageData);
    // }
    return;
  };

  const validateOTP = (phoneNumber, OPT_input) => {
    // backend already validate the OTP and return true or false here. if telephone means OTP is valid true / false
    if (phoneNumber && OPT_input) {
      Server.call(
        packageName,
        'validateOTPWhatsapp',
        phoneNumber,
        OPT_input
      ).then((response) => {
        if (response && response.auth) {
          auth.updateAuth({
            auth: response.auth,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          });
          onSuccess(true);
        } else if (response?.error) {
          //TODO: user error message
          alert(response.error);
        } else {
          onSuccess(false);
        }
      });
      // .catch((error) => {
      //   console.error('Error signing in with WhatsApp:', error);
      //   // Handle the error appropriately (e.g., show an error message to the user)
      //   // You might want to call `onSuccess(false)` or display an error message here
      // });
    }
  };
  const sendWhatsappMessage = (phoneNumber) => {
    setLoading(true);
    if (!isValid) {
      setLoading(false);
      setPhoneNumber('');
      return;
    }
    Server.call(packageName, 'generateOTPWhatsapp', phoneNumber).then(
      (response) => {
        const { data, otp, user } = response;
        setMessageData(data);
        setOTPField(true);
        setLoading(false);
        setOTPRetrieve(otp);
        setUser(user);
      }
    );
  };

  // const handleOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const inputValue = event.target.value.replace(/[^0-9]/g, '');
  //   setPhoneNumber(inputValue);
  // };

  return (
    <>
      {!otpField && !phoneNumberField ? (
        <Button
          className={cl(style.root, className)}
          onClick={() => setPhoneNumberField(true)}
          variant="outlined"
          fullWidth
          startIcon={
            <img
              src={asset('/images/wa_icon.png')}
              alt="whatsapp-icon"
              className={style.WhatsappIcon}
            />
          }
          {...restProps}
        >
          {t(prefix + '.whatsapp', label)}
        </Button>
      ) : isLoading ? (
        <img
          src={asset('/images/loading.gif')}
          className={style.loading}
          alt="loading"
        />
      ) : phoneNumberField && !otpField ? (
        <>
          {/* <input
            placeholder="Enter your phone number"
            className={style.phoneInput}
            value={phoneNumber}
            type="text"
            pattern="[0-9]*"
            required={true}
            onChange={handleOnChange}
            autoFocus
          /> */}

          <PhoneInput
            defaultCountry="us"
            value={phoneNumber}
            onChange={(phoneNumber) => setPhoneNumber(phoneNumber)}
            inputProps={{
              placeholder: '+1 555 123 4567',
            }}
          />
          {!isValid && phoneNumber === '' ? (
            <div style={{ color: 'red' }}>Phone is not valid</div>
          ) : null}
          <img
            src={asset('/images/signButton.png')}
            className={style.signButton}
            onClick={() => sendWhatsappMessage(phoneNumber)}
          />
        </>
      ) : (
        <>
          <h3>Enter your OTP code</h3>
          <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
            onComplete={OTP_Received}
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
