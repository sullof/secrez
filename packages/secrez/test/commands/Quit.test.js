const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;
const fs = require("fs-extra");
const path = require("path");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const { assertConsole } = require("@secrez/test-helpers");

const { password, iterations } = require("../fixtures");

describe("#Quit", function () {
  let prompt;
  let rootDir = path.resolve(__dirname, "../../tmp/test/.secrez");
  let inspect, C;

  let options = {
    container: rootDir,
    localDir: path.resolve(__dirname, "../fixtures/files"),
  };

  beforeEach(async function () {
    await fs.emptyDir(path.resolve(__dirname, "../../tmp/test"));
    prompt = new MainPrompt();
    await prompt.init(options);
    C = prompt.commands;
    await prompt.secrez.signup(password, iterations);
    await prompt.internalFs.init();
  });

  it("should show the content of an external file via bash", async function () {
    inspect = stdout.inspect();
    await C.quit.exec({});
    inspect.restore();
    assertConsole(inspect, "Bye bye :o)");
  });

  it("should sign out before quitting", async function () {
    inspect = stdout.inspect();
    await C.quit.exec({});
    inspect.restore();
    assert.isUndefined(prompt.secrez.masterKeyHash);
    assert.throws(() => prompt.secrez.encryptData("x"), /User not logged/);
  });

  it("should save history before signout when quitting outside test mode", async function () {
    const order = [];
    prompt.saveHistory = async () => {
      order.push("saveHistory");
      assert.isDefined(prompt.secrez.masterKeyHash);
    };
    const originalSignout = prompt.secrez.signout.bind(prompt.secrez);
    prompt.secrez.signout = function () {
      order.push("signout");
      return originalSignout();
    };
    const originalEnv = process.env.NODE_ENV;
    const originalExit = process.exit;
    process.env.NODE_ENV = "dev";
    process.exit = () => {
      order.push("exit");
    };
    try {
      inspect = stdout.inspect();
      await C.quit.exec({});
      inspect.restore();
      assert.deepEqual(order, ["saveHistory", "signout", "exit"]);
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.exit = originalExit;
    }
  });
});
