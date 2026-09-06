import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'generic';

export type BiometricCapability = {
  available: boolean;
  enrolled: boolean;
  kind: BiometricKind;
};

const NONE: BiometricCapability = { available: false, enrolled: false, kind: 'generic' };

/** Hardware probe — Face ID / Touch ID / Android fingerprint / face unlock. */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === 'web') return NONE;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return NONE;
    const [enrolled, types] = await Promise.all([
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const iris = types.includes(LocalAuthentication.AuthenticationType.IRIS);
    const kind: BiometricKind = face ? 'face' : finger ? 'fingerprint' : iris ? 'iris' : 'generic';
    return { available: true, enrolled, kind };
  } catch {
    return NONE;
  }
}

export function shouldShowBiometricSetup(cap: BiometricCapability): boolean {
  return cap.available;
}
