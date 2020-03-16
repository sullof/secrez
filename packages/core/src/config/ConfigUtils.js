const path = require('path')
const Utils = require('../utils')
const fs = require('fs-extra')
const pkg = require('../../package')
const config = require('.')

class ConfigUtils {

  static isValidType(type) {
    type = parseInt(type)
    for (let t in config.types) {
      if (config.types[t] === type) {
        return true
      }
    }
    return false
  }

  static async setSecrez(
      config,
      container,
      localWorkingDir
  ) {
    config.root = path.basename(container)
    config.dataPath = path.join(container, 'data')
    config.tmpPath = path.join(config.dataPath, '.tmp')
    config.workingDir = '/'
    config.localWorkingDir = localWorkingDir
    config.envPath = path.join(container, '.env.json')
    config.confPath = path.join(config.dataPath, 'keys.json')
    await fs.emptyDir(config.tmpPath)
    await fs.ensureDir(config.dataPath)
    let readmePath = path.join(container, 'README')
    if (!fs.existsSync(readmePath)) {
      await fs.writeFile(readmePath, `
This folder has been generated by ${Utils.capitalize(pkg.name)} v${pkg.version}.
It contains your secret database. 
Be very careful, and don't touch anything :o)
`, 'utf-8')
    }
    return config
  }

}

module.exports = ConfigUtils
