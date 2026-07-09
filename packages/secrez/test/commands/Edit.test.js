const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;

const fs = require("fs-extra");
const path = require("path");
const { yamlParse } = require("@secrez/utils");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const { assertConsole, decolorize } = require("@secrez/test-helpers");

const { password, iterations } = require("../fixtures");

describe("#Edit", function () {
  let prompt;
  let rootDir = path.resolve(__dirname, "../../tmp/test/.secrez");
  let inspect;
  let C;

  let options = {
    container: rootDir,
    localDir: path.resolve(__dirname, "../fixtures/files"),
  };

  function mockEditor(result) {
    prompt.editorProvider =
      typeof result === "function" ? result : async () => result;
  }

  beforeEach(async function () {
    await fs.emptyDir(path.resolve(__dirname, "../../tmp/test"));
    prompt = new MainPrompt();
    await prompt.init(options);
    C = prompt.commands;
    await prompt.secrez.signup(password, iterations);
    await prompt.internalFs.init();
    prompt.editorProvider = null;
  });

  afterEach(function () {
    prompt.editorProvider = null;
  });

  it("should return the help", async function () {
    inspect = stdout.inspect();
    await C.edit.exec({ help: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(output.some((line) => /-h, --help/.test(line)));
    assert.isTrue(output.some((line) => /in-memory editor/.test(line)));
    assert.isTrue(output.some((line) => /Ctrl-d to save/.test(line)));
  });

  it("should save edited content for a new file", async function () {
    mockEditor("new secret\n");

    inspect = stdout.inspect();
    await C.edit.edit({ path: "/folder2/new-secret" });
    inspect.restore();
    assertConsole(inspect, "File saved.");

    let content = (
      await C.cat.cat({ path: "/folder2/new-secret", unformatted: true })
    )[0].content;
    assert.equal(content, "new secret\n");
  });

  it("should update an existing file", async function () {
    await C.touch.touch({
      path: "/folder2/to-edit",
      content: "old value",
    });

    let before = (
      await C.cat.cat({ path: "/folder2/to-edit", unformatted: true })
    )[0].content;
    assert.equal(before, "old value");

    mockEditor("updated value");
    await C.edit.edit({ path: "/folder2/to-edit" });

    let content = (
      await C.cat.cat({ path: "/folder2/to-edit", unformatted: true })
    )[0].content;
    assert.equal(content, "updated value");
  });

  it("should edit a single yaml field", async function () {
    await C.touch.touch({
      path: "/cards/site.yml",
      content: "email: old@example.com\npassword: secret\n",
    });

    mockEditor("new@example.com");
    await C.edit.edit({ path: "/cards/site.yml", field: "email" });

    let fields = yamlParse(
      (await C.cat.cat({ path: "/cards/site.yml", unformatted: true }))[0]
        .content
    );
    assert.equal(fields.email, "new@example.com");
    assert.equal(fields.password, "secret");
  });

  it("should report no changes when the editor is aborted", async function () {
    await C.touch.touch({
      path: "/folder2/abort-edit",
      content: "same",
    });

    mockEditor(undefined);

    inspect = stdout.inspect();
    await C.edit.edit({ path: "/folder2/abort-edit" });
    inspect.restore();
    assertConsole(inspect, "Changes aborted or file not changed");

    let content = (
      await C.cat.cat({ path: "/folder2/abort-edit", unformatted: true })
    )[0].content;
    assert.equal(content, "same");
  });
});
