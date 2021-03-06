const crypto = require('crypto')
const util = require('util')
const {Keccak} = require('sha3')
const basex = require('base-x')
const shamir = require('shamir')
const bip39 = require('bip39')

const {
  box,
  secretbox,
  sign,
  randomBytes
} = require('tweetnacl')

const {
  decodeUTF8,
  encodeUTF8
} = require('tweetnacl-util')

class Crypto {

  static toBase64(data) {
    return Buffer.from(data).toString('base64')
  }

  static toBase58(data) {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data)
    }
    return Crypto.bs58.encode(data)
  }

  static toBase32(data) {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data)
    }
    return Crypto.bs32.encode(data)
  }

  static fromBase64(data) {
    return Buffer.from(data, 'base64').toString('utf-8')
  }

  static fromBase58(data) {
    return Crypto.bs58.decode(data)
  }

  static fromBase32(data) {
    return Crypto.bs32.decode(data)
  }

  static getRandomBase58String(size) {
    let i = Math.round(size / 2)
    let j = i + size
    return Crypto.bs58.encode(Buffer.from(randomBytes(2 * size))).substring(i, j)
  }

  static getRandomBase32String(size) {
    let i = Math.round(size / 2)
    let j = i + size
    return Crypto.bs32.encode(Buffer.from(randomBytes(2 * size))).substring(i, j)
  }

  static getRandomId(allIds) {
    let id
    for (; ;) {
      id = Crypto.getRandomBase58String(4)
      if (!/^[a-zA-Z]+/.test(id)) {
        continue
      }
      if (allIds) {
        /* istanbul ignore if  */
        if (allIds[id]) {
          continue
        }
        // allIds[id] = true
      }
      return id
    }
  }

  static getMnemonic() {
    return bip39.entropyToMnemonic(crypto.randomBytes(16).toString('hex'))
  }

  static async getSeed(recoveryCode) {
    return await bip39.mnemonicToSeed(recoveryCode)
  }

  static SHA3(data) {
    const hash = new Keccak(256)
    hash.update(data)
    return hash.digest()
  }

  static getRandomString(length = 12, encode = 'hex') {
    return crypto.randomBytes(length).toString(encode)
  }

  static deriveKey(key, salt, iterations, size = 32, digest = 'sha512') {
    return crypto.pbkdf2Sync(key, salt, iterations, size, digest)
  }

  static b58Hash(data, size) {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data)
    }
    return Crypto.bs58.encode(Crypto.SHA3(data)).substring(0, size)
  }

  static b32Hash(data, size) {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data)
    }
    return Crypto.bs32.encode(Crypto.SHA3(data)).substring(0, size)
  }

  static isValidB58Hash(hash) {
    return Crypto.bs58.decode(hash).length === 32
  }

  static isValidB32Hash(hash) {
    return Crypto.bs32.decode(hash).length === 32
  }

  static hexToUint8Array(hexStr) {
    if (hexStr.length % 2) {
      hexStr = '0' + hexStr
    }
    return new Uint8Array(hexStr.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
  }

  static uint8ArrayToHex(uint8) {
    return Buffer.from(uint8).toString('hex')
  }

  static newTimeBasedNonce(size, timestamp = Date.now()) {
    let nonce = randomBytes(size)
    timestamp = timestamp.toString(16)
    let ts = Crypto.hexToUint8Array(timestamp)
    for (let i = 0; i < 6; i++) {
      nonce[i] = ts[i]
    }
    return nonce
  }

  static getTimestampFromNonce(nonce) {
    nonce = nonce.slice(0, 6)
    let ts = Crypto.uint8ArrayToHex(nonce)
    return parseInt(ts, 16)
  }

  static generateKey(noEncode) {
    let key = randomBytes(secretbox.keyLength)
    return noEncode ? key : Crypto.bs58.encode(Buffer.from(key))
  }

  static isBase58String(str) {
    let re = RegExp(`[^${Crypto.base58Alphabet}]+`)
    return !re.test(str)
  }

  static isBase32String(str) {
    let re = RegExp(`[^${Crypto.zBase32Alphabet}]+`)
    return !re.test(str)
  }

  static isUint8Array(key) {
    return typeof key === 'object' && key.constructor === Uint8Array
  }

  static encryptUint8Array(messageUint8, key, nonce = Crypto.randomBytes(secretbox.nonceLength), getNonce, noEncode) {
    const keyUint8Array = Crypto.bs58.decode(key)
    const box = secretbox(messageUint8, nonce, keyUint8Array)
    const fullMessage = new Uint8Array(nonce.length + box.length)
    fullMessage.set(nonce)
    fullMessage.set(box, nonce.length)
    const encoded = noEncode ? fullMessage : Crypto.bs58.encode(Buffer.from(fullMessage))
    if (getNonce) {
      return [nonce, encoded]
    } else {
      return encoded
    }
  }

  static encrypt(message, key, nonce = Crypto.randomBytes(secretbox.nonceLength), getNonce, returnUint8Array) {
    return Crypto.encryptUint8Array(decodeUTF8(message), key, nonce, getNonce, returnUint8Array)
  }

  static encryptBuffer(buf, key, nonce = Crypto.randomBytes(secretbox.nonceLength), getNonce, returnUint8Array) {
    return Crypto.encryptUint8Array(new Uint8Array(buf), key, nonce, getNonce, returnUint8Array)
  }

  static decryptUint8Array(messageWithNonceAsUint8Array, key, returnUint8Array) {
    const keyUint8Array = Crypto.bs58.decode(key)
    const nonce = messageWithNonceAsUint8Array.slice(0, secretbox.nonceLength)
    const message = messageWithNonceAsUint8Array.slice(
        secretbox.nonceLength,
        messageWithNonceAsUint8Array.length
    )
    const decrypted = secretbox.open(message, nonce, keyUint8Array)
    if (!decrypted) {
      throw new Error('Could not decrypt message')
    }
    return returnUint8Array ? decrypted : encodeUTF8(decrypted)
  }

  static decrypt(messageWithNonce, key, returnUint8Array) {
    return Crypto.decryptUint8Array(Crypto.bs58.decode(messageWithNonce), key, returnUint8Array)
  }

  static getNonceFromMessage(messageWithNonce) {
    const messageWithNonceAsUint8Array = Crypto.bs58.decode(messageWithNonce)
    let nonce = messageWithNonceAsUint8Array.slice(0, secretbox.nonceLength)
    return Crypto.hexToUint8Array(nonce.toString('hex'))
  }

  static generateBoxKeyPair(noEncode) {
    const pair = box.keyPair()
    return pair
  }

  static seedFromPassphrase(passphrase) {
    if (typeof passphrase === 'string' && passphrase.length > 0) {
      return Uint8Array.from(Crypto.SHA3(passphrase))
    } else {
      throw new Error('Not a valid string')
    }
  }

  static generateSignatureKeyPair(seed) {
    let pair
    if (seed) {
      pair = sign.keyPair.fromSeed(seed)
    } else {
      pair = sign.keyPair()
    }
    return pair
  }

  static isValidPublicKey(key) {
    if (key instanceof Uint8Array) {
      return key.length === 32
    } else {
      return false
    }
  }

  static isValidSecretKey(key) {
    if (key instanceof Uint8Array) {
      return key.length === 64
    } else {
      return false
    }
  }

  static getSharedSecret(theirPublicKey, mySecretKey) {
    return box.before(theirPublicKey, mySecretKey)
  }

  static boxEncrypt(secretOrSharedKey, message, key, nonce = randomBytes(box.nonceLength), getNonce) {
    const messageUint8 = decodeUTF8(message)
    const encrypted = key
        ? box(messageUint8, nonce, key, secretOrSharedKey)
        : box.after(messageUint8, nonce, secretOrSharedKey)

    const fullMessage = new Uint8Array(nonce.length + encrypted.length)
    fullMessage.set(nonce)
    fullMessage.set(encrypted, nonce.length)
    const encoded = Crypto.bs58.encode(Buffer.from(fullMessage))

    if (getNonce) {
      return [nonce, encoded]
    } else {
      return encoded
    }
  }

  static boxDecrypt(secretOrSharedKey, messageWithNonce, key) {
    const messageWithNonceAsUint8Array = Crypto.bs58.decode(messageWithNonce)
    const nonce = messageWithNonceAsUint8Array.slice(0, box.nonceLength)
    const message = messageWithNonceAsUint8Array.slice(
        box.nonceLength,
        messageWithNonce.length
    )
    const decrypted = key
        ? box.open(message, nonce, key, secretOrSharedKey)
        : box.open.after(message, nonce, secretOrSharedKey)

    if (!decrypted) {
      throw new Error('Could not decrypt message')
    }
    return encodeUTF8(decrypted)
  }

  static getSignature(message, secretKey) {
    let signature = sign.detached(decodeUTF8(message), secretKey)
    return Crypto.bs58.encode(Buffer.from(signature))
  }

  static verifySignature(message, signature, publicKey) {
    let verified = sign.detached.verify(decodeUTF8(message), Crypto.bs58.decode(signature), publicKey)
    return verified
  }

  static splitSecret(secretBytes, parts, quorum) {
    if (!Crypto.isUint8Array(secretBytes)) {
      const utf8Encoder = new util.TextEncoder()
      secretBytes = utf8Encoder.encode(secretBytes)
    }
    return shamir.split(Crypto.randomBytes, parts, quorum, secretBytes)
  }

  static joinSecret(parts, asUint8Array) {
    const utf8Decoder = new util.TextDecoder()
    const recovered = shamir.join(parts)
    return asUint8Array ? recovered : utf8Decoder.decode(recovered)
  }

}

Crypto.base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
Crypto.bs58 = basex(Crypto.base58Alphabet)

Crypto.zBase32Alphabet = 'ybndrfg8ejkmcpqxot1uwisza345h769'
Crypto.bs32 = basex(Crypto.zBase32Alphabet)

Crypto.randomBytes = randomBytes

module.exports = Crypto
