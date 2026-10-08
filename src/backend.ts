import { Person, Person as SchemaPerson } from '@_linked/schema/shapes/Person';
import { BackendProvider } from '@_linked/server-utils/utils/BackendProvider';
import { LocationUpdateAction } from './shapes/LocationUpdateAction.js';
import { AdministrativeArea } from '@_linked/schema/shapes/AdministrativeArea';
import { Auth } from '@_linked/auth/utils/auth';
import {
  offAccountWillBeRemoved,
  onAccountWillBeRemoved,
} from '@_linked/auth/utils/events';
import { UserAccount } from '@_linked/sioc/shapes/UserAccount';
import PasswordHelper from '@_linked/auth/helpers/password';
import { AuthCredential } from '@_linked/auth/shapes/AuthCredential';
import { telephoneToWebID } from '@_linked/auth/utils/webID';
import type { UserAccountData, UserData } from '@_linked/auth/types/auth';
import { normalizeTelephone } from './utils/helper.js';

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

  async validateOTPWhatsapp(phoneIdentifier, OPT_Input) {
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

      if (this.request.session.otp.toString() !== OPT_Input) {
        console.log('OTP code is incorrect');
        return { error: 'OTP code is incorrect' };
      }

      return await Auth.login(
        this,
        async () => {
          const telephoneWebId = telephoneToWebID(normalizedPhone);

          // first, try to find account by telephone-based webID (for new users)
          let account = await UserAccount.select((ua) => [
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
            })
            .one();

          if (account && account.accountOf) {
            console.log(
              `Found account by telephone-based webID for phone number ${phoneIdentifier}`
            );
            return {
              account,
              person: account.accountOf,
            };
          }

          // if not found, try to find by telephone property (for old users with normal ID)
          console.log(
            `Account not found by webID, searching by telephone property for ${normalizedPhone}`
          );
          account = await UserAccount.select((ua) => [
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
            })
            .one();

          if (account && account.accountOf) {
            console.log(
              `Found account by telephone property for phone number ${phoneIdentifier}`
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
      console.error('validateOTPWhatsapp failed:', err);
      return {
        error: 'Sign-in failed. Please try again.',
      };
    }
  }

  async generateOTPWhatsapp(phoneNumber) {
    const session = this.request.session;
    const baseUrl = 'https://waba-v2.360dialog.io';
    const bearerToken = this.getBearerToken();
    const API_KEY = process.env.WA_D360_API_KEY;

    const otp = this.generateOTP();
    const message = `Your OTP for Whatsapp Auth is ${otp}`;
    console.log('OTP', message);

    // Save the OTP
    session.otp = otp;

    const url = `${baseUrl}/messages`;

    try {
      const response = await this.sendMessage(
        url,
        bearerToken,
        API_KEY,
        otp,
        phoneNumber
      );
      const data = await response.json();
      return { data };
    } catch (error) {
      console.error('Error sending message:', error.message);
      throw error; // Propagate the error for handling at a higher level
    }
  }

  async getBearerToken() {
    // Implement logic to securely obtain the bearer token
    const url = 'https://hub.360dialog.io/api/v2/token';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'dev@semantu.com',
          password: 'MakesSense01*',
        }),
      });
      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error getting access token:', error.message);
      throw error; // Propagate the error for handling at a higher level
    }
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000);
  }

  async sendMessage(url, bearerToken, apiKey, otp, phoneNumber) {
    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'template',
      template: {
        namespace: 'd884fc97_876c_41d6_b625_dcd644dbd941',
        name: 'authentication_peace_game',
        language: {
          code: 'en',
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
