const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Wspólna logika cen leży w ../core (ta sama co na landing page i w skrypcie snapshotu).
config.watchFolders = [path.resolve(__dirname, '../core')];

module.exports = config;
