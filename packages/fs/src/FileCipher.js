const Crypto = require("@secrez/crypto");
const legacy = require("./fileCipherLegacy");

class FileCipher {
  constructor(secrez) {
    if (secrez.constructor.name === "Secrez") {
      this.secrez = secrez;
    } else {
      throw new Error(
        "FileCipher requires a Secrez instance during construction"
      );
    }
  }

  shortPublicKey(pk) {
    return pk.split("$")[0].substring(0, 16);
  }

  deriveExportPasswordKey(password, iterations, randomSaltB64) {
    const passwordKey = Crypto.SHA3(password);
    const salt = Crypto.SHA3(
      passwordKey + iterations.toString() + randomSaltB64
    );
    return Crypto.bufferToUint8Array(
      Crypto.deriveKey(passwordKey, salt, iterations, 32)
    );
  }

  encryptFile(content, options) {
    if (options.password) {
      return this.encryptFileWithPassword(content, options);
    }
    return this.encryptFileWithPublicKeys(content, options);
  }

  encryptFileWithPassword(content, options) {
    const iterations = parseInt(options.iterations, 10);
    if (!iterations || iterations < 1) {
      throw new Error("A positive number of iterations is required");
    }
    const randomSaltB64 = Crypto.bs64.encode(Crypto.generateKey());
    const key = Crypto.generateKey();
    const derivedPassword = this.deriveExportPasswordKey(
      options.password,
      iterations,
      randomSaltB64
    );
    return [
      "2",
      Crypto.encrypt(content, key),
      randomSaltB64,
      Crypto.encrypt(key, derivedPassword),
    ];
  }

  encryptFileWithPublicKeys(content, options) {
    const key = Crypto.generateKey();
    const result = ["1", Crypto.encrypt(content, key)];
    const myShort = this.shortPublicKey(this.secrez.getPublicKey());
    result[2] = myShort;
    if (options.publicKeys) {
      for (let publicKey of options.publicKeys) {
        let short = this.shortPublicKey(publicKey);
        let encKey =
          short === myShort
            ? this.secrez.encryptData(key)
            : this.secrez.encryptSharedData(key, publicKey);
        result.push(short + encKey);
      }
    }
    return result;
  }

  decryptFile(encryptedContent, options) {
    if (typeof encryptedContent === "string") {
      encryptedContent = encryptedContent.split(",");
    }
    const version = encryptedContent[0];
    if (version === "2") {
      return this.decryptFileV2(encryptedContent, options);
    }
    if (version === "1") {
      return this.decryptFileV1(encryptedContent, options);
    }
    throw new Error("Unsupported version");
  }

  decryptFileV2(encryptedContent, options) {
    const [, content, randomSaltB64, encryptedKey] = encryptedContent;
    if (!options.password) {
      throw new Error("A password is required");
    }
    const iterations = parseInt(options.iterations, 10);
    if (!iterations || iterations < 1) {
      throw new Error("A positive number of iterations is required");
    }
    const derivedPassword = this.deriveExportPasswordKey(
      options.password,
      iterations,
      randomSaltB64
    );
    const key = Crypto.decrypt(encryptedKey, derivedPassword);
    return Crypto.decrypt(content, key, options.returnUint8Array);
  }

  decryptFileV1(encryptedContent, options) {
    const [, content, passwordOrShortPublicKey, ...keys] = encryptedContent;
    if (keys && keys.length) {
      let myShort = this.shortPublicKey(this.secrez.getPublicKey());
      let contactPublicKey = options.contactPublicKey;
      if (!contactPublicKey) {
        for (let pk of options.contactsPublicKeys || []) {
          if (this.shortPublicKey(pk) === passwordOrShortPublicKey) {
            contactPublicKey = pk;
            break;
          }
        }
      }
      let key;
      for (let item of keys) {
        let short = item.substring(0, 16);
        item = item.substring(16);
        if (myShort === short) {
          key =
            myShort === passwordOrShortPublicKey
              ? this.secrez.decryptData(item)
              : this.secrez.decryptSharedData(item, contactPublicKey, true);
        }
      }
      if (!key) {
        throw new Error("The sender didn't encrypt the data for you");
      }
      return Crypto.decrypt(content, key);
    }
    if (!options.password) {
      throw new Error("A password is required");
    }
    return legacy.decryptWithPassword(
      content,
      passwordOrShortPublicKey,
      options.password,
      options.returnUint8Array
    );
  }
}

module.exports = FileCipher;
