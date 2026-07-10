const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;
const fs = require("fs-extra");
const path = require("path");
const { ConfigUtils } = require("@secrez/core");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const { assertConsole, decolorize } = require("@secrez/test-helpers");

const { password, iterations } = require("../fixtures");

describe("#Conf", function () {
  let prompt;
  let testDir = path.resolve(__dirname, "../../tmp/test");
  let rootDir = path.resolve(testDir, ".secrez");
  let inspect;
  let C;

  let options = {
    container: rootDir,
    localDir: path.resolve(__dirname, "../fixtures/files"),
  };

  beforeEach(async function () {
    await fs.emptyDir(testDir);
    prompt = new MainPrompt();
    await prompt.init(options);
    C = prompt.commands;
    await prompt.secrez.signup(password, iterations);
    await prompt.internalFs.init();
  });

  it("should return the help", async function () {
    inspect = stdout.inspect();
    await C.conf.exec({ help: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(/-h, --help/.test(output[4]));
  });

  it("should show configuration with -s", async function () {
    inspect = stdout.inspect();
    await C.conf.exec({ show: true });
    inspect.restore();
    assertConsole(inspect, ["Container:", "Number of iterations"], true);
  });

  it("should fail without parameters", async function () {
    inspect = stdout.inspect();
    await C.conf.exec({});
    inspect.restore();
    assertConsole(inspect, "Missing parameters", true);
  });

  it("should reject changing password and iterations together", async function () {
    C.conf.checkGitConflictsBeforeOperation = async () => true;
    inspect = stdout.inspect();
    await C.conf.exec({ newPassword: true, newIterationsNumber: true });
    inspect.restore();
    assertConsole(inspect, "not allowed", true);
  });

  it("should change the number of iterations when confirmed", async function () {
    C.conf.checkGitConflictsBeforeOperation = async () => true;
    C.conf.useConfirm = async () => true;
    C.conf.useInput = async (opts) => {
      if (opts.message.includes("new number")) {
        return "50000";
      }
    };
    await prompt.secrez.saveIterations(iterations);

    inspect = stdout.inspect();
    await C.conf.exec({ newIterationsNumber: true });
    inspect.restore();
    assertConsole(inspect, "successfully changed", true);

    const env = await ConfigUtils.getEnv(prompt.secrez.config);
    assert.equal(env.iterations, 50000);
  });

  it("should cancel upgrade when not confirmed", async function () {
    C.conf.checkGitConflictsBeforeOperation = async () => true;
    C.conf.useConfirm = async () => false;
    inspect = stdout.inspect();
    await C.conf.exec({ newIterationsNumber: true });
    inspect.restore();
    assertConsole(inspect, "Operation canceled");
  });

  it("should change the password when confirmed", async function () {
    const newPassword = "newPassword123!";
    C.conf.checkGitConflictsBeforeOperation = async () => true;
    C.conf.useConfirm = async () => true;
    C.conf.useInput = async (opts) => {
      if (opts.message.includes("existing")) {
        return password;
      }
      if (opts.message === "Type your new password") {
        return newPassword;
      }
      if (opts.validate) {
        return newPassword;
      }
    };

    inspect = stdout.inspect();
    await C.conf.exec({ newPassword: true });
    inspect.restore();
    assertConsole(inspect, "new password", true);

    await prompt.secrez.signout();
    await prompt.secrez.signin(newPassword, iterations);
    assert.isOk(prompt.secrez.getPublicKey());
  });

  it("should reject a wrong existing password", async function () {
    C.conf.checkGitConflictsBeforeOperation = async () => true;
    C.conf.useConfirm = async () => true;
    C.conf.useInput = async (opts) => {
      if (opts.message.includes("existing")) {
        return "wrong-password";
      }
    };
    inspect = stdout.inspect();
    await C.conf.exec({ newPassword: true });
    inspect.restore();
    assertConsole(inspect, "Wrong password", true);
  });

  it("should stop when git conflicts block the operation", async function () {
    C.conf.checkGitConflictsBeforeOperation = async () => false;
    inspect = stdout.inspect();
    await C.conf.exec({ newPassword: true });
    inspect.restore();
    assert.isFalse(
      inspect.output.some((line) => line.includes("Wrong password"))
    );
    assert.isFalse(
      inspect.output.some((line) => line.includes("new password"))
    );
  });
});
