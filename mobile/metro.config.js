const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add 'mjs' to resolver source extensions to fix lucide-react-native imports
config.resolver.sourceExts.push('mjs');

module.exports = config;
