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

// Ensure react-native always resolves to this app's copy (0.81.x)
config.resolver.extraNodeModules = {
  'react-native': path.resolve(projectRoot, 'node_modules', 'react-native'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
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
