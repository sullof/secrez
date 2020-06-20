const Fido2Client = require('../Fido2Client')
const _ = require('lodash')
const Case = require('case')
const {Crypto, config} = require('@secrez/core')
const chalk = require('chalk')

class Conf extends require('../Command') {

  setHelpAndCompletion() {
    this.cliConfig.completion.conf = {
      _self: this
    }
    this.cliConfig.completion.help.conf = true
    this.optionDefinitions = [
      {
        name: 'help',
        alias: 'h',
        type: Boolean
      },
      {
        name: 'register',
        alias: 'r',
        type: String
      },
      {
        name: 'unregister',
        alias: 'u',
        type: String
      },
      {
        name: 'recoveryCode',
        type: Boolean
      },
      {
        name: 'fido2',
        type: Boolean
      },
      {
        name: 'list',
        alias: 'l',
        type: Boolean
      },
      {
        name: 'use-this',
        type: String
      }
    ]
  }

  help() {
    return {
      description: ['Configure a second factor using an U2F key'],
      examples: [
        ['conf --fido2 -r solo',
          'registers a new key saving it as "solo"; if there are registered keys,',
          'it will checks if the new one is one of them before adding it.'],
        ['conf -l', 'lists all factors'],
        ['conf --recoveryCode -r memo', 'registers an emergency recovery code called "memo" to be used if all the factors are lost'],
        ['conf --recoveryCode -r seed --use-this "salad spring peace silk snake real they thunder please final clinic close"', 'registers an emergency recovery code called "seed" using the seed passed with the parameter "--use-this"'],
        ['conf -u solo',
          'unregister the fido2 key "solo"; if that is the only key, ',
          'it unregister also any emergency code and restores the normal access.']
      ]
    }
  }

  isEmergencyCodeSetUp() {
    const conf = this.secrez.getConf()
    let keys = conf.data.keys || {}
    for (let authenticator in keys) {
      if (keys[authenticator].type === this.secrez.config.sharedKeys.RECOVERY_CODE) {
        return true
      }
    }
  }

  async getAllFactors() {
    let allFactors = {}
    const conf = this.secrez.getConf()
    let keys = conf.data.keys || {}
    for (let authenticator in keys) {
      allFactors[authenticator] = keys[authenticator].type
    }
    return allFactors
  }

  async verifyIfAlreadyRegistered() {
    let client = this.fido2Client
    let list = await client.getKeys(true)
    let now = 'now'
    for (let l of list) {
      this.Logger.grey(`Touch your fido2 authenticator device ${now}...`)
      try {
        if (await client.verifySecret(l[0])) {
          return l[0]
        }
      } catch (e) {
      }
      now = 'again'
    }
    return false
  }

  exists(list, authenticator) {
    for (let l of list) {
      if (l[0] === authenticator) {
        return true
      }
    }
    return false
  }

  async showList(options) {
    let allFactors = await this.getAllFactors()
    if (!Object.keys(allFactors).length) {
      return this.Logger.grey('No registered second factors')
    }
    this.Logger.reset('Registered second factors:')
    let max = 0
    let factors = []
    for (let factor in allFactors) {
      max = Math.max(max, factor.length)
      factors.push([factor, allFactors[factor]])
    }
    factors.sort((a, b) => {
      let A = a[1]
      let B = b[1]
      return A > B ? 1 : A < B ? -1 : 0
    })
    for (let factor of factors) {
      let type = factor[1]
      if ((options.fido2 && type !== config.sharedKeys.FIDO2_KEY)
          || (options.recoveryCode && type !== config.sharedKeys.RECOVERY_CODE)) {
        continue
      }
      type = chalk.grey(`(${type === config.sharedKeys.FIDO2_KEY ? 'fido2 key' : 'recoveryCode'})`)
      this.Logger.reset(`${factor[0]} ${' '.repeat(max - factor[0].length)} ${type}`)
    }
  }

  async setRecoveryCode(options) {
    let client = this.fido2Client
    let list = await client.getKeys(true)
    if (!Object.keys(list).length) {
      throw new Error('An emergency recovery code can be set only if at least one security key has been registered.')
    }
    let authenticator = Case.snake(_.trim(options.register))
    if (!authenticator) {
      throw new Error('A valid name for the recovery code is required')
    }
    let conf = this.secrez.getConf()
    if (conf.data.keys[authenticator]) {
      throw new Error('A second factor with this name already exists')
    }
    let recoveryCode = options.useThis || Crypto.getMnemonic()
    let type = this.secrez.config.sharedKeys.RECOVERY_CODE
    let parts = this.secrez.generateSharedSecrets(recoveryCode)
    let sharedData = {
      parts,
      type,
      authenticator
    }
    await this.secrez.saveSharedSecrets(sharedData)
    await client.updateConf()
    let node = await this.prompt.commands.touch.touch({
      path: `main:/.RECOVERY_CODE_${authenticator}`,
      content: recoveryCode,
      versionIfExists: true
    })
    this.Logger.reset(`The recovery code has been saved in the hidden file main:${node.getPath()}`)
    this.Logger.reset('When possible, "cat" it, save it in a safe place and remove the file.')
  }

  async setFido2(options) {
    let client = this.fido2Client
    let list = await client.getKeys(true)
    let authenticator = Case.snake(_.trim(options.register))
    if (!authenticator) {
      throw new Error('A valid name for the authenticator is required')
    }
    if (!options.register) {
      throw new Error('The nickname of the key is invalid')
    }
    let conf = {}
    let savedConf = await this.secrez.readConf()
    if (savedConf.data.keys) {
      conf = savedConf.data.keys
    }
    if (conf[authenticator]) {
      throw new Error('A second factor with this name already exists')
    }
    let len = list.length
    let existentName
    if (len) {
      this.Logger.reset(`${len} key${len > 1 ? 's' : ''} already registered. Before registering a new one, must be sure that this is a new one.`)
      existentName = await this.verifyIfAlreadyRegistered()
    }
    if (existentName) {
      throw new Error(`This key is already registered as "${existentName}"`)
    } else {
      this.Logger.bold('This device is not registered, yet. You can register it now.')
    }

    let fido2Options = {
      id: Crypto.getRandomBase58String(12),
      authenticator
    }

    this.Logger.grey('Touch your fido2 authenticator device now...')
    let result = await client.setCredential(fido2Options)
    client.checkErrorCode(result, 1)

    fido2Options.credential = result.message
    fido2Options.salt = Crypto.getRandomBase58String(32)

    this.Logger.grey('Touch your fido2 authenticator device again...')
    result = await client.getSecret(fido2Options)
    client.checkErrorCode(result, 2)

    fido2Options.secret = result.message

    let yes = await this.useConfirm({
      message: `Are you sure you want to use the key ${authenticator} as a second factor? If you lose it who could not be able to access you account anymore.`,
      default: false
    })
    if (yes) {
      let type = this.secrez.config.sharedKeys.FIDO2_KEY
      let parts = this.secrez.generateSharedSecrets(fido2Options.secret)

      let sharedData = {
        parts,
        type,
        authenticator,
        id: fido2Options.id,
        salt: fido2Options.salt,
        credential: fido2Options.credential,
        hash: Crypto.b58Hash(fido2Options.secret)
      }
      await this.secrez.saveSharedSecrets(sharedData)
      await client.updateConf()
      this.Logger.reset(`A second factor using ${authenticator} has been set.`)
      if (!this.isEmergencyCodeSetUp()) {
        let yes = await this.useConfirm({
          message: `An emergency recovery code would allow you to recover the account if you lose ${authenticator}. Would you like to set it now?`,
          default: true
        })
        if (yes) {
          let name = await this.useInput({
            message: 'Type the nickname of the recovery code'
          })
          if (name) {
            options.recoveryCode = true
            options.register = name
            return await this.conf(options)
          } else {
            this.Logger.grey('Emergency code not set')
          }
        }
      }
    } else {
      throw new Error('Invalid signature')
    }
  }

  async unregister(options) {
    let authenticator = Case.snake(_.trim(options.unregister))
    let allFactors = await this.getAllFactors()
    if (!allFactors[authenticator]) {
      throw new Error(`Authenticator ${authenticator} not found`)
    }
    let yes = await this.useConfirm({
      message: `Are you sure you want to remove the ${authenticator} authenticator?`,
      default: false
    })
    let code
    if (yes) {
      code = await this.secrez.removeSharedSecret(authenticator)
      this.Logger.reset(code === 1 ? `${authenticator} has been removed` : 'All second factors have been removed')
    } else {
      this.Logger.grey('Operation canceled')
    }
    if (code === 2) {
      for (let factor in allFactors) {
        if (allFactors[factor] === this.secrez.config.sharedKeys.RECOVERY_CODE) {
          try {
            await this.prompt.commands.rm.rm({
              path: `main:/.RECOVERY_CODE_${factor}`
            })
          } catch (e) {
          }
        }
      }
    } else if (allFactors[authenticator] === this.secrez.config.sharedKeys.RECOVERY_CODE) {
      try {
        await this.prompt.commands.rm.rm({
          path: `main:/.RECOVERY_CODE_${authenticator}`
        })
      } catch (e) {
      }
    }
  }

  async conf(options) {
    if (!this.fido2Client) {
      this.fido2Client = new Fido2Client(this.secrez)
    }
    await this.fido2Client.checkIfReady()
    if (options.list) {
      await this.showList(options)
    } else if (options.recoveryCode) {
      await this.setRecoveryCode(options)
    } else if (options.fido2) {
      await this.setFido2(options)
    } else if (options.unregister) {
      await this.unregister(options)
    } else {
      throw new Error('Missing parameters. Run "conf -h" to see examples.')
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp()
    }
    try {
      if (options.fido2 && options.recoveryCode) {
        throw new Error('Conflicting params. Launch "conf -h" for examples.')
      }
      if (options.register && !(options.fido2 || options.recoveryCode)) {
        throw new Error('Missing parameters. Launch "conf -h" for examples.')
      }
      await this.conf(options)
    } catch (e) {
      this.Logger.red(e.message)
    }
    this.prompt.run()
  }
}

module.exports = Conf


