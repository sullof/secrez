const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;
const { yamlParse } = require("@secrez/utils");

const fs = require("fs-extra");
const path = require("path");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const { assertConsole, noPrint, decolorize } = require("@secrez/test-helpers");

const { password, iterations } = require("../fixtures");

describe("#Touch", function () {
  let prompt;
  let rootDir = path.resolve(__dirname, "../../tmp/test/.secrez");
  let inspect, C;

  let options = {
    container: rootDir,
    localDir: __dirname,
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
    await C.touch.exec({ help: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(/-h, --help/.test(output[6]));
  });

  it("should create a file", async function () {
    await noPrint(
      C.touch.exec({
        path: "/folder2/file1",
      })
    );

    assert.equal(
      prompt.internalFs.tree.root.getChildFromPath("/folder2/file1").type,
      prompt.secrez.config.types.TEXT
    );

    inspect = stdout.inspect();
    await C.touch.exec({
      path: "/folder2/file1",
    });
    inspect.restore();
    assertConsole(inspect, ['An entry with the name "file1" already exists']);

    await noPrint(
      C.touch.exec({
        path: "/folder2/file1",
        versionIfExists: true,
      })
    );

    let names = [];
    let children =
      prompt.internalFs.tree.root.getChildFromPath("/folder2").children;
    for (let id in children) {
      names.push(children[id].getPath());
    }

    assert.equal(names[0], "/folder2/file1");
    assert.equal(names[1], "/folder2/file1.2");
  });

  it("should create a file with content", async function () {
    let p = "/folder2/file1";
    let content = "Password: eh3h447d743yh4r";
    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    assert.equal(
      prompt.internalFs.tree.root.getChildFromPath(p).getContent(),
      content
    );
  });

  it("should duplicate a file", async function () {
    let p = "/folder2/file1";
    let content = "Password: eh3h447d743yh4r";
    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    assert.equal(
      prompt.internalFs.tree.root.getChildFromPath(p).getContent(),
      content
    );

    await noPrint(
      C.touch.exec({
        path: "/folder2/file2",
        from: p,
      })
    );
    assert.equal(
      prompt.internalFs.tree.root
        .getChildFromPath("/folder2/file2")
        .getContent(),
      content
    );
  });

  it("should throw if trying to duplicate a non existing file", async function () {
    inspect = stdout.inspect();

    await C.touch.exec({
      path: "/folder2/file2",
      from: "/folder2/file1",
    });
    inspect.restore();
    assertConsole(inspect, 'File "/folder2/file1" not found.');
  });

  it("should throw if trying to duplicate a folder", async function () {
    await noPrint(
      C.mkdir.mkdir({
        path: "/folder2/folder3",
      })
    );

    inspect = stdout.inspect();

    await C.touch.exec({
      path: "/folder2/file2",
      from: "/folder2/folder3",
    });
    inspect.restore();
    assertConsole(inspect, '"/folder2/folder3" is not a file.');
  });

  it("should throw if trying to create a child of a file", async function () {
    await noPrint(
      C.touch.exec({
        path: "/folder/file1",
      })
    );

    inspect = stdout.inspect();
    await C.touch.exec({
      path: "/folder/file1/file2",
    });
    inspect.restore();
    assertConsole(inspect, "The entry does not represent a folder");
  });

  it("should throw if wrong parameters", async function () {
    inspect = stdout.inspect();
    await C.touch.exec({});
    inspect.restore();
    assertConsole(inspect, "A valid path is required");

    inspect = stdout.inspect();
    await C.touch.exec({
      path: {},
    });
    inspect.restore();
    assertConsole(inspect, "A valid path is required");

    await noPrint(
      C.touch.exec({
        path: "/file",
      })
    );

    inspect = stdout.inspect();
    await C.touch.exec({
      path: "/file",
    });
    inspect.restore();
    assertConsole(inspect, 'An entry with the name "file" already exists');

    inspect = stdout.inspect();
    await C.touch.exec({
      path: "/fil|<e",
    });
    inspect.restore();
    assertConsole(inspect, "A filename cannot contain \\/><|:&?*^$ chars.");
  });

  it("should create a file and generate a wallet", async function () {
    let p = "/folder2/file1";
    inspect = stdout.inspect();
    await C.touch.exec({
      path: p,
      generateWallet: true,
    });
    inspect.restore();
    assertConsole(inspect, 'New file "/folder2/file1" created.');
    const content = yamlParse(
      prompt.internalFs.tree.root.getChildFromPath(p).getContent()
    );
    assert.isTrue(content.hasOwnProperty("private_key"));
    assert.isTrue(content.hasOwnProperty("address"));
    assert.isTrue(/^0x[0-9a-fA-F]{40}$/.test(content.address));
  });

  it("should generate 5 prefixed wallet", async function () {
    let p = "/folder2/file1";
    inspect = stdout.inspect();
    await C.touch.exec({
      path: p,
      generateWallet: true,
      amount: 5,
      prefix: "test",
    });
    inspect.restore();
    assertConsole(inspect, 'New file "/folder2/file1" created.');
    const content = yamlParse(
      prompt.internalFs.tree.root.getChildFromPath(p).getContent()
    );
    for (let i = 1; i <= 5; i++) {
      let k = i === 1 ? "" : i;
      assert.isTrue(content.hasOwnProperty(`test_private_key${k}`));
      assert.isTrue(content.hasOwnProperty(`test_address${k}`));
      assert.isTrue(/^0x[0-9a-fA-F]{40}$/.test(content[`test_address${k}`]));
    }
  });

  it("should generate a wallet with mnemonic and 2 keys", async function () {
    let p = "/folder2/file1";
    inspect = stdout.inspect();
    await C.touch.exec({
      path: p,
      generateWallet: true,
      includeMnemonic: true,
      amount: 2,
    });
    inspect.restore();
    assertConsole(inspect, 'New file "/folder2/file1" created.');
    const content = yamlParse(
      prompt.internalFs.tree.root.getChildFromPath(p).getContent()
    );
    assert.isTrue(content.hasOwnProperty("private_key"));
    assert.isTrue(content.hasOwnProperty("address2"));
    assert.isTrue(content.mnemonic.split(" ").length === 12);
    assert.equal(content.derived_path, "m/44'/60'/0'/0");
  });
});
