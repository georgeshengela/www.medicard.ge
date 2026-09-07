const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

/**
 * Expo's Metro fork defaults `useWatchman` to off, so on Windows it falls back
 * to one `fs.watch` handle per directory (~7k under node_modules). That
 * exhausts the process file-handle limit and Metro crashes with
 * `EMFILE: too many open files` on the first HMR rebuild.
 * Opting in makes Metro use Watchman when the binary is on PATH
 * (`winget install facebook.watchman`); if it is missing, Metro silently
 * falls back to the old watcher, so this is safe on every machine.
 */
config.resolver.useWatchman = true;

// GLB / GLTF 3D models + vendored Three.js UMD scripts (.bin so Metro won't parse as JS)
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'glb', 'gltf', 'bin'])];

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
