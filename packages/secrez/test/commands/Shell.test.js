const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;

const fs = require("fs-extra");
const path = require("path");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const { assertConsole, noPrint, decolorize } = require("@secrez/test-helpers");

const { password, iterations } = require("../fixtures");

describe("#Shell", function () {
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

  it("should return the help", async function () {
    inspect = stdout.inspect();
    await C.shell.exec({ help: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(/-h, --help/.test(output[4]));
  });

  it("should show the content of an external file via shell", async function () {
    await noPrint(C.lcd.exec({ path: "folder1" }));

    let result = await C.shell.shell({ command: "cat file1" });
    assert.equal(result, "Some secret\n");

    inspect = stdout.inspect();
    await C.shell.exec({ command: "cat file1" });
    inspect.restore();
    assertConsole(inspect, "Some secret");
  });

  it("should not interpret shell metacharacters in the working directory path", async function () {
    let trickyDir = path.resolve(
      __dirname,
      "../../tmp/test/tricky; echo INJECTED",
    );
    await fs.ensureDir(trickyDir);
    await fs.writeFile(path.join(trickyDir, "marker"), "safe\n");
    await noPrint(C.lcd.exec({ path: trickyDir }));

    let result = await C.shell.shell({ command: "cat marker" });
    assert.equal(result, "safe\n");
  });
});
