const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;

const fs = require("fs-extra");
const path = require("path");
const utils = require("@secrez/utils");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const { assertConsole, noPrint, decolorize } = require("@secrez/test-helpers");

const { password, iterations } = require("../fixtures");

describe("#Ssh", function () {
  let prompt;
  let rootDir = path.resolve(__dirname, "../../tmp/test/.secrez");
  let inspect;
  let C;
  let execAsyncCalls;
  let originalExecAsync;

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

    execAsyncCalls = [];
    originalExecAsync = utils.execAsync;
    utils.execAsync = async (cmd, cwd, params) => {
      execAsyncCalls.push({ cmd, cwd, params });
      if (cmd === "which") {
        return { message: "/usr/local/bin/ttab", code: 0 };
      }
      if (cmd === "chmod" || cmd === "ttab") {
        return { code: 0 };
      }
      return originalExecAsync(cmd, cwd, params);
    };
  });

  afterEach(function () {
    utils.execAsync = originalExecAsync;
  });

  it("should return the help", async function () {
    inspect = stdout.inspect();
    await C.ssh.exec({ help: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(output.some((line) => /-h, --help/.test(line)));
  });

  it("should reject shell metacharacters in the remote host", async function () {
    try {
      await C.ssh.ssh({
        remoteHost: "example.com; rm -rf ~",
        identity: "/key",
      });
      assert.fail("expected validation error");
    } catch (e) {
      assert.match(e.message, /Invalid remote host/);
    }
  });

  it("should reject shell metacharacters in the user", async function () {
    try {
      await C.ssh.ssh({
        remoteHost: "example.com",
        user: "root; evil",
        identity: "/key",
      });
      assert.fail("expected validation error");
    } catch (e) {
      assert.match(e.message, /Invalid SSH user/);
    }
  });

  it("should pass ssh arguments without shell interpolation", async function () {
    await noPrint(
      C.touch.exec({
        path: "/.ssh/id_test",
        content:
          "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----\n",
      })
    );

    await C.ssh.ssh({
      remoteHost: "example.com",
      user: "joe",
      identity: "/.ssh/id_test",
      ignoreHostKeyCheck: true,
    });

    const ttabCall = execAsyncCalls.find((call) => call.cmd === "ttab");
    assert.isOk(ttabCall);
    assert.deepEqual(ttabCall.params.slice(0, 4), [
      "ssh",
      "-oStrictHostKeyChecking=no",
      "-i",
      ttabCall.params[3],
    ]);
    assert.equal(ttabCall.params[4], "joe@example.com");
    assert.match(ttabCall.params[3], /\/\.ssh\/id_/);
  });
});
