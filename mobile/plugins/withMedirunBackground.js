const { withInfoPlist } = require('@expo/config-plugins');

/**
 * MEDIRUN records in the background only through location updates of a session the person started.
 * expo-task-manager's auto plugin also declares background fetch, which the app never uses — App Review asks
 * apps to declare only the background modes they use (Guideline 2.5.4), so the list is pinned here.
 */
const MODES = ['remote-notification', 'location'];

function withMedirunBackground(config) {
  return withInfoPlist(config, (mod) => {
    const current = Array.isArray(mod.modResults.UIBackgroundModes) ? mod.modResults.UIBackgroundModes : [];
    const unexpected = current.filter((mode) => !MODES.includes(mode) && mode !== 'fetch');
    if (unexpected.length) {
      throw new Error(`Unreviewed iOS background modes: ${unexpected.join(', ')} — add them to plugins/withMedirunBackground.js on purpose`);
    }
    mod.modResults.UIBackgroundModes = [...MODES];
    return mod;
  });
}

module.exports = withMedirunBackground;
