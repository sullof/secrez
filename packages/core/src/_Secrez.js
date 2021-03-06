const fs = require('fs-extra')
const utils = require('@secrez/utils')

const Crypto = require('./Crypto')
const bs58 = Crypto.bs58

module.exports = function () {

  const __ = {
    sharedKeys: {},
    getSharedKey(publicKey) {
      if (!__.sharedKeys[publicKey]) {
        let publicKeyArr = Crypto.fromBase58(publicKey.split('0')[0])
        __.sharedKeys[publicKey] = Crypto.getSharedSecret(publicKeyArr, __.boxPrivateKey)
      }
      return __.sharedKeys[publicKey]
    }
  }

  class _Secrez {

    constructor(secrez) {
      this.secrez = secrez
    }

    async init(password, iterations, derivationVersion) {
      __.password = password
      __.iterations = iterations
      __.derivedPassword = await _Secrez.derivePassword(password, iterations, derivationVersion)
    }

    async isInitiated() {
      return !!__.derivedPassword
    }

    async signup() {
      __.masterKey = Crypto.generateKey()
      let key = this.preEncrypt(__.masterKey)
      let hash = Crypto.b58Hash(__.masterKey)
      return {
        key,
        hash
      }
    }

    initPrivateKeys(box, sign) {
      __.boxPrivateKey = box
      __.signPrivateKey = sign
    }

    signMessage(message) {
      return Crypto.getSignature(message, __.signPrivateKey)
    }

    async verifyPassword(password) {
      return __.derivedPassword === await _Secrez.derivePassword(password, __.iterations, _Secrez.derivationVersion.TWO)
    }

    async changePassword(password = __.password, iterations = __.iterations) {
      let data = this.conf.data
      let dv = _Secrez.derivationVersion.TWO
      __.password = password
      __.iterations = iterations
      __.derivedPassword = await _Secrez.derivePassword(password, iterations, dv)
      delete data.keys
      data.key = this.preEncrypt(__.masterKey)
      data.derivationVersion = dv
      return data
    }

    async restoreKey() {
      delete this.conf.data.keys
      this.conf.data.key = this.preEncrypt(__.masterKey)
    }

    setConf(conf, doNotVerify) {
      /* istanbul ignore if  */
      if (!doNotVerify && !this.verifySavedData(conf)) {
        throw new Error('The configuration file is corrupted')
      } else {
        this.conf = conf
        return true
      }
    }

    verifySavedData(conf) {
      let publicKey = Crypto.fromBase58(conf.data.sign.publicKey)
      return Crypto.verifySignature(JSON.stringify(this.sortObj(conf.data)), conf.signature, publicKey)
    }

    async signin(data) {
      try {
        __.masterKey = await this.preDecrypt(data.key, true)
        __.boxPrivateKey = Crypto.fromBase58(this.decrypt(data.box.secretKey, true))
        __.signPrivateKey = Crypto.fromBase58(this.decrypt(data.sign.secretKey, true))
      } catch (e) {
        throw new Error('Wrong password or wrong number of iterations')
      }
      if (utils.secureCompare(Crypto.b58Hash(__.masterKey), data.hash)) {
        return data.hash
      } else {
        throw new Error('Hash on file does not match the master key')
      }
    }

    async sharedSignin(data, authenticator, secret) {
      let key = data.keys[authenticator]
      try {
        let masterKey = this.recoverSharedSecrets(key.parts, secret)
        /* istanbul ignore if  */
        if (!utils.secureCompare(Crypto.b58Hash(masterKey), data.hash)) {
          throw new Error('Hash on file does not match the master key')
        }
        __.masterKey = masterKey
        __.boxPrivateKey = Crypto.fromBase58(this.decrypt(data.box.secretKey, true))
        __.signPrivateKey = Crypto.fromBase58(this.decrypt(data.sign.secretKey, true))
        return data.hash
      } catch (e) {
        throw new Error('Wrong data/secret')
      }
    }

    static async derivePassword(
        password = __.password,
        iterations,
        derivationVersion
    ) {
      password = Crypto.SHA3(password)
      let salt = derivationVersion === _Secrez.derivationVersion.TWO
          ? Crypto.SHA3(password + iterations.toString())
          : Crypto.SHA3(password)
      return bs58.encode(Crypto.deriveKey(password, salt, iterations, 32))
    }

    encrypt(data) {
      return Crypto.encrypt(data, __.masterKey)
    }

    decrypt(encryptedData, unsafeMode) {
      if (!unsafeMode && (
          encryptedData === this.conf.data.box.secretKey
          || encryptedData === this.conf.data.sign.secretKey
      )) {
        throw new Error('Attempt to hack the keys')
      }
      return Crypto.decrypt(encryptedData, __.masterKey)
    }

    preEncrypt(data) {
      return Crypto.encrypt(data, __.derivedPassword)
    }

    readConf() {
      /* istanbul ignore if  */
      if (!this.secrez) {
        throw new Error('Secrez not initiated')
      }
      /* istanbul ignore if  */
      if (!fs.existsSync(this.secrez.config.keysPath)) {
        throw new Error('Account not set yet')
      }
      return JSON.parse(fs.readFileSync(this.secrez.config.keysPath, 'utf8'))
    }

    preDecrypt(encryptedData, unsafeMode) {
      let conf = this.conf
      if (!conf) {
        conf = this.readConf()
      }
      if (!unsafeMode && encryptedData === conf.data.key) {
        throw new Error('Attempt to hack the master key')
      }
      return Crypto.decrypt(encryptedData, __.derivedPassword)
    }

    encryptShared(data, publicKey) {
      return Crypto.boxEncrypt(__.getSharedKey(publicKey), data)
    }

    decryptShared(encryptedData, publicKey) {
      return Crypto.boxDecrypt(__.getSharedKey(publicKey), encryptedData)
    }

    encodeSignature(secret) {
      const encoded = bs58.encode(Buffer.from(Crypto.SHA3(secret)))
      return encoded
    }

    generateSharedSecrets(secret) {
      let parts = Crypto.splitSecret(__.masterKey, 2, 2)
      parts[1] = this.preEncrypt(bs58.encode(Buffer.from(parts['1'])))
      parts[2] = Crypto.encrypt(bs58.encode(Buffer.from(parts['2'])), this.encodeSignature(secret))
      return parts
    }

    recoverSharedSecrets(parts, secret) {
      parts = {
        1: new Uint8Array(bs58.decode(this.preDecrypt(parts[1]))),
        2: new Uint8Array(bs58.decode(Crypto.decrypt(parts[2], this.encodeSignature(secret))))
      }
      return Crypto.joinSecret(parts)//, true)
    }

    signData(data) {
      const signature = this.signMessage(JSON.stringify(this.sortObj(data)))
      const conf = {
        data,
        signature
      }
      return conf
    }

    sortObj(obj) {
      const sortedData = {}
      for (let prop of Object.keys(obj).sort()) {
        if (typeof obj[prop] === 'object') {
          obj[prop] = this.sortObj(obj[prop])
        }
        sortedData[prop] = obj[prop]
      }
      return sortedData
    }

  }

  _Secrez.derivationVersion = {
    ONE: '1',
    TWO: '2'
  }

  return _Secrez
}
