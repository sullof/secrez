const fs = require('fs-extra')
const path = require('path')
const chalk = require('chalk')

const Crypto = require('@secrez/crypto')
const {sleep} = require('@secrez/utils')

const {Node, FileCipher} = require('@secrez/fs')

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
        name: 'field',
        alias: 'f',
        type: String
      },
      {
        name: 'duration',
        alias: 'd',
        type: Number
      },
      {
        name: 'encrypt',
        alias: 'e',
        type: Boolean
      },
      {
        name: 'contacts',
        alias: 'c',
        multiple: true,
        type: String
      },
      {
        name: 'public-keys',
        multiple: true,
        type: String
      },
      {
        name: 'password',
        type: String
      },
      {
        name: 'include-me',
        type: Boolean
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
        ['export ethKeys -v 8uW3', 'exports version 8uW3 of the file'],
        ['export seed.json -e', 'asks for a password and encrypts seed.json before exporting it. The final file will have the extension ".secrez"'],
        ['export seed.json -e --password "some strong password"', 'uses the typed password to encrypt seed.json before exporting it'],
        ['export seed.json -ec bob alice', 'encrypts seed.json using a key shared with the contacts Bob and Alice, before exporting it'],
        ['export seed.json -e --public-keys TCpDvTiVpHwNiS....', 'encrypts seed.json using shared keys generated from the specified public keys'],
        ['export seed.json -e --include-me', 'encrypts seed.json also using your key']
      ]
    }
  }

  async export(options = {}) {
    let efs = this.externalFs
    let fileCipher = new FileCipher(this.secrez)
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
      let newPath = path.join(dir, path.basename(p) + (options.encrypt ? '.secrez' + (Node.isBinary(entry) ? 'b' : '') : ''))
      let name = await efs.getVersionedBasename(newPath)
      let content = entry.content
      if (Node.isBinary(entry) && typeof content === 'string') {
        content = Crypto.bs64.decode(content)
      }
      if (options.encrypt) {
        const myPublicKey = this.secrez.getPublicKey()
        if (options.publicKeys) {
          if (options.includeMe && options.publicKeys.indexOf(myPublicKey) === -1) {
            options.publicKeys.push(myPublicKey)
          }
        } else if (options.contacts) {
          options.publicKeys = await this.getContactsPublicKeys(options)
          if (options.includeMe) {
            options.publicKeys.push(myPublicKey)
          }
        } else if (options.includeMe) {
          options.publicKeys = [myPublicKey]
        } else {
          let pwd = options.password || await this.useInput({
            type: 'password',
            message: 'Type the password'
          })
          if (!pwd) {
            throw new Error('Operation canceled')
          }
          let pwd2 = options.password || await this.useInput({
            type: 'password',
            message: 'Retype it'
          })
          if (!pwd2) {
            throw new Error('Operation canceled')
          }
          if (pwd !== pwd2) {
            throw new Error('The two password do not match')
          }
          options.password = pwd
        }
        content = fileCipher.encryptFile(content, options).join(',')
      }
      let fn = path.join(dir, name)
      await fs.writeFile(fn, content)
      if (options.duration) {
        this.deleteFromDisk(fn, options.duration)
      }
      return name
    } else {
      throw new Error('Cannot export a folder')
    }
  }

  async getContactsPublicKeys(options) {
    let contacts = await this.prompt.commands.contacts.contacts({list: true, asIs: true})
    let publicKeys = []
    for (let contact of contacts) {
      if (options.contacts.indexOf(contact[0]) !== -1) {
        publicKeys.push(contact[1].publicKey)
      }
    }
    return publicKeys
  }

  async deleteFromDisk(fn, duration) {
    await sleep(1000 * duration)
    if (await fs.pathExists(fn)) {
      fs.unlink(fn)
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp()
    }
    try {
      this.validate(options)
      let name = await this.export(options)
      this.Logger.grey('Exported file:')
      this.Logger.reset(name)
      if (options.encrypt && !options.password && !options.includeMe && !this.alerted) {
        this.Logger.yellow(chalk.red('One time alert: ') + 'Only the users for which you encrypted the data can decrypt it; not even you can decrypt the exported data. Be careful!')
        this.alerted = true
      }
    } catch (e) {
      this.Logger.red(e.message)
    }
    await this.prompt.run()
  }
}

module.exports = Export


