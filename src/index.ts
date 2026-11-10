import './types.js';
export * from './auth/SocialLoginClient.js';
import './ontologies/capacitor.register.js';

//SHAPES FIRST
import './shapes/index.js';

//THEN COMPONENTS
import './components/LocationEnabler.js';
import './components/SigninWithFacebookButton.js';
import './components/SigninWithAppleButton.js';
import './components/SigninWithGoogleButton.js';
import './components/SafeAreaContainer.js';
import './components/SignInWithWhatsapp.js';
import './hooks/useCapacitor.js';
import './hooks/useAutomaticUpdates.js';
import './hooks/useNativeAppUpdate.js';
import './hooks/useMandatoryNativeUpdate.js';
import './hooks/useReleaseGate.js';
import './utils/releaseStatus.js';
import './utils/releaseStatusCache.js';
import './utils/releaseStatusClient.js';
