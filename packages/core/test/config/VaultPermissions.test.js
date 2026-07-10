const chai = require("chai");
const assert = chai.assert;
const fs = require("fs-extra");
const path = require("path");

const ConfigUtils = require("../../src/config/ConfigUtils");
const VaultPermissions = require("../../src/config/VaultPermissions");
const Secrez = require("../../src/Secrez")();

const { password, iterations } = require("../fixtures");

describe("#VaultPermissions", function () {
  let rootDir = path.resolve(__dirname, "../tmp/vault-perms/.secrez");
  let config;

  beforeEach(async function () {
    await fs.emptyDir(path.dirname(rootDir));
    config = require("../../src/config");
    config = await ConfigUtils.setSecrez(config, rootDir);
  });

  it("should create directories with mode 0o700", async function () {
    const mode = (await fs.stat(config.keysDataPath)).mode & 0o777;
    assert.equal(mode, VaultPermissions.dirMode);
  });

  it("should chmod directories synchronously", function () {
    const dir = path.join(rootDir, "sync-dir");
    VaultPermissions.ensureDirSync(dir);
    assert.equal(fs.statSync(dir).mode & 0o777, VaultPermissions.dirMode);
  });

  it("should probe the keys directory before an account exists", async function () {
    const probe = await VaultPermissions.probe(config);
    assert.isTrue(probe.secure);
    assert.equal(probe.probePath, config.keysDataPath);
  });

  it("should create files with mode 0o600", async function () {
    const mode = (await fs.stat(config.envPath)).mode & 0o777;
    assert.equal(mode, VaultPermissions.fileMode);
  });

  it("should detect secure vault permissions via probe", async function () {
    const secrez = new Secrez();
    await secrez.init(rootDir);
    await secrez.signup(password, iterations);

    const probe = await VaultPermissions.probe(secrez.config);
    assert.isTrue(probe.secure);
    assert.equal(probe.probePath, secrez.config.keysPath);
  });

  it("should secure legacy permissions on login", async function () {
    const secrez = new Secrez();
    await secrez.init(rootDir);
    await secrez.signup(password, iterations);

    await fs.chmod(rootDir, 0o755);
    await fs.chmod(config.keysDataPath, 0o755);
    await fs.chmod(secrez.config.keysPath, 0o644);

    assert.isFalse((await VaultPermissions.probe(secrez.config)).secure);

    assert.isTrue(await VaultPermissions.secureVaultIfNeeded(secrez.config));

    assert.isTrue((await VaultPermissions.probe(secrez.config)).secure);
    const env = await ConfigUtils.getEnv(secrez.config);
    assert.isTrue(env.vaultSecured);
    assert.equal(
      (await fs.stat(secrez.config.keysPath)).mode & 0o777,
      VaultPermissions.fileMode
    );
  });

  it("should skip securing when probe is already secure", async function () {
    const secrez = new Secrez();
    await secrez.init(rootDir);
    await secrez.signup(password, iterations);

    assert.isFalse(await VaultPermissions.secureVaultIfNeeded(secrez.config));
    const env = await ConfigUtils.getEnv(secrez.config);
    assert.isTrue(env.vaultSecured);
  });
});
