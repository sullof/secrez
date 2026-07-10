const { homedir } = require("os");
const fs = require("fs-extra");
const _ = require("lodash");
const Crypto = require("@secrez/crypto");
const ConfigUtils = require("./config/ConfigUtils");
const Entry = require("./Entry");

const { DO_NOT_VERIFY, URL_SAFE } = require("./config/booleans");

module.exports = function () {
  let _secrez;
  const _Secrez = require("./_Secrez")();

  class Secrez {
    constructor() {
      this.config = _.clone(require("./config"));
      this.types = this.config.types;
    }

    async init(
      container = `${homedir()}/.secrez`,
      localWorkingDir = homedir()
    ) {
      if (
        process.env.NODE_ENV === "test" &&
        container === `${homedir()}/.secrez`
      ) {
        throw new Error(
          "You are not supposed to test Secrez in the default folder. This can lead to mistakes and loss of data."
        );
      }
      this.config = await ConfigUtils.setSecrez(
        this.config,
        container,
        localWorkingDir
      );
    }

    async signup(password, iterations) {
      if (!this.config || !this.config.keysPath) {
        throw new Error("Secrez not initiated");
      }
      if (!(await fs.pathExists(this.config.keysPath))) {
        let id = Crypto.b64Hash(Crypto.generateKey());
        _secrez = new _Secrez(this);

        await _secrez.init(password, iterations);

        let { sign, box, key, hash } = await _secrez.signup();
        this.masterKeyHash = hash;

        const data = {
          id,
          sign,
          box,
          key,
          hash,
          when: _secrez.encrypt(Date.now().toString()),
          version: this.config.VERSION,
        };
        _secrez.setConf(await this.signAndSave(data), DO_NOT_VERIFY);
      } else {
        throw new Error(
          "An account already exists. Please, sign in or chose a different container directory"
        );
      }
    }

    async signin(password, iterations) {
      if (!this.config || !this.config.keysPath) {
        throw new Error("Secrez not initiated");
      }
      if (!iterations) {
        const env = await ConfigUtils.getEnv(this.config);
        iterations = env.iterations;
      }
      if (!iterations || iterations !== parseInt(iterations.toString())) {
        throw new Error("Iterations is missed");
      }
      iterations = parseInt(iterations);
      const conf = await this.readConf();
      const data = conf.data;
      _secrez = new _Secrez(this);
      await _secrez.init(password, iterations);
      /* istanbul ignore if  */
      if (!data.key) {
        throw new Error("No valid data found");
      }
      let masterKeyHash = await _secrez.signin(data);
      this.setMasterKeyHash(conf, masterKeyHash);
      return 0;
    }

    async derivePassword(password, iterations) {
      return await _Secrez.derivePassword(password, iterations);
    }

    async signAndSave(data) {
      const conf = _secrez.signData(data);
      await fs.writeFile(this.config.keysPath, JSON.stringify(conf));
      return conf;
    }

    async saveIterations(iterations) {
      const env = await ConfigUtils.getEnv(this.config);
      env.iterations = iterations;
      await ConfigUtils.putEnv(this.config, env);
    }

    getConf() {
      this.assertLoggedIn();
      return _secrez.conf;
    }

    getPublicKey() {
      this.assertLoggedIn();
      return (
        _secrez.conf.data.box.publicKey + "$" + _secrez.conf.data.sign.publicKey
      );
    }

    async readConf() {
      if (!this.config || !this.config.keysPath) {
        throw new Error("Secrez not initiated");
      }
      if (await fs.pathExists(this.config.keysPath)) {
        return JSON.parse(await fs.readFile(this.config.keysPath, "utf8"));
      } else {
        throw new Error("Account not set yet");
      }
    }

    async upgradeAccount(password, iterations) {
      let data = await _secrez.changePassword(password, iterations);
      _secrez.setConf(await this.signAndSave(data), DO_NOT_VERIFY);
    }

    async verifyPassword(password) {
      return await _secrez.verifyPassword(password);
    }

    signMessage(message) {
      this.assertLoggedIn();
      return _secrez.signMessage(message);
    }

    verifySignedMessage(message, signature, publicKey) {
      return Crypto.verifySignature(
        message,
        signature,
        Crypto.bs64.decode(publicKey || this.getConf().data.sign.publicKey)
      );
    }

    setMasterKeyHash(conf, masterKeyHash) {
      /* istanbul ignore if  */
      if (!_secrez.setConf(conf)) {
        throw new Error("keys.json looks corrupted");
      }
      this.masterKeyHash = masterKeyHash;
    }

    assertLoggedIn() {
      if (!this.masterKeyHash) {
        throw new Error("User not logged");
      }
    }

    preserveEntry(prev, next) {
      let options = prev.get();
      for (let o in options) {
        if (!next[o]) {
          next.set(o, options[o]);
        }
      }
      return next;
    }

    encryptData(data, urlSafe) {
      this.assertLoggedIn();
      return _secrez.encrypt(data, urlSafe);
    }

    decryptData(encryptedData, urlSafe, returnUint8Array) {
      this.assertLoggedIn();
      return _secrez.decrypt(encryptedData, urlSafe, returnUint8Array);
    }

    preEncryptData(data) {
      this.assertLoggedIn();
      return _secrez.preEncrypt(data);
    }

    preDecryptData(encryptedData) {
      this.assertLoggedIn();
      return _secrez.preDecrypt(encryptedData);
    }

    encryptSharedData(data, publicKey) {
      this.assertLoggedIn();
      return _secrez.encryptShared(data, publicKey);
    }

    decryptSharedData(encryptedData, publicKey) {
      this.assertLoggedIn();
      return _secrez.decryptShared(encryptedData, publicKey);
    }

    encryptEntry(entry, useTs) {
      if (!entry || entry.constructor.name !== "Entry") {
        throw new Error("An Entry instance is expected as parameter");
      }

      const { type, name, content, preserveContent, id } = entry.get();

      this.assertLoggedIn();
      if (!ConfigUtils.isValidType(type)) {
        throw new Error("Unsupported type");
      }

      let ts =
        useTs && entry.ts
          ? entry.ts
          : Crypto.getTimestampWithMicroseconds().join(".");
      let encryptedEntry = new Entry({
        id,
        type,
        ts,
      });
      if (name) {
        let encryptedName =
          type +
          _secrez.encrypt(
            JSON.stringify({
              i: id,
              t: ts,
              n: name,
            }),
            URL_SAFE
          );
        let extraName;
        if (encryptedName.length > 255) {
          extraName = encryptedName.substring(254);
          encryptedName = encryptedName.substring(0, 254) + "$";
        }

        encryptedEntry.set({
          encryptedName,
          extraName,
        });

        if (preserveContent) {
          encryptedEntry = this.preserveEntry(entry, encryptedEntry);
        }
      }
      if (content) {
        encryptedEntry.set({
          encryptedContent: _secrez.encrypt(
            JSON.stringify({
              i: id,
              t: ts,
              c: content,
            })
          ),
        });
        if (preserveContent) {
          encryptedEntry = this.preserveEntry(entry, encryptedEntry);
        }
      }
      return encryptedEntry;
    }

    decryptEntry(encryptedEntry, urlSafe) {
      if (!encryptedEntry || encryptedEntry.constructor.name !== "Entry") {
        throw new Error("An Entry instance is expected as parameter");
      }

      const {
        encryptedContent,
        extraName,
        encryptedName,
        preserveContent,
        nameId,
        nameTs,
      } = encryptedEntry.get();

      this.assertLoggedIn();
      try {
        if (encryptedName) {
          let data = encryptedName;
          if (extraName) {
            data = encryptedName.substring(0, 254) + extraName;
          }
          let type = parseInt(data[0]);
          let e = JSON.parse(_secrez.decrypt(data.substring(1), URL_SAFE));
          let id = e.i;
          let ts = e.t;
          let name = e.n;
          let content = "";

          // during the indexing internalFS reads only the names of the files
          if (encryptedContent) {
            let e = JSON.parse(_secrez.decrypt(encryptedContent));
            if (id !== e.i || ts !== e.t) {
              throw new Error("Data is corrupted");
            }
            content = e.c;
          }

          let decryptedEntry = new Entry({
            id,
            type,
            ts,
            name,
            content,
          });

          if (preserveContent) {
            decryptedEntry = this.preserveEntry(encryptedEntry, decryptedEntry);
          }

          return decryptedEntry;
        }

        // when the encryptedName has been already decrypted and we need only the content
        if (encryptedContent) {
          let e = JSON.parse(_secrez.decrypt(encryptedContent));

          if ((nameId && e.i !== nameId) || (nameTs && e.t !== nameTs)) {
            throw new Error("Content is corrupted");
          }

          let decryptedEntry = new Entry({
            id: e.i,
            ts: e.t,
            content: e.c,
          });

          if (preserveContent) {
            decryptedEntry = this.preserveEntry(encryptedEntry, decryptedEntry);
          }

          return decryptedEntry;
        }
      } catch (e) {
        if (e.message === "Data is corrupted") {
          throw e;
        } else if (e.message === "Content is corrupted") {
          throw e;
        }
        throw new Error("Fatal error during decryption");
      }

      throw new Error("Missing parameters");
    }

    signout() {
      if (this.masterKeyHash) {
        _secrez.clearSecrets();
        delete this.masterKeyHash;
        _secrez = undefined;
      } else {
        throw new Error("User not logged");
      }
    }
  }

  return Secrez;
};
