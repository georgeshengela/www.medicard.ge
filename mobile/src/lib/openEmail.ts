import { Alert, Linking } from 'react-native';

/**
 * Opens the mail composer (or just the mail app when no address is given).
 * `Linking.openURL('mailto:…')` rejects on devices without a mail app (Mail removed,
 * App Review devices), which surfaced as an unhandled error — show the address instead.
 */
export async function openEmail(address?: string): Promise<void> {
  try {
    await Linking.openURL(address ? `mailto:${address}` : 'mailto:');
  } catch {
    Alert.alert(
      'ფოსტის აპი ვერ გაიხსნა',
      address ? `მოგვწერე მისამართზე:\n${address}` : 'გახსენი შენი ფოსტა და შეამოწმე შემოსული წერილები.',
    );
  }
}
