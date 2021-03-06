const fs = require('fs-extra')
const path = require('path')

const {sleep} = require('@secrez/utils')

const {Node} = require('@secrez/fs')

class Export extends require('../Command') {

  setHelpAndCompletion() {
    this.cliConfig.completion.export = {
      _func: this.selfCompletion(this),
      _self: this
    }
    this.cliConfig.completion.help.export = true
    this.optionDefinitions = [
      {
        name: 'help',
        alias: 'h',
        type: Boolean
      },
      {
        name: 'path',
        completionType: 'file',
        alias: 'p',
        defaultOption: true,
        type: String
      },
      {
        name: 'version',
        alias: 'v',
        type: Boolean
      },
      {
        name: 'duration',
        alias: 'd',
        type: Number
      }
    ]
  }

  help() {
    return {
      description: [
        'Export encrypted data to the OS in the current local folder',
        'Files and folders are decrypted during the process.'
      ],
      examples: [
        ['export seed.json', 'decrypts and copies seed.json to the disk'],
        ['export seed.json -d 30', 'export seed.json and remove it from disk after 30 seconds'],
        ['export ethKeys -v 8uW3', 'exports version 8uW3 of the file']
      ]
    }
  }

  async export(options = {}) {
    let efs = this.externalFs
    let cat = this.prompt.commands.cat
    let lpwd = this.prompt.commands.lpwd
    let originalPath = options.path
    let data = await this.internalFs.getTreeIndexAndPath(options.path)
    options.path = data.path
    let tree = data.tree
    let p = tree.getNormalizedPath(options.path)
    let file = tree.root.getChildFromPath(p)
    if (Node.isFile(file)) {
      let entry = (await cat.cat({
        path: originalPath,
        version: options.version,
        unformatted: true
      }))[0]
      let dir = await lpwd.lpwd()
      let newPath = path.join(dir, path.basename(p))
      let name = await efs.getVersionedBasename(newPath)
      options.filePath = path.join(dir, name)
      await fs.writeFile(options.filePath, entry.content, Node.isBinary(entry) && typeof entry.content === 'string' ? 'base64' : undefined)
      if (options.duration) {
        this.deleteFromDisk(options)
      }
      return name
    } else {
      throw new Error('Cannot export a folder')
    }
  }

  async deleteFromDisk(options) {
    await sleep(1000 * options.duration)
    if (await fs.pathExists(options.filePath)) {
      fs.unlink(options.filePath)
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp()
    }
    try {
      this.validate(options)
      let name = await this.export(options)
      this.Logger.grey(options.clipboard ? 'Copied to clipboard:' : 'Exported file:')
      this.Logger.reset(name)
    } catch (e) {
      this.Logger.red(e.message)
    }
    await this.prompt.run()
  }
}

module.exports = Export


