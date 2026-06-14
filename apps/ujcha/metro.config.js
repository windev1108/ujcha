// Prevent Metro from using the monorepo workspace root as serverRoot.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// Bun stores transitive deps in node_modules/.bun/<scope+name@ver+hash>/node_modules/
// Metro doesn't understand this layout. We build a lookup index once at startup so the
// custom resolver below can redirect Metro into the virtual store on cache miss.
const bunStorePath = path.resolve(monorepoRoot, 'node_modules/.bun');
const bunPkgIndex = new Map(); // pkgName -> absolute path to the package root

if (fs.existsSync(bunStorePath)) {
  for (const storeEntry of fs.readdirSync(bunStorePath)) {
    const nmPath = path.join(bunStorePath, storeEntry, 'node_modules');
    if (!fs.existsSync(nmPath)) continue;
    for (const entry of fs.readdirSync(nmPath)) {
      if (entry.startsWith('.')) continue;
      if (entry.startsWith('@')) {
        const scopePath = path.join(nmPath, entry);
        try {
          for (const sub of fs.readdirSync(scopePath)) {
            const key = `${entry}/${sub}`;
            if (!bunPkgIndex.has(key)) bunPkgIndex.set(key, path.join(scopePath, sub));
          }
        } catch {}
      } else if (!bunPkgIndex.has(entry)) {
        bunPkgIndex.set(entry, path.join(nmPath, entry));
      }
    }
  }
}

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

const reactPath = path.resolve(projectRoot, 'node_modules/react/index.js');
const reactNativePath = path.resolve(projectRoot, 'node_modules/react-native/index.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Pin react and react-native to this app's copies — prevents duplicate instances
  // from bun's virtual store (e.g. react@18.3.1 bleeding in via transitive deps).
  if (moduleName === 'react') return { filePath: reactPath, type: 'sourceFile' };
  if (moduleName === 'react-native') return { filePath: reactNativePath, type: 'sourceFile' };

  // @expo/metro-runtime has no error-overlay export — shim it out.
  if (moduleName === '@expo/metro-runtime/error-overlay') {
    return {
      filePath: path.resolve(projectRoot, 'src/mocks/error-overlay.js'),
      type: 'sourceFile',
    };
  }

  // Try standard Metro resolution.
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (_) {}

  // Standard resolution failed — fall back to the bun virtual store.
  const pkgName = moduleName.startsWith('@')
    ? moduleName.split('/').slice(0, 2).join('/')
    : moduleName.split('/')[0];

  const pkgRoot = bunPkgIndex.get(pkgName);
  if (pkgRoot) {
    const nmDir = pkgName.startsWith('@')
      ? path.dirname(path.dirname(pkgRoot))
      : path.dirname(pkgRoot);
    const fakeOrigin = path.join(nmDir, '__bun_virtual__.js');
    try {
      return context.resolveRequest({ ...context, originModulePath: fakeOrigin }, moduleName, platform);
    } catch {}
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
