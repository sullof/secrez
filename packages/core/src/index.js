module.exports = {
  Secrez: require('./Secrez'),
  InternalFileSystem: require('./fileSystems/internal'),
  ExternalFileSystem: require('./fileSystems/external'),
  Utils: require('./utils'),
  Crypto: require('./utils/Crypto'),
  fs: require('./utils/fs'),
  config: require('./config'),
  version: require('../package').version
}