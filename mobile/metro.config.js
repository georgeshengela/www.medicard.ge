const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const withCss = withNativeWind(config, { input: './global.css' });

/**
 * Expo/Metro package-exports picks engine.io-client's ESM build, then fails
 * to resolve `./util.js` (subpath is not in that package's `exports`).
 * The prebundled browser file is the supported React Native entry.
 */
const previousResolve = withCss.resolver.resolveRequest;
withCss.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'socket.io-client') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('socket.io-client/dist/socket.io.js'),
    };
  }
  if (typeof previousResolve === 'function') {
    return previousResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withCss;
