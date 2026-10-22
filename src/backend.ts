import { Person as SchemaPerson } from '@_linked/schema/shapes/Person';
import { BackendProvider } from '@_linked/server-utils/utils/BackendProvider';
import { callable } from '@_linked/server-utils/utils/callable';
import { LocationUpdateAction } from './shapes/LocationUpdateAction.js';
import { AdministrativeArea } from '@_linked/schema/shapes/AdministrativeArea';
import { Auth } from '@_linked/auth/utils/auth';
import {
  offAccountWillBeRemoved,
  onAccountWillBeRemoved,
} from '@_linked/auth/utils/events';
import { UserAccount } from '@_linked/sioc/shapes/UserAccount';
import { AuthCredential } from '@_linked/auth/shapes/AuthCredential';
import { telephoneToWebID } from '@_linked/auth/utils/webID';
import type { UserAccountData, UserData } from '@_linked/auth/types/auth';
import { normalizeTelephone } from './utils/helper.js';
import crypto from 'crypto';
import {
  AMBIGUOUS_TELEPHONE_IDENTITY,
  AmbiguousTelephoneIdentityError,
  resolveTelephoneAccount,
} from './utils/telephoneAccount.js';

export default class CapacitorBackendProvider extends BackendProvider {
  public accountShape: typeof UserAccount = UserAccount;
  public userShape: typeof SchemaPerson = SchemaPerson;
  private readonly onAccountRemoved = async (account: UserAccountData) => {
    const person = account.accountOf;

    if (person) {
      // The location action is optional. Delete by its relation so accounts
      // without location history do not pass `null` into an ID-based delete.
      await LocationUpdateAction.deleteWhere((action) =>
        action.agent.equals(person)
      );
    }
  };

  async setupBeforeControllers() {
    //if defined, take the values from the environment variables to define the shapes for the account and user
    await this.assignEnvPathToField('AUTH_ACCOUNT_TYPE', 'accountShape');
    await this.assignEnvPathToField('AUTH_USER_TYPE', 'userShape');

    onAccountWillBeRemoved(this.onAccountRemoved);
  }

  dispose() {
    offAccountWillBeRemoved(this.onAccountRemoved);
  }

  @callable('public')
  async validateOTPWhatsapp(phoneIdentifier, OPT_Input, otpChallenge?: string) {
    try {
      if (!phoneIdentifier) {
        console.log('No phone number provided');
        return { error: 'No phone number provided' };
      }

      const normalizedPhone = normalizeTelephone(phoneIdentifier);
      const legacyPhone = String(phoneIdentifier || '').trim();
      if (!normalizedPhone) {
        console.log('No valid phone number provided');
        return { error: 'No phone number provided' };
      }

      if (!OPT_Input) {
        console.log('No OTP code provided');
        return { error: 'No OTP code provided' };
      }

      // Browser requests normally verify against the OTP kept in their Express
      // session. Native WebViews may not carry that cross-origin session cookie,
      // so they verify the signed challenge returned by generateOTPWhatsapp.
      const sessionOtp = this.request.session?.otp;
      const otpIsValid =
        sessionOtp !== undefined && sessionOtp !== null
          ? sessionOtp.toString() === OPT_Input
          : this.verifyOTPChallenge(
              normalizedPhone,
              String(OPT_Input),
              otpChallenge
            );

      if (!otpIsValid) {
        console.log('OTP code is incorrect');
        return { error: 'OTP code is incorrect' };
      }
      // Preserve the old retry behavior for a mistyped code, but consume a
      // successful session-backed code so it cannot be replayed.
      if (sessionOtp !== undefined && sessionOtp !== null) {
        delete this.request.session.otp;
      }

      return await Auth.login(
        this,
        async () => {
          const telephoneWebId = telephoneToWebID(normalizedPhone);

          // first, try to find account by telephone-based webID (for new users)
          // Query through the configured account shape. Applications can use a
          // UserAccount subclass with a different target class, so querying the
          // base SIOC shape would miss their existing accounts and create a
          // duplicate telephone-only identity.
          const webIdAccounts = await this.accountShape
            .select((ua) => [
              ua.email,
              ua.accountOf.select((p) => [
                p.givenName,
                p.familyName,
                p.telephone,
              ]),
            ])
            .where((ua) => {
              return ua.accountOf.equals({
                id: telephoneWebId,
              });
            });

          // Also query the telephone property even when the deterministic WebID
          // exists. Legacy email accounts may own the same number; returning the
          // WebID match early would hide that conflict and authenticate the
          // duplicate account.
          const telephoneAccounts = await this.accountShape
            .select((ua) => [
              ua.email,
              ua.accountOf.select((p) => [
                p.givenName,
                p.familyName,
                p.telephone,
              ]),
            ])
            .where((ua) => {
              // Try normalized phone first, but also support legacy stored strings.
              return ua.accountOf.telephone
                .equals(normalizedPhone)
                .or(ua.accountOf.telephone.equals(legacyPhone));
            });

          const resolution = resolveTelephoneAccount([
            ...webIdAccounts,
            ...telephoneAccounts,
          ]);
          if (resolution.kind === 'ambiguous') {
            throw new AmbiguousTelephoneIdentityError(resolution);
          }
          const account = resolution.kind === 'one' ? resolution.account : null;

          if (account && account.accountOf) {
            console.log(
              `Found one account across WhatsApp WebID and telephone lookups for phone number ${phoneIdentifier}`
            );
            return {
              account,
              person: account.accountOf,
            };
          }

          console.warn(
            `Could not find any account for phone number ${normalizedPhone} (tried webID: ${telephoneWebId} and telephone property)`
          );
          return null;
        },
        async () => {
          const telephoneWebId = telephoneToWebID(normalizedPhone);

          // create a new user by telephone webID
          const user = await (this.userShape as any).create({
            __id: telephoneWebId,
            givenName: '',
            familyName: '',
            telephone: normalizedPhone,
          });

          if (!user) {
            console.error(
              'Error creating user by telephone webID: ' + telephoneWebId
            );
            return null;
          }

          // create a new credential for the user
          const newCredential = await AuthCredential.create({
            credentialOf: {
              id: user.id,
            },
            telephone: normalizedPhone,
          });

          if (!newCredential) {
            console.error(
              'Error creating credential by telephone webID: ' + telephoneWebId
            );
            return null;
          }

          const account = await (this.accountShape as any).create({
            email: '',
            accountOf: user,
          });

          if (!account) {
            console.warn(
              'Creating new account by telephone webID: ' +
                telephoneWebId +
                ' failed'
            );
            return null;
          }

          return {
            account: account,
            person: user,
          };
        },
        'Whatsapp. Phonenumber: ' + phoneIdentifier
      );
    } catch (err) {
      if (err instanceof AmbiguousTelephoneIdentityError) {
        console.warn(
          'WhatsApp sign-in refused because the telephone matches multiple identities',
          {
            accountCount: err.resolution.accountIds.length,
            personCount: err.resolution.personIds.length,
          }
        );
        return {
          error:
            'Multiple accounts use this phone number. Please use another sign-in method or contact support.',
          code: AMBIGUOUS_TELEPHONE_IDENTITY,
        };
      }
      console.error('validateOTPWhatsapp failed:', err);
      return {
        error: 'Sign-in failed. Please try again.',
      };
    }
  }

  @callable('public')
  async generateOTPWhatsapp(phoneNumber) {
    const session = this.request.session;

    const recipient = normalizeTelephone(phoneNumber).replace(/^\+/, '');
    if (!/^\d{8,15}$/.test(recipient)) {
      throw new Error('A valid WhatsApp phone number is required');
    }
    const apiKey = process.env.WA_D360_API_KEY;
    if (!apiKey) {
      throw new Error('WA_D360_API_KEY is required to send a WhatsApp code');
    }

    const otp = this.generateOTP();
    // A resend invalidates an earlier code even when the provider rejects it.
    if (session) {
      delete session.otp;
    }

    try {
      const bearerToken = await this.getBearerToken();
      const response = await this.sendMessage(
        'https://waba-v2.360dialog.io/messages',
        bearerToken,
        apiKey,
        otp,
        recipient
      );
      if (!response.ok) {
        console.error(
          'WhatsApp code request rejected by provider:',
          response.status
        );
        throw new Error('Could not send the code. Please try again.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message !== 'Could not send the code. Please try again.') {
        console.error('WhatsApp code send failed:', message);
      }
      throw new Error('Could not send the code. Please try again.');
    }

    // HTTP 2xx is acceptance. The provider can omit messages[0].id after the
    // message is already delivered, so the code becomes usable here.
    if (session) {
      session.otp = otp;
      return { sent: true };
    }

    // iOS native calls can be cookie-less. Return an opaque proof that lets the
    // server validate the entered code without storing the plaintext OTP in the
    // client or relying on process-local memory (the app runs multiple workers).
    return {
      sent: true,
      challenge: this.createOTPChallenge(`+${recipient}`, otp),
    };
  }

  private otpChallengeSecret(): string {
    // Prefer the application's authentication secret. The WhatsApp API key is
    // a fallback for installations that have not configured JWT auth yet.
    const secret = process.env.JWT_SECRET || process.env.WA_D360_API_KEY;
    if (!secret) {
      throw new Error(
        'An auth or WhatsApp secret is required to verify a WhatsApp code'
      );
    }
    return secret;
  }

  private createOTPChallenge(phoneNumber: string, otp: number): string {
    // The payload is readable but cannot be changed or matched to an OTP without
    // the server secret: the HMAC covers both the payload and the six-digit code.
    const payload = Buffer.from(
      JSON.stringify({
        phoneNumber,
        expiresAt: Date.now() + 10 * 60 * 1000,
        nonce: crypto.randomBytes(16).toString('base64url'),
      })
    ).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.otpChallengeSecret())
      .update(`${payload}.${otp}`)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  private verifyOTPChallenge(
    phoneNumber: string,
    otp: string,
    challenge?: string
  ): boolean {
    if (!challenge) return false;
    const [payload, signature, extra] = challenge.split('.');
    if (!payload || !signature || extra) return false;

    let claims: { phoneNumber?: unknown; expiresAt?: unknown };
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return false;
    }
    if (
      claims.phoneNumber !== phoneNumber ||
      typeof claims.expiresAt !== 'number' ||
      claims.expiresAt < Date.now()
    ) {
      return false;
    }

    const expected = crypto
      .createHmac('sha256', this.otpChallengeSecret())
      .update(`${payload}.${otp}`)
      .digest();
    const received = Buffer.from(signature, 'base64url');
    // Constant-time comparison avoids leaking how much of a signature matched.
    return (
      received.length === expected.length &&
      crypto.timingSafeEqual(received, expected)
    );
  }

  async getBearerToken() {
    const username = process.env.WA_D360_USERNAME;
    const password = process.env.WA_D360_PASSWORD;
    if (!username || !password) {
      throw new Error(
        'WA_D360_USERNAME and WA_D360_PASSWORD are required to request a WhatsApp token'
      );
    }
    const response = await fetch('https://hub.360dialog.io/api/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.access_token) {
      console.error('WhatsApp token request rejected:', response.status);
      throw new Error('Could not send the code. Please try again.');
    }
    return data.access_token;
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000);
  }

  async sendMessage(url, bearerToken, apiKey, otp, phoneNumber) {
    const templateNamespace = process.env.WA_D360_TEMPLATE_NAMESPACE;
    const templateName = process.env.WA_D360_TEMPLATE_NAME;
    if (!templateNamespace || !templateName) {
      throw new Error(
        'WA_D360_TEMPLATE_NAMESPACE and WA_D360_TEMPLATE_NAME are required to send a WhatsApp code'
      );
    }
    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'template',
      template: {
        namespace: templateNamespace,
        name: templateName,
        language: {
          code: process.env.WA_D360_TEMPLATE_LANGUAGE || 'en',
          // Authentication templates are rejected without a deterministic policy.
          policy: 'deterministic',
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: otp,
              },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [
              {
                type: 'text',
                text: otp.toString(),
              },
            ],
          },
        ],
      },
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `bearer ${bearerToken}`,
        'D360-API-KEY': apiKey,
      },
      body: JSON.stringify(payload),
    });

    return response;
  }

  async getUserLocationAction(user: UserData) {
    const locationAction = await LocationUpdateAction.select((la) => {
      return [la.agent];
    })
      .where((la) => {
        return la.agent.equals({
          id: user.id,
        });
      })
      .one();

    return locationAction;
  }

  async updateUserLocation(latitude: number, longitude: number) {
    const auth = this.request.linkedAuth;
    if (!auth || !auth.userAccount) {
      console.warn('No user authenticated.');
      return Auth.enforceSignedIn();
    }
    const user = auth.user;

    // find existing instance for the login person
    const locationAction = await this.getUserLocationAction(user);

    // if not found, create one and set person property and location, then .save()
    if (!locationAction) {
      const newPlace = await AdministrativeArea.create({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      });

      const newLocationAction = await LocationUpdateAction.create({
        location: {
          id: newPlace.id,
        },
        agent: {
          id: user.id,
        },
      });
      return newLocationAction;
    } else {
      // if existing one found, update location
      const existingLocationAction = await (LocationUpdateAction as any).update(
        locationAction,
        {
          location: {
            latitude: latitude.toString(),
            longitude: longitude.toString(),
          },
        }
      );
      return existingLocationAction;
    }
  }
}
