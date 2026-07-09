const Crypto = require("@secrez/crypto");

function getV1PasswordKey(password) {
  return Crypto.bufferToUint8Array(Crypto.SHA3(password));
}

function encryptWithPassword(content, password) {
  const key = Crypto.generateKey();
  return [
    "1",
    Crypto.encrypt(content, key),
    Crypto.encrypt(key, getV1PasswordKey(password)),
  ];
}

function decryptWithPassword(
  content,
  encryptedKey,
  password,
  returnUint8Array
) {
  const key = Crypto.decrypt(encryptedKey, getV1PasswordKey(password));
  return Crypto.decrypt(content, key, returnUint8Array);
}

module.exports = {
  VERSION: "1",
  getV1PasswordKey,
  encryptWithPassword,
  decryptWithPassword,
};
