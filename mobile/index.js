import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  "Custom sound 'default' not found",
  'Open debugger to view warnings',
  'InteractionManager has been deprecated',
  'ProgressBarAndroid has been extracted from react-native core',
  'SafeAreaView has been deprecated',
  'Clipboard has been extracted from react-native core',
  'PushNotificationIOS has been extracted from react-native core',
]);

import './src/lib/bootGuard.js';
import 'expo-router/entry';

