import { Alert, Linking } from 'react-native';
import { tx } from '../i18n/locale.js';

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
      tx('ფოსტის აპი ვერ გაიხსნა', "Couldn't open your mail app"),
      address
        ? tx(`მოგვწერე მისამართზე:\n${address}`, `Write to us at:\n${address}`)
        : tx('გახსენი შენი ფოსტა და შეამოწმე შემოსული წერილები.', 'Open your email and check your inbox.'),
    );
  }
}
