const fs = require("fs-extra");
const FileCipherLegacy = require("../../../fs/src/fileCipherLegacy");

async function writeV1EncryptedFile(filePath, content, password) {
  const parts = FileCipherLegacy.encryptWithPassword(content, password);
  await fs.writeFile(filePath, parts.join(","));
  return parts;
}

module.exports = {
  encryptWithPassword: FileCipherLegacy.encryptWithPassword,
  writeV1EncryptedFile,
};
