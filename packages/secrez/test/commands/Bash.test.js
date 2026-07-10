const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;
const fs = require("fs-extra");
const path = require("path");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const { assertConsole } = require("@secrez/test-helpers");

const { password, iterations } = require("../fixtures");

describe("#Bash", function () {
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
  });

  it("should warn that bash is deprecated", async function () {
    inspect = stdout.inspect();
    await C.bash.exec({});
    inspect.restore();
    assertConsole(inspect, '"bash" is deprecated. Use "shell" instead');
  });
});
