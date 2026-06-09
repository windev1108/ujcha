// Prevent Metro from using the monorepo workspace root as serverRoot.
// Without this, release builds fail: Metro resolves './index.js' from the
// workspace root (E:\startup\ujcha) instead of apps/delivery.
// watchFolders + nodeModulesPaths below handle monorepo resolution manually.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// In a pnpm monorepo every workspace's packages land in the same .pnpm virtual
// store. Metro watches workspaceRoot, so it sees *all* installed react-native
// versions (e.g. 0.85.x from apps/mobile-delivery) and tries to process them
// with this app's codegen (0.81.x), causing a parser crash.
// blockList tells Metro to skip those paths entirely.
config.resolver.blockList = [
  // Block any react-native version that isn't 0.81.x from the pnpm store
  new RegExp(
    String.raw`.*[/\\]\.pnpm[/\\]react-native@(?!0\.81\.[0-9]+)[^/\\]*[/\\]node_modules[/\\]react-native[/\\].*`
  ),
  // Also block the other app's entire node_modules to avoid cross-app bleed
  new RegExp(
    String.raw`.*[/\\]apps[/\\]mobile-delivery[/\\]node_modules[/\\]react-native[/\\].*`
  ),
];

// Ensure react and react-native always resolve to this app's copies (no duplicate instances)
config.resolver.extraNodeModules = {
  'react': path.resolve(projectRoot, 'node_modules', 'react'),
  'react-native': path.resolve(projectRoot, 'node_modules', 'react-native'),
};

const reactSingletonPath = path.resolve(projectRoot, 'node_modules', 'react');
const reactNativeSingletonPath = path.resolve(projectRoot, 'node_modules', 'react-native');

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force all react/react-native imports from any nested package to the same singleton
  if (moduleName === 'react') {
    return { filePath: path.join(reactSingletonPath, 'index.js'), type: 'sourceFile' };
  }
  if (moduleName === 'react-native') {
    return { filePath: path.join(reactNativeSingletonPath, 'index.js'), type: 'sourceFile' };
  }
  if (moduleName === '@expo/metro-runtime/error-overlay') {
    return {
      filePath: path.resolve(projectRoot, 'src/mocks/error-overlay.js'),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.alias = {
  '@': path.resolve(projectRoot, 'src'),
};

module.exports = config;
