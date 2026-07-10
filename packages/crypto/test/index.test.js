const chai = require("chai");
const assert = chai.assert;
const fs = require("fs");
const path = require("path");

const Crypto = require("../src");
const utils = require("@secrez/utils");
// const bs58 = Crypto.bs58

const { box, secretbox } = require("tweetnacl");

const {
  password,
  b58Hash,
  b32Hash,
  passwordSHA3Hex,
  passwordB64,
  salt,
  iterations,
  hash23456iterations,
  passphrase,
  signaturePair,
  samesecret,
} = require("./fixtures");

describe("#Crypto", function () {
  const u = undefined;

  describe("utils", async function () {
    it("should encode a string as base64", async function () {
      let coded = Crypto.toBase64(password);
      assert.equal(coded, passwordB64);
    });

    it("should decode a base64 string", async function () {
      let decoded = Crypto.fromBase64(passwordB64);
      assert.equal(decoded, password);
    });

    it("should verify a string is a base58 one", async function () {
      assert.isTrue(Crypto.isBase58String("arde"));
      assert.isTrue(Crypto.isBase58String("AA99"));
      assert.isFalse(Crypto.isBase58String("ardl"));
      assert.isFalse(Crypto.isBase58String("Idaf"));
      assert.isFalse(Crypto.isBase58String("as0s"));
    });

    it("should verify a string is a base32 one", async function () {
      assert.isTrue(Crypto.isBase32String("arde"));
      assert.isTrue(Crypto.isBase32String("aa99"));
      assert.isFalse(Crypto.isBase32String("ardl"));
      assert.isFalse(Crypto.isBase32String("Idaf"));
      assert.isFalse(Crypto.isBase32String("as0s"));
    });

    it("should SHA3 a string", async function () {
      assert.isTrue(
        utils.secureCompare(
          Crypto.SHA3(password),
          Buffer.from(passwordSHA3Hex, "hex")
        )
      );
    });

    it("should convert from Base58 to array and viceversa", async function () {
      assert.equal(
        Crypto.fromBase58("5Q").toString("utf8"),
        Buffer.from([255])
      );
      assert.equal(Crypto.toBase58([255]), "5Q");
    });

    it("should convert from Base32 to array and viceversa", async function () {
      assert.equal(
        Crypto.fromBase32("89").toString("utf8"),
        Buffer.from([255])
      );
      assert.equal(Crypto.toBase32([255]), "89");
    });

    it("should verify that the random id is random enough", async function () {
      let allIds = {};
      for (let i = 0; i <= 1e5; i++) {
        allIds[Crypto.getRandomId(allIds)] = true;
      }
      for (let i = 0; i < 4; i++) {
        let chars = {};
        for (let j in allIds) {
          let c = j.substring(i, i + 1);
          if (!chars[c]) {
            chars[c] = 0;
          }
          chars[c]++;
        }
        let len = i ? 58 : 49;
        assert.isTrue(Object.keys(chars).length === len);
        let min = 1e5;
        let max = 0;
        for (let k in chars) {
          min = Math.min(chars[k], min);
          max = Math.max(chars[k], max);
        }
        assert.isTrue(max / min < 1.2);
      }
    });

    it("should generate key", async function () {
      const newKey = Crypto.generateKey();
      assert.equal(Crypto.bs64.decode(newKey).length, 32);
    });

    it("should convert a decimal to an uint8array", async function () {
      let ts = (1576126788489).toString(16);
      let expected = [1, 110, 248, 122, 51, 137];
      let result = Crypto.hexToUint8Array(ts);
      assert.isTrue(Crypto.isUint8Array(result));
      for (let i = 0; i < result.length; i++) {
        assert.equal(result[i], expected[i]);
      }
    });

    it("should convert a uint8Array to a decimal", async function () {
      let uint8 = Uint8Array.from([1, 110, 248, 122, 51, 137]);
      let hexTs = Crypto.uint8ArrayToHex(uint8);
      let expected = 1576126788489;
      assert.equal(expected, parseInt(hexTs, 16));
    });

    it("should generate a new nonce", async function () {
      const nonce = Crypto.newTimeBasedNonce(secretbox.nonceLength);
      assert.equal(nonce.length, secretbox.nonceLength);
    });

    it("should retrieve the timestamp in a nonce", async function () {
      let ts = Date.now();
      const nonce = Crypto.newTimeBasedNonce(secretbox.nonceLength, ts);
      assert.equal(ts, Crypto.getTimestampFromNonce(nonce));
    });

    it("should derive a password and obtain a predeterminded hash", async function () {
      let derivedPassword = await Crypto.deriveKey(password, salt, iterations);
      assert.equal(Crypto.b64Hash(derivedPassword), hash23456iterations);
    });

    it("should generate a random string", async function () {
      let randomString = await Crypto.getRandomString();
      assert.equal(randomString.length, 24);

      randomString = await Crypto.getRandomString(4);
      assert.equal(randomString.length, 8);

      randomString = await Crypto.getRandomString(12, "base64");
      assert.isTrue(randomString.length > 8 && randomString.length < 18);
    });

    it("should get a random base58 string", async function () {
      let rnd = Crypto.getRandomBase58String(3);
      assert.equal(rnd.length, 3);
      assert.isTrue(Crypto.base58Alphabet.indexOf(rnd[1]) !== -1);
    });

    it("should get a random base32 string", async function () {
      let rnd = Crypto.getRandomBase32String(3);
      assert.equal(rnd.length, 3);
      assert.isTrue(Crypto.zBase32Alphabet.indexOf(rnd[1]) !== -1);
    });

    it("should generate a sha3 in b58 format", async function () {
      assert.equal(Crypto.b58Hash(password), b58Hash);
      assert.equal(Crypto.b58Hash(password, 10), b58Hash.substring(0, 10));
      assert.isTrue(Crypto.isValidB58Hash(b58Hash));
    });

    it("should generate a sha3 in b32 format", async function () {
      this.timeout(20000);
      assert.equal(Crypto.b32Hash(password), b32Hash);
      assert.equal(Crypto.b32Hash(password, 10), b32Hash.substring(0, 10));
      assert.isTrue(Crypto.isValidB32Hash(b32Hash));
    });

    it("should convert a buffer to a Uint8Array", async function () {
      let buf = Buffer.from("Hi");
      let arr = Crypto.bufferToUint8Array(buf);
      assert.equal(arr[0], 72);
      assert.equal(arr[1], 105);
    });
  });

  describe("#encrypt/decrypt version 1", async function () {
    it("should encrypt and decrypt a string", async function () {
      const key = Crypto.generateKey();
      let encrypted = Crypto.encrypt(samesecret, key);
      let decrypted = Crypto.decrypt(encrypted, key);
      assert.equal(samesecret, decrypted);

      encrypted = Crypto.encrypt(samesecret, key, u, u, true);
      decrypted = Crypto.decrypt(encrypted, key);
      assert.equal(samesecret, decrypted);
    });

    it("should get the nonce of an encrypted string", async function () {
      const key = Crypto.generateKey();
      let [nonce, encrypted] = Crypto.encrypt(samesecret, key, u, true);
      assert.equal(nonce.length, 24);
      let recoveredNonce = Crypto.getNonceFromMessage(encrypted);
      for (let i = 0; i < nonce.length; i++) {
        assert.equal(nonce[i], recoveredNonce[i]);
      }
    });

    it("should encrypt and decrypt a binary file", async function () {
      const key = Crypto.generateKey();
      let buf = fs.readFileSync(
        path.resolve(__dirname, "fixtures/favicon.ico")
      );
      let encrypted = Crypto.encrypt(buf, key);
      let decrypted = Crypto.decrypt(encrypted, key, true);
      assert.equal(buf.toString(), Buffer.from(decrypted).toString());
    });

    it("should throw if the encrypted data is wrong", async function () {
      const key = Crypto.generateKey();
      try {
        let encrypted = Crypto.encrypt(samesecret, key) + "5F";
        Crypto.decrypt(encrypted, key);
        assert.equal(true, "Should throw");
      } catch (e) {
        assert.isTrue(
          e.message === "Could not decrypt message" ||
            e.message === "Unable to parse base64 string."
        );
      }
    });
  });

  describe("encrypt/decrypt using sharedSecret", function () {
    let pairA = Crypto.generateBoxKeyPair();
    let pairB = Crypto.generateBoxKeyPair();

    assert.isTrue(Crypto.isValidPublicKey(pairA.publicKey));

    assert.isFalse(Crypto.isValidPublicKey());
    assert.isFalse(Crypto.isValidSecretKey("something"));

    let sharedA = Crypto.getSharedSecret(pairB.publicKey, pairA.secretKey);
    let sharedB = Crypto.getSharedSecret(pairA.publicKey, pairB.secretKey);

    it("should encrypt and decrypt using keys combination", async function () {
      const msg = "Some message";
      const [nonce, encrypted] = Crypto.boxEncrypt(sharedA, msg, u, u, true);
      const decrypted = Crypto.boxDecrypt(sharedB, encrypted);
      assert.equal(msg, decrypted);
      assert.equal(nonce.length, box.nonceLength);
    });

    it("should encrypt and decrypt using keys combination plus shared key", async function () {
      const key = Crypto.generateKey(true);
      const msg = "Some message";
      const encrypted = Crypto.boxEncrypt(sharedA, msg, key);
      const decrypted = Crypto.boxDecrypt(sharedB, encrypted, key);
      assert.equal(msg, decrypted);
    });

    it("should encrypt and decrypt using hex keys", async function () {
      const pairA = Crypto.generateBoxKeyPair(true);
      const pairB = Crypto.generateBoxKeyPair(true);
      const msg = "Some message";
      const encrypted = Crypto.boxEncrypt(
        pairA.secretKey,
        msg,
        pairB.publicKey
      );
      const decrypted = Crypto.boxDecrypt(
        pairB.secretKey,
        encrypted,
        pairA.publicKey
      );
      assert.equal(msg, decrypted);
    });

    it("should decrypt box messages passed as Uint8Array", function () {
      const msg = "Some message";
      const encrypted = Crypto.boxEncrypt(sharedA, msg);
      const decrypted = Crypto.boxDecrypt(
        sharedB,
        Crypto.bs64.decode(encrypted)
      );
      assert.equal(msg, decrypted);
    });

    it("should throw if the encrypted data is wrong", async function () {
      const key = Crypto.generateKey(true);
      const msg = "Some message";
      try {
        let encrypted = Crypto.boxEncrypt(sharedA, msg, key) + "5F";
        Crypto.boxDecrypt(sharedB, encrypted, key);
        assert.equal(true, "Should throw");
      } catch (e) {
        assert.isTrue(
          e.message === "Could not decrypt message" ||
            e.message === "Unable to parse base64 string."
        );
      }
    });
  });

  describe("sign a message with a secretKey", function () {
    let pair = Crypto.generateSignatureKeyPair();
    assert.isTrue(Crypto.isValidPublicKey(pair.publicKey));

    it("should sign a string", async function () {
      const msg = "Some message";
      const signature = Crypto.getSignature(msg, pair.secretKey);
      const verified = Crypto.verifySignature(msg, signature, pair.publicKey);
      assert.isTrue(verified);
    });

    it("should derive a valid seed from a passphrase", async function () {
      const warnings = [];
      const originalEmitWarning = process.emitWarning;
      process.emitWarning = function (warning, type, code, ctor) {
        warnings.push({ warning, type, code });
        return originalEmitWarning.call(this, warning, type, code, ctor);
      };
      try {
        let seed = Crypto.seedFromPassphrase(passphrase);
        assert.isTrue(Crypto.isUint8Array(seed));
        assert.equal(seed.length, 32);
        assert.isAtLeast(warnings.length, 1);
        assert.match(String(warnings[0].warning), /seedFromPassphrase/i);

        try {
          Crypto.seedFromPassphrase(234);
        } catch (e) {
          assert.equal(e.message, "Not a valid string");
        }

        try {
          Crypto.seedFromPassphrase("");
        } catch (e) {
          assert.equal(e.message, "Not a valid string");
        }
      } finally {
        process.emitWarning = originalEmitWarning;
      }
    });

    it("should generate an ed25519 key pair from a seed", async function () {
      let seed = Crypto.seedFromPassphrase(passphrase);
      let pair = Crypto.generateSignatureKeyPair(seed);
      assert.isTrue(Crypto.isValidPublicKey(pair.publicKey));
      assert.isTrue(Crypto.isValidSecretKey(pair.secretKey));
      assert.equal(pair.publicKey.join(","), signaturePair.publicKey.join(","));
      assert.equal(pair.secretKey.join(","), signaturePair.secretKey.join(","));
    });
  });

  describe("#fromTsToDate", async function () {
    it("should recover a date from a timestamp with microseconds", async function () {
      for (let i = 0; i < 20; i++) {
        let ts = Crypto.getTimestampWithMicroseconds().join(".");
        let d = new Date().toISOString().substring(0, 18);
        assert.isTrue(RegExp("^" + d).test(Crypto.fromTsToDate(ts)[0]));
        utils.sleep(1);
      }
    });
  });

  describe.skip("performance comparision between V1 and V2", async function () {
    it("should compare encryption V1 and V2", async function () {
      this.timeout(10000);
      let key = Crypto.generateKey(u, "bs58");
      let str = samesecret.repeat(500);
      let now = Date.now();
      Crypto.encrypt(str, key, u, u, u, "bs58");
      console.debug("Milliseconds w/ V1:", Date.now() - now);
      now = Date.now();
      key = Crypto.generateKey();
      Crypto.encrypt(str, key);
      console.debug("Milliseconds w/ V2:", Date.now() - now);
    });

    it("should compare urlSafeBase64 encoding with base68 encoding", async function () {
      this.timeout(10000);
      let key = Crypto.generateKey(true);
      let now = Date.now();
      for (let i = 0; i < 10000; i++) {
        let encoded = Crypto.bs58.encode(key);
        Crypto.bs58.decode(encoded);
      }
      console.debug("Milliseconds w/ V1:", Date.now() - now);
      now = Date.now();
      for (let i = 0; i < 10000; i++) {
        let encoded = Crypto.fromBase64ToFsSafeBase64(Crypto.bs64.encode(key));
        Crypto.bs64.decode(Crypto.fromFsSafeBase64ToBase64(encoded));
      }
      console.debug("Milliseconds w/ V2:", Date.now() - now);
    });
  });

  describe("#sign and verify", async function () {
    it("should sign a message and verify it", async function () {
      const boxPair = Crypto.generateBoxKeyPair();
      const signPair = Crypto.generateSignatureKeyPair();

      let publicKey =
        Crypto.bs64.encode(boxPair.publicKey) +
        "$" +
        Crypto.bs64.encode(signPair.publicKey);

      assert.isTrue(Crypto.isValidSecrezPublicKey(publicKey));
      assert.isFalse(Crypto.isValidSecrezPublicKey([1, 2, 3, 4]));

      let signPublicKey = Crypto.getSignPublicKeyFromSecretPublicKey(publicKey);
      let boxPublicKey = Crypto.getBoxPublicKeyFromSecretPublicKey(publicKey);

      publicKey = publicKey.split("$").map((e) => Crypto.bs64.decode(e));
      assert.equal(publicKey[0].toString(), boxPublicKey.toString());
      assert.equal(publicKey[1].toString(), signPublicKey.toString());
    });
  });

  describe("#url safe base64", async function () {
    it("should sign a message and verify it", async function () {
      const base64a =
        "3Dvn7iEz2lEEeSgZox9PLbd697bovifl3ZltPjStsujjm+spVbJVYhcXHhBLMno1EjaNDn0qgFAIE0cp67GKBg==";
      const base64b = "QjjnUGOYDp2GymZkaSalRNjtXmdc0MuICWtzYHfISls=";
      const base64c =
        "zrh9UtViJj/w9llqfQEN94tvK/9w6mMC8NDyQqN260bCwmecp7WOUwoBdGOwYdFMTqB9mbTzZUvpWGlln/pIPmh5wDkvifDi";

      const usbase64a = Crypto.fromBase64ToFsSafeBase64(base64a);
      const usbase64b = Crypto.fromBase64ToFsSafeBase64(base64b);
      const usbase64c = Crypto.fromBase64ToFsSafeBase64(base64c);

      assert.equal(
        Crypto.fromFsSafeBase64ToBase64(usbase64a).toString(),
        base64a.toString()
      );
      assert.equal(
        Crypto.fromFsSafeBase64ToBase64(usbase64b).toString(),
        base64b.toString()
      );
      assert.equal(
        Crypto.fromFsSafeBase64ToBase64(usbase64c).toString(),
        base64c.toString()
      );
    });

    it("should roundtrip URL-safe base64 for many payload lengths", function () {
      for (let len = 1; len <= 256; len++) {
        const base64 = Buffer.alloc(len, len % 256).toString("base64");
        const safe = Crypto.fromBase64ToFsSafeBase64(base64);
        assert.equal(Crypto.fromFsSafeBase64ToBase64(safe), base64);
        assert.deepEqual(
          Crypto.bs64.decode(Crypto.fromFsSafeBase64ToBase64(safe)),
          Crypto.bs64.decode(base64)
        );
      }
    });
  });
});
