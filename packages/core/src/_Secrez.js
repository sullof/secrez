const fs = require("fs-extra");
const utils = require("@secrez/utils");

const { RETURN_UINT8_ARRAY } = require("./config/booleans");

const Crypto = require("@secrez/crypto");
const bs64 = Crypto.bs64;

function zeroSensitive(value) {
  if (!value) {
    return;
  }
  if (Buffer.isBuffer(value)) {
    value.fill(0);
    return;
  }
  if (value instanceof Uint8Array) {
    value.fill(0);
  }
}

module.exports = function () {
  const __ = {
    sharedKeys: {},

    getSharedKey(publicKey) {
      if (!__.sharedKeys[publicKey]) {
        let publicKeyArr = Crypto.bs64.decode(publicKey.split("$")[0]);
        __.sharedKeys[publicKey] = Crypto.getSharedSecret(
          publicKeyArr,
          __.boxPrivateKey
        );
      }
      return __.sharedKeys[publicKey];
    },

    decrypt(encryptedData, returnUint8Array) {
      return Crypto.decrypt(encryptedData, __.masterKeyArray, returnUint8Array);
    },

    preDecrypt(encryptedData, returnUint8Array) {
      return Crypto.decrypt(
        encryptedData,
        __.derivedPassword,
        returnUint8Array
      );
    },
  };

  class _Secrez {
    constructor(secrez) {
      this.secrez = secrez;
    }

    async init(password, iterations) {
      __.password = password;
      __.iterations = iterations;
      __.derivedPassword = await _Secrez.derivePassword(password, iterations);
    }

    preEncrypt(data) {
      return Crypto.encrypt(data, __.derivedPassword);
    }

    preDecrypt(encryptedData) {
      let conf = this.conf;
      /* istanbul ignore if */
      if (!conf) {
        conf = this.readConf();
        if (!this.secrez) {
          throw new Error("Secrez not initiated");
        }
        if (!fs.existsSync(this.secrez.config.keysPath)) {
          throw new Error("Account not set yet");
        }
        conf = JSON.parse(fs.readFileSync(this.secrez.config.keysPath, "utf8"));
      }
      if (encryptedData === __.encryptedMasterKey) {
        throw new Error("Forbidden");
      }
      return __.preDecrypt(encryptedData);
    }

    encrypt(data, urlSafe) {
      let encrypted = Crypto.encrypt(data, __.masterKeyArray);
      if (urlSafe) {
        encrypted = Crypto.fromBase64ToFsSafeBase64(encrypted);
      }
      return encrypted;
    }

    decrypt(encryptedData, urlSafe, returnUint8Array) {
      if (urlSafe) {
        encryptedData = Crypto.fromFsSafeBase64ToBase64(encryptedData);
      }
      if (
        encryptedData === __.encryptedBoxPrivateKey ||
        encryptedData === __.encryptedSignPrivateKey
      ) {
        throw new Error("Forbidden");
      }
      return __.decrypt(encryptedData, returnUint8Array);
    }

    encryptShared(data, publicKey) {
      return Crypto.boxEncrypt(__.getSharedKey(publicKey), data);
    }

    decryptShared(encryptedData, publicKey) {
      return Crypto.boxDecrypt(__.getSharedKey(publicKey), encryptedData);
    }

    async isInitiated() {
      return !!__.derivedPassword;
    }

    signMessage(message) {
      return Crypto.getSignature(message, __.signPrivateKey);
    }

    async verifyPassword(password) {
      return (
        __.derivedPassword ===
        (await _Secrez.derivePassword(password, __.iterations))
      );
    }

    async changePassword(password = __.password, iterations = __.iterations) {
      let data = this.conf.data;
      __.password = password;
      __.iterations = iterations;
      __.derivedPassword = await _Secrez.derivePassword(password, iterations);
      delete data.keys;
      data.key = this.preEncrypt(__.masterKey);
      return data;
    }

    setConf(conf, doNotVerify) {
      /* istanbul ignore if  */
      if (!doNotVerify && !this.verifySavedData(conf)) {
        throw new Error("The configuration file is corrupted");
      } else {
        this.conf = conf;
        return true;
      }
    }

    verifySavedData(conf) {
      let publicKey = Crypto.bs64.decode(conf.data.sign.publicKey);
      return Crypto.verifySignature(
        JSON.stringify(this.sortObj(conf.data)),
        conf.signature,
        publicKey
      );
    }

    async signup() {
      __.masterKey = Crypto.generateKey();
      __.masterKeyArray = Crypto.bs64.decode(__.masterKey);
      let key = this.preEncrypt(__.masterKey);
      __.encryptedMasterKey = key;
      let hash = Crypto.b64Hash(__.masterKey);
      __.masterKeyHash = hash;
      const boxPair = Crypto.generateBoxKeyPair();
      const box = {
        secretKey: this.encrypt(boxPair.secretKey),
        publicKey: Crypto.bs64.encode(boxPair.publicKey),
      };
      __.boxPublicKey = boxPair.secretKey;
      __.boxPrivateKey = boxPair.secretKey;
      __.encryptedBoxPrivateKey = box.secretKey;

      const signPair = Crypto.generateSignatureKeyPair();
      const sign = {
        secretKey: this.encrypt(signPair.secretKey),
        publicKey: Crypto.bs64.encode(signPair.publicKey),
      };
      __.signPublicKey = signPair.secretKey;
      __.signPrivateKey = signPair.secretKey;
      __.encryptedSignPrivateKey = sign.secretKey;
      return {
        sign,
        box,
        key,
        hash,
      };
    }

    async signin(data) {
      try {
        __.masterKey = await __.preDecrypt(data.key);
        __.encryptedMasterKey = data.key;
        __.masterKeyArray = Crypto.bs64.decode(__.masterKey);
        __.masterKeyHash = data.hash;
        __.boxPublicKey = Crypto.bs64.decode(data.box.secretKey);
        __.boxPrivateKey = __.decrypt(data.box.secretKey, RETURN_UINT8_ARRAY);
        __.signPublicKey = Crypto.bs64.decode(data.sign.secretKey);
        __.signPrivateKey = __.decrypt(data.sign.secretKey, RETURN_UINT8_ARRAY);
        __.encryptedBoxPrivateKey = data.box.secretKey;
        __.encryptedSignPrivateKey = data.sign.secretKey;
      } catch (e) {
        throw new Error("Wrong password or wrong number of iterations");
      }
      if (utils.secureCompare(Crypto.b64Hash(__.masterKey), data.hash)) {
        return data.hash;
      } else {
        throw new Error("Hash on file does not match the master key");
      }
    }

    static async derivePassword(password = __.password, iterations) {
      password = Crypto.SHA3(password);
      let salt = Crypto.SHA3(password + iterations.toString());
      return bs64.encode(Crypto.deriveKey(password, salt, iterations, 32));
    }

    signData(data) {
      const signature = this.signMessage(JSON.stringify(this.sortObj(data)));
      const conf = {
        data,
        signature,
      };
      return conf;
    }

    sortObj(obj) {
      const sortedData = {};
      for (let prop of Object.keys(obj).sort()) {
        if (typeof obj[prop] === "object") {
          obj[prop] = this.sortObj(obj[prop]);
        }
        sortedData[prop] = obj[prop];
      }
      return sortedData;
    }

    clearSecrets() {
      for (const key of [
        "masterKeyArray",
        "boxPrivateKey",
        "signPrivateKey",
        "boxPublicKey",
        "signPublicKey",
      ]) {
        zeroSensitive(__[key]);
        delete __[key];
      }
      for (const publicKey of Object.keys(__.sharedKeys)) {
        zeroSensitive(__.sharedKeys[publicKey]);
        delete __.sharedKeys[publicKey];
      }
      for (const key of [
        "password",
        "derivedPassword",
        "masterKey",
        "encryptedMasterKey",
        "masterKeyHash",
        "encryptedBoxPrivateKey",
        "encryptedSignPrivateKey",
        "iterations",
      ]) {
        delete __[key];
      }
      delete this.conf;
    }
  }

  return _Secrez;
};
