const path = require("path");
const fs = require("fs-extra");

const VAULT_DIR_MODE = 0o700;
const VAULT_FILE_MODE = 0o600;

class VaultPermissions {
  static get dirMode() {
    return VAULT_DIR_MODE;
  }

  static get fileMode() {
    return VAULT_FILE_MODE;
  }

  static isSecureDir(mode) {
    return (mode & 0o777) === VAULT_DIR_MODE;
  }

  static isSecureFile(mode) {
    return (mode & 0o777) === VAULT_FILE_MODE;
  }

  static async ensureDir(dirPath) {
    await fs.ensureDir(dirPath, { mode: VAULT_DIR_MODE });
    await fs.chmod(dirPath, VAULT_DIR_MODE);
  }

  static ensureDirSync(dirPath) {
    fs.ensureDirSync(dirPath, { mode: VAULT_DIR_MODE });
    fs.chmodSync(dirPath, VAULT_DIR_MODE);
  }

  static async writeFile(filePath, content, options = {}) {
    await fs.writeFile(filePath, content, {
      ...options,
      mode: VAULT_FILE_MODE,
    });
    await fs.chmod(filePath, VAULT_FILE_MODE);
  }

  /**
   * Probe a representative path to guess whether the vault already uses
   * restrictive permissions. Prefer keys/default.json, else keys/, else container.
   */
  static async probe(config) {
    let probePath = config.container;
    let expectDir = true;

    if (await fs.pathExists(config.keysPath)) {
      probePath = config.keysPath;
      expectDir = false;
    } else if (await fs.pathExists(config.keysDataPath)) {
      probePath = config.keysDataPath;
      expectDir = true;
    }

    const probeStat = await fs.stat(probePath);
    const probeSecure = expectDir
      ? VaultPermissions.isSecureDir(probeStat.mode)
      : VaultPermissions.isSecureFile(probeStat.mode);

    const containerStat = await fs.stat(config.container);
    const containerSecure = VaultPermissions.isSecureDir(containerStat.mode);

    return {
      secure: probeSecure && containerSecure,
      probePath,
    };
  }

  static async chmodTree(rootPath) {
    const stat = await fs.lstat(rootPath);
    if (stat.isDirectory()) {
      await fs.chmod(rootPath, VAULT_DIR_MODE);
      for (const name of await fs.readdir(rootPath)) {
        await VaultPermissions.chmodTree(path.join(rootPath, name));
      }
    } else if (stat.isFile()) {
      await fs.chmod(rootPath, VAULT_FILE_MODE);
    }
  }

  static async secureVault(config) {
    await VaultPermissions.chmodTree(config.container);
    const ConfigUtils = require("./ConfigUtils");
    const env = await ConfigUtils.getEnv(config);
    env.vaultSecured = true;
    await ConfigUtils.putEnv(config, env);
  }

  /**
   * Apply restrictive permissions on legacy vaults at login. Skips when probe
   * shows the vault is already locked down.
   */
  static async secureVaultIfNeeded(config) {
    const ConfigUtils = require("./ConfigUtils");
    const env = await ConfigUtils.getEnv(config);
    const { secure } = await VaultPermissions.probe(config);

    if (secure) {
      if (!env.vaultSecured) {
        env.vaultSecured = true;
        await ConfigUtils.putEnv(config, env);
      }
      return false;
    }

    await VaultPermissions.secureVault(config);
    return true;
  }
}

module.exports = VaultPermissions;
