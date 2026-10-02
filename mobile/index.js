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
// MEDIRUN background GPS task: must be defined before any screen mounts (the OS can deliver locations first).
import './src/lib/run/locationTask';
import 'expo-router/entry';

