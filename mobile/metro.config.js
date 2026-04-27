// Metro config for Expo / React Native.
// We extend the default Expo config — keeping it minimal so future
// SDK upgrades require no edits here.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
