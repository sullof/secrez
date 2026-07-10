const chai = require("chai");
const assert = chai.assert;
const path = require("path");
const Crypto = require("@secrez/crypto");
const Secrez = require("../src/Secrez")();
const Secrez2 = require("../src/Secrez")();

const Entry = require("../src/Entry");
const fs = require("fs-extra");
const config = require("../src/config");

const {
  password,
  newPassword,
  iterations,
  hash23456iterationsNoSalt,
} = require("./fixtures");

describe("#Secrez", function () {
  let rootDir = path.resolve(__dirname, "../tmp/test/secrez");
  let rootDir2 = path.resolve(__dirname, "../tmp/test/secrez2");

  let secrez;
  let secrez2;
  let masterKeyHash;

  const D = config.types.DIR;
  const F = config.types.TEXT;

  describe("default secrez dir", function () {
    it("should throw trying to test in the default ~/.secrez folder", async function () {
      try {
        secrez = new Secrez();
        await secrez.init();
        assert.isTrue(false);
      } catch (e) {
        assert.equal(
          e.message,
          "You are not supposed to test Secrez in the default folder. This can lead to mistakes and loss of data."
        );
      }
    });
  });

  describe("custom (testing) secrez dir", function () {
    before(async function () {
      await fs.emptyDir(path.resolve(__dirname, "../tmp/test"));
      secrez = new Secrez();
      await secrez.init(rootDir);
      secrez2 = new Secrez2();
      await secrez2.init(rootDir2);
    });

    describe("derivePassword", async function () {
      it("should derive a password and obtain a predeterminded hash", async function () {
        let derivedPassword = await secrez.derivePassword(password, iterations);
        assert.equal(
          Crypto.b64Hash(derivedPassword),
          hash23456iterationsNoSalt
        );
      });
    });

    describe("signup and signin", async function () {
      beforeEach(async function () {
        await fs.emptyDir(path.resolve(__dirname, "../tmp/test"));
        secrez = new Secrez();
      });

      it("should signup the user and signin without saving the iterations", async function () {
        await secrez.init(rootDir);
        await secrez.signup(password, iterations);

        assert.isTrue(await fs.pathExists(secrez.config.keysPath));
        masterKeyHash = secrez.masterKeyHash;
        secrez.signout();
        assert.isUndefined(secrez.masterKeyHash);
        await secrez.signin(password, iterations);
        assert.equal(masterKeyHash, secrez.masterKeyHash);
      });

      it("should signup in two instances without conflicts", async function () {
        await secrez.init(rootDir);
        await secrez.signup(password, iterations);

        await secrez2.init(rootDir2);
        await secrez2.signup(password, iterations);

        assert.notEqual(secrez.getConf().data.id, secrez2.getConf().data.id);
      });

      it("should signup the user and signin saved the iterations", async function () {
        await secrez.init(rootDir);
        await secrez.signup(password, iterations);
        await secrez.saveIterations(iterations);
        assert.isTrue(await fs.pathExists(secrez.config.keysPath));
        assert.isTrue(await fs.pathExists(secrez.config.envPath));
        masterKeyHash = secrez.masterKeyHash;
        secrez.signout();
        assert.isUndefined(secrez.masterKeyHash);
        await secrez.signin(password);
        assert.equal(masterKeyHash, secrez.masterKeyHash);
      });

      it("should signup with version one, and signin and upgrade to version two", async function () {
        await secrez.init(rootDir);
        await secrez.signup(password, iterations, "1");
        await secrez.saveIterations(iterations);
        masterKeyHash = secrez.masterKeyHash;
        secrez.signout();
        await secrez.signin(password);
        secrez.signout();
        await secrez.signin(password);
        assert.equal(masterKeyHash, secrez.masterKeyHash);
      });

      it("should signup the user, change password and signin", async function () {
        await secrez.init(rootDir);
        await secrez.signup(password, iterations);
        await secrez.saveIterations(iterations);
        masterKeyHash = secrez.masterKeyHash;
        await secrez.upgradeAccount(newPassword);
        secrez.signout();
        assert.isUndefined(secrez.masterKeyHash);
        await secrez.signin(newPassword);
        assert.equal(masterKeyHash, secrez.masterKeyHash);
      });

      it("should signup the user, change iterations and signin", async function () {
        await secrez.init(rootDir);
        await secrez.signup(password, iterations);
        masterKeyHash = secrez.masterKeyHash;
        await secrez.upgradeAccount(undefined, iterations + 100);
        secrez.signout();
        assert.isUndefined(secrez.masterKeyHash);
        await secrez.signin(password, iterations + 100);
        assert.equal(masterKeyHash, secrez.masterKeyHash);
      });

      it("should signup the user, change password and iterations and signin", async function () {
        await secrez.init(rootDir);
        await secrez.signup(password, iterations);
        masterKeyHash = secrez.masterKeyHash;
        assert.isTrue(await secrez.verifyPassword(password));
        await secrez.upgradeAccount(newPassword, iterations + 100);
        secrez.signout();
        assert.isUndefined(secrez.masterKeyHash);
        await secrez.signin(newPassword, iterations + 100);
        assert.equal(masterKeyHash, secrez.masterKeyHash);
      });

      it("should clear secrets from memory on signout", async function () {
        await secrez.init(rootDir);
        await secrez.signup(password, iterations);
        const encrypted = secrez.encryptData("some secret");
        secrez.signout();
        assert.isUndefined(secrez.masterKeyHash);
        assert.throws(() => secrez.encryptData("x"), /User not logged/);
        await secrez.signin(password, iterations);
        assert.equal(secrez.decryptData(encrypted), "some secret");
      });

      describe("should throw an error", async function () {
        it("trying to signup if Secrez has not been initiated", async function () {
          try {
            await secrez.signup(password, iterations);
            assert.isFalse(true);
          } catch (e) {
            assert.equal(e.message, "Secrez not initiated");
          }
        });

        it("trying to signin if Secrez has not been initiated", async function () {
          try {
            await secrez.signin(password, iterations);
            assert.isFalse(true);
          } catch (e) {
            assert.equal(e.message, "Secrez not initiated");
          }
        });

        it("trying to signup if account already exists", async function () {
          await secrez.init(rootDir);
          await secrez.signup(password, iterations);
          try {
            await secrez.signup(password, iterations);
            assert.isFalse(true);
          } catch (e) {
            assert.equal(
              e.message,
              "An account already exists. Please, sign in or chose a different container directory"
            );
          }
        });

        it("trying to signin if account is not set yet", async function () {
          await secrez.init(rootDir);
          try {
            await secrez.signin(password, iterations);
            assert.isFalse(true);
          } catch (e) {
            assert.equal(e.message, "Account not set yet");
          }
        });

        it("trying to signin with missed iterations", async function () {
          await secrez.init(rootDir);
          await secrez.signup(password, iterations);
          try {
            await secrez.signin(password);
            assert.isFalse(true);
          } catch (e) {
            assert.equal(e.message, "Iterations is missed");
          }
        });

        it("trying to signin with the wrong password", async function () {
          await secrez.init(rootDir);
          await secrez.signup(password, iterations);
          try {
            await secrez.signin("wrongPassword", iterations);
            assert.isFalse(true);
          } catch (e) {
            assert.equal(
              e.message,
              "Wrong password or wrong number of iterations"
            );
          }
        });

        it("trying to signin with the right password but wrong number of iterations", async function () {
          await secrez.init(rootDir);
          await secrez.signup(password, iterations);
          try {
            await secrez.signin(password, iterations - 1);
            assert.isFalse(true);
          } catch (e) {
            assert.equal(
              e.message,
              "Wrong password or wrong number of iterations"
            );
          }
        });

        it("trying to signin with the right password but using a wrong hash on file", async function () {
          await secrez.init(rootDir);
          await secrez.signup(password, iterations);
          let conf = JSON.parse(
            await fs.readFile(secrez.config.keysPath, "utf8")
          );
          conf.data.hash = hash23456iterationsNoSalt;
          await fs.writeFile(secrez.config.keysPath, JSON.stringify(conf));
          try {
            await secrez.signin(password, iterations);
            assert.isFalse(true);
          } catch (e) {
            assert.equal(
              e.message,
              "Hash on file does not match the master key"
            );
          }
        });

        it("trying to sign out if never signed-in", async function () {
          await secrez.init(rootDir);
          try {
            secrez.signout();
            assert.isFalse(true);
          } catch (e) {
            assert.equal(e.message, "User not logged");
          }
        });
      });
    });

    describe("encryptEntry and decryptEntry", async function () {
      beforeEach(async function () {
        await fs.emptyDir(path.resolve(__dirname, "../tmp/test"));
        secrez = new Secrez();
        await secrez.init(rootDir);
      });

      it("should encrypt a name and decrypt it", async function () {
        await secrez.signup(password, iterations);
        let name = "some random data";
        let id = Crypto.getRandomId();
        let encryptedData = secrez.encryptEntry(
          new Entry({ id, type: D, name, preserveContent: true })
        );
        let decryptedData = secrez.decryptEntry(encryptedData);
        assert.equal(name, decryptedData.name);
        assert.equal(id, decryptedData.id);
      });

      it("should encrypt a very long name and decrypt it", async function () {
        await secrez.signup(password, iterations);
        let name =
          "山东恒美百特新能源环保设备有限公司是国内大型的新能源环保设备制造商，注册商标“恒美百特”。公司集研发、生产、销售、服务四位于";
        let id = Crypto.getRandomId();
        let encryptedData = secrez.encryptEntry(
          new Entry({ id, type: D, name, preserveContent: true })
        );
        let decryptedData = secrez.decryptEntry(encryptedData);
        assert.equal(name, decryptedData.name);
        assert.equal(id, decryptedData.id);
      });

      it("should encrypt name and content and decrypt it", async function () {
        await secrez.signup(password, iterations);
        let name = "some random data";
        let content = "some random content";
        let id = Crypto.getRandomId();
        let encryptedData = secrez.encryptEntry(
          new Entry({ id, type: F, name, content })
        );
        encryptedData.preserveContent = true;
        assert.equal(name, secrez.decryptEntry(encryptedData).name);
        assert.equal(content, secrez.decryptEntry(encryptedData).content);
      });

      it("should encrypt only the content and decrypt it", async function () {
        await secrez.signup(password, iterations);
        let content = "some random content";
        let id = Crypto.getRandomId();
        let encryptedData = secrez.encryptEntry(
          new Entry({ id, type: F, content, preserveContent: true })
        );
        encryptedData.set({ preserveContent: true });
        assert.equal(content, secrez.decryptEntry(encryptedData).content);
      });

      it("should decrypt content-only entry with the bound timestamp", async function () {
        await secrez.signup(password, iterations);
        const name = "some random data";
        const content = "some random content";
        const id = Crypto.getRandomId();
        const encryptedData = secrez.encryptEntry(
          new Entry({ id, type: F, name, content })
        );
        const { ts } = encryptedData.get(["ts"]);
        encryptedData.set({
          nameId: id,
          nameTs: ts,
        });
        encryptedData.unset(["encryptedName"]);
        const decryptedData = secrez.decryptEntry(encryptedData);
        assert.equal(id, decryptedData.id);
        assert.equal(ts, decryptedData.ts);
        assert.notEqual(decryptedData.ts, decryptedData.id);
        assert.equal(content, decryptedData.content);
      });

      it("should re-encrypt the content and decrypt it", async function () {
        await secrez.signup(password, iterations);
        let name = "some random data";
        let content = "some random content";
        let id = Crypto.getRandomId();
        let entry = new Entry({
          id,
          type: F,
          name,
          content,
        });
        let encryptedData = secrez.encryptEntry(entry);
        let decryptedData = secrez.decryptEntry(encryptedData);
        assert.equal(name, decryptedData.name);
        assert.equal(content, decryptedData.content);
        content = "some modified content";
        encryptedData = secrez.encryptEntry(
          new Entry({ id, type: F, name, content })
        );
        decryptedData = secrez.decryptEntry(encryptedData);
        assert.equal(name, decryptedData.name);
        assert.equal(content, decryptedData.content);
      });

      it("should throw if the user is not logged in", async function () {
        try {
          let data = new Entry();
          secrez.encryptEntry(data);
          assert.isFalse(true);
        } catch (e) {
          assert.equal(e.message, "User not logged");
        }

        try {
          secrez.decryptEntry(new Entry({ name: "some encrypted data" }));
          assert.isFalse(true);
        } catch (e) {
          assert.equal(e.message, "User not logged");
        }
      });

      it("should throw if wrong type", async function () {
        try {
          await secrez.signup(password, iterations);
          let name = "some random data";
          let content = "some random content";
          let id = Crypto.getRandomId();
          let entry = new Entry({
            id,
            type: 9,
            name,
            content,
          });
          secrez.encryptEntry(entry);
          assert.isFalse(true);
        } catch (e) {
          assert.equal(e.message, "Unsupported type");
        }
      });

      it("should throw if no entry is passed", async function () {
        await secrez.signup(password, iterations);

        try {
          let name = "some random data";
          let content = "some random content";
          let id = Crypto.getRandomId();
          let obj = {
            id,
            type: 3,
            name,
            content,
          };
          secrez.encryptEntry(obj);
          assert.isFalse(true);
        } catch (e) {
          assert.equal(e.message, "An Entry instance is expected as parameter");
        }

        try {
          let name = "some random data";
          let content = "some random content";
          let id = Crypto.getRandomId();
          let entry = new Entry({
            id,
            type: F,
            name,
            content,
          });
          secrez.decryptEntry(entry.get());
          assert.isFalse(true);
        } catch (e) {
          assert.equal(e.message, "An Entry instance is expected as parameter");
        }
      });

      it("should throw if encrypted data are corrupted", async function () {
        try {
          await secrez.signup(password, iterations);
          let name = "some random data";
          let id = Crypto.getRandomId();
          let entry = new Entry({
            id,
            type: 1,
            name,
          });
          let encryptedData = secrez.encryptEntry(entry);
          encryptedData.encryptedName =
            encryptedData.encryptedName.substring(
              0,
              encryptedData.encryptedName.length - 10
            ) + "SANqTUj5gj";
          secrez.decryptEntry(encryptedData);
          assert.isFalse(true);
        } catch (e) {
          assert.equal(e.message, "Fatal error during decryption");
        }
      });

      it("should throw if content has not the same id of the name", async function () {
        await secrez.signup(password, iterations);
        try {
          let name = "some random data";
          let content = "some random content";
          let id = Crypto.getRandomId();
          let encryptedData = secrez.encryptEntry(
            new Entry({ id, type: F, name })
          );
          id = Crypto.getRandomId([id]);
          let encryptedData2 = secrez.encryptEntry(
            new Entry({ id, type: F, content })
          );
          encryptedData.encryptedContent = encryptedData2.encryptedContent;
          secrez.decryptEntry(encryptedData);
          assert.isFalse(true);
        } catch (e) {
          assert.equal(e.message, "Data is corrupted");
        }

        try {
          let name = "some random data";
          let content = "some random content";
          let id = Crypto.getRandomId();
          let encryptedData = secrez.encryptEntry(
            new Entry({ id, type: F, name })
          );
          id = Crypto.getRandomId([id]);
          let encryptedData2 = secrez.encryptEntry(
            new Entry({ id, type: F, content })
          );
          encryptedData.encryptedContent = encryptedData2.encryptedContent;
          encryptedData.set({
            nameId: id,
            nameTs: encryptedData.ts,
          });
          encryptedData.unset(["encryptedName"]);
          secrez.decryptEntry(encryptedData);
          assert.isFalse(true);
        } catch (e) {
          assert.equal(e.message, "Content is corrupted");
        }
      });

      it("should throw if parameters are missed", async function () {
        try {
          await secrez.signup(password, iterations);
          secrez.decryptEntry(new Entry());
          assert.isFalse(true);
        } catch (e) {
          assert.equal(e.message, "Missing parameters");
        }
      });
    });

    describe("encryptData and decryptData", async function () {
      beforeEach(async function () {
        await fs.emptyDir(path.resolve(__dirname, "../tmp/test"));
        secrez = new Secrez();
        await secrez.init(rootDir);
      });

      it("should encrypt some data and decrypt it", async function () {
        await secrez.signup(password, iterations);
        let name = "some random data";
        let encryptedData = secrez.encryptData(name);
        let decryptedData = secrez.decryptData(encryptedData);
        assert.equal(name, decryptedData);
      });

      it("should throw trying to get box and sign secret keys", async function () {
        await secrez.signup(password, iterations);
        let conf = await secrez.getConf();
        let conf2 = await secrez.readConf();
        assert.deepEqual(conf.data, conf2.data);
        try {
          secrez.decryptData(conf.data.sign.secretKey);
          assert.isTrue(false);
        } catch (e) {
          assert.equal(e.message, "Forbidden");
        }

        try {
          secrez.decryptData(conf.data.box.secretKey);
          assert.isTrue(false);
        } catch (e) {
          assert.equal(e.message, "Forbidden");
        }
      });
    });

    describe("preEncryptData and preDecryptData", async function () {
      beforeEach(async function () {
        await fs.emptyDir(path.resolve(__dirname, "../tmp/test"));
        secrez = new Secrez();
        await secrez.init(rootDir);
      });

      it("should encrypt some data with the derivedPassword and decrypt it", async function () {
        await secrez.signup(password, iterations);
        let name = "some random data";
        let encryptedData = secrez.preEncryptData(name);
        let decryptedData = secrez.preDecryptData(encryptedData);
        assert.equal(name, decryptedData);
      });

      it("should throw trying to get the master key", async function () {
        await secrez.signup(password, iterations);
        let conf = await secrez.getConf();
        try {
          secrez.preDecryptData(conf.data.key);
          assert.isTrue(false);
        } catch (e) {
          assert.equal(e.message, "Forbidden");
        }
      });
    });

    describe("#readConf", async function () {
      beforeEach(async function () {
        await fs.emptyDir(path.resolve(__dirname, "../tmp/test"));
        secrez = new Secrez();
        // await secrez.init(rootDir)
      });

      it("should encrypt some data with the derivedPassword and decrypt it", async function () {
        await secrez.init(rootDir);
        await secrez.signup(password, iterations);
        assert.isDefined(await secrez.readConf());
      });

      it("should throw trying to get the master key", async function () {
        await secrez.init(rootDir);
        try {
          await secrez.readConf();
          assert.isTrue(false);
        } catch (e) {
          assert.equal(e.message, "Account not set yet");
        }
      });

      it("should throw trying to get the master key", async function () {
        try {
          await secrez.readConf();
          assert.isTrue(false);
        } catch (e) {
          assert.equal(e.message, "Secrez not initiated");
        }
      });
    });

    describe("#signMessage", async function () {
      beforeEach(async function () {
        await fs.emptyDir(path.resolve(__dirname, "../tmp/test"));
        secrez = new Secrez();
        // await secrez.init(rootDir)
      });

      it("should sign a message and verify it", async function () {
        await secrez.init(rootDir);
        await secrez.signup(password, iterations);
        assert.isTrue(await fs.pathExists(secrez.config.keysPath));
        masterKeyHash = secrez.masterKeyHash;
        secrez.signout();
        assert.isUndefined(secrez.masterKeyHash);
        await secrez.signin(password, iterations);
        assert.equal(masterKeyHash, secrez.masterKeyHash);

        let signature = secrez.signMessage("message");
        assert.isTrue(secrez.verifySignedMessage("message", signature));
      });
    });

    describe("#getPublicKey", async function () {
      beforeEach(async function () {
        await fs.emptyDir(path.resolve(__dirname, "../tmp/test"));
        secrez = new Secrez();
        // await secrez.init(rootDir)
      });

      it("should sign a message and verify it", async function () {
        await secrez.init(rootDir);
        await secrez.signup(password, iterations);
        assert.isTrue(await fs.pathExists(secrez.config.keysPath));
        masterKeyHash = secrez.masterKeyHash;
        secrez.signout();
        assert.isUndefined(secrez.masterKeyHash);
        await secrez.signin(password, iterations);
        assert.equal(masterKeyHash, secrez.masterKeyHash);

        let publicKey = secrez.getPublicKey();
        assert.isTrue(Crypto.isValidSecrezPublicKey(publicKey));
        assert.isFalse(Crypto.isValidSecrezPublicKey([1, 2, 3, 4]));

        let signPublicKey =
          Crypto.getSignPublicKeyFromSecretPublicKey(publicKey);
        let boxPublicKey = Crypto.getBoxPublicKeyFromSecretPublicKey(publicKey);

        publicKey = publicKey.split("$").map((e) => Crypto.bs64.decode(e));
        assert.equal(publicKey[0].toString(), boxPublicKey.toString());
        assert.equal(publicKey[1].toString(), signPublicKey.toString());
      });
    });

    describe("#encrypt and decrypt shared data", async function () {
      it("should get a shared ket", async function () {
        await fs.emptyDir(path.resolve(__dirname, "../tmp/test"));
        secrez = new Secrez();
        await secrez.init(rootDir);
        await secrez.signup(password, iterations);

        secrez2 = new Secrez2();
        await secrez2.init(rootDir + "1");
        await secrez2.signup(password, iterations);

        let message = "Some message";
        let encryptedMessage = secrez.encryptSharedData(
          message,
          secrez2.getPublicKey()
        );
        let decryptedMessage = secrez2.decryptSharedData(
          encryptedMessage,
          secrez.getPublicKey()
        );

        assert.equal(decryptedMessage, message);
      });
    });
  });
});
