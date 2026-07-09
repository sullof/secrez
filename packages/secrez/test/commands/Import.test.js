const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;

const fs = require("fs-extra");
const path = require("path");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const { fromSimpleYamlToJson } = require("@secrez/utils");
const { assertConsole, noPrint, decolorize } = require("@secrez/test-helpers");
const { execAsync } = require("@secrez/utils");

const { password, iterations } = require("../fixtures");

describe("#Import", function () {
  let prompt;
  let testDir = path.resolve(__dirname, "../../tmp/test");
  let rootDir = path.resolve(testDir, ".secrez");
  let fixtures = path.resolve(__dirname, "../fixtures");
  let inspect, C;

  let options = {
    container: rootDir,
    localDir: path.resolve(fixtures, "files"),
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
    await C.import.exec({ help: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(/-h, --help/.test(output[11]));
  });

  it("should import a file in the current folder", async function () {
    let content = await C.lcat.lcat({
      path: "file0.txt",
    });

    await noPrint(
      C.mkdir.exec({
        path: "/folder",
      })
    );
    await noPrint(
      C.cd.exec({
        path: "/folder",
      })
    );

    inspect = stdout.inspect();
    await C.import.exec({
      path: "file0.txt",
    });
    inspect.restore();
    assertConsole(inspect, ["Imported files:", "/folder/file0.txt"]);

    let newSecret = await C.cat.cat("/folder/file0.txt");
    assert.equal(newSecret[0].type, prompt.secrez.config.types.TEXT);
    assert.equal(newSecret[0].content, content);

    inspect = stdout.inspect();
    await C.import.exec({
      path: "file0.txt",
    });
    inspect.restore();
    assertConsole(inspect, ["Imported files:", "/folder/file0.2.txt"]);

    newSecret = await C.cat.cat({ path: "/folder/file0.2.txt" });
    assert.equal(newSecret[0].type, prompt.secrez.config.types.TEXT);
    assert.equal(newSecret[0].content, content);

    inspect = stdout.inspect();
    await C.import.exec({
      path: "file0.txt",
    });
    inspect.restore();
    assertConsole(inspect, ["Imported files:", "/folder/file0.3.txt"]);
  });

  it("should import an encrypted file", async function () {
    let content = "some content";
    let password = "password";

    await noPrint(
      C.lcd.exec({
        path: testDir,
      })
    );

    await C.touch.touch({
      path: "content.txt",
      content,
    });

    await noPrint(
      C.export.exec({
        path: "content.txt",
        encrypt: true,
        password,
        iterations,
      })
    );

    await noPrint(
      C.rm.exec({
        path: "content.txt",
      })
    );

    inspect = stdout.inspect();
    await C.import.exec({
      path: "content.txt.secrez",
      password,
      iterations,
    });
    inspect.restore();
    assertConsole(inspect, ["Imported files:", "/content.txt"]);

    inspect = stdout.inspect();
    await C.cat.exec({
      path: "/content.txt",
    });
    inspect.restore();
    assertConsole(inspect, [content]);
  });

  it("should import a v1 password-encrypted file", async function () {
    const content = "legacy v1 content";
    const exportPassword = "legacy-password";
    const { writeV1EncryptedFile } = require("@secrez/test-helpers");

    await noPrint(
      C.lcd.exec({
        path: testDir,
      })
    );

    await writeV1EncryptedFile(
      path.join(testDir, "legacy.txt.secrez"),
      content,
      exportPassword
    );

    inspect = stdout.inspect();
    await C.import.exec({
      path: "legacy.txt.secrez",
      password: exportPassword,
    });
    inspect.restore();
    assertConsole(inspect, ["Imported files:", "/legacy.txt"]);

    inspect = stdout.inspect();
    await C.cat.exec({
      path: "/legacy.txt",
    });
    inspect.restore();
    assertConsole(inspect, [content]);
  });

  it("should import an encrypted file encrypted for myself", async function () {
    let content = "some content";

    await noPrint(
      C.lcd.exec({
        path: testDir,
      })
    );

    await C.touch.touch({
      path: "content.txt",
      content,
    });

    await noPrint(
      C.export.exec({
        path: "content.txt",
        encrypt: true,
        includeMe: true,
      })
    );

    await noPrint(
      C.rm.exec({
        path: "content.txt",
      })
    );

    inspect = stdout.inspect();
    await C.import.exec({
      path: "content.txt.secrez",
    });
    inspect.restore();
    assertConsole(inspect, ["Imported files:", "/content.txt"]);

    inspect = stdout.inspect();
    await C.cat.exec({
      path: "/content.txt",
    });
    inspect.restore();
    assertConsole(inspect, [content]);
  });

  it("should import an encrypted binary file and export it again verifying it is fine", async function () {
    let password = "password";
    let file = "file1.tar.gz";

    await noPrint(
      C.lcd.exec({
        path: "folder1",
      })
    );

    let result = await execAsync("cksum", await C.lpwd.lpwd(), [file]);
    let cksum = result.message;

    await noPrint(
      C.import.exec({
        path: file,
        binaryToo: true,
      })
    );

    await noPrint(
      C.lcd.exec({
        path: testDir,
      })
    );

    await noPrint(
      C.export.exec({
        path: file,
        password,
      })
    );

    await noPrint(
      C.rm.exec({
        path: file,
      })
    );

    await noPrint(
      C.import.exec({
        path: file,
        password,
      })
    );

    await noPrint(
      C.export.exec({
        path: file,
      })
    );

    result = await execAsync("cksum", await C.lpwd.lpwd(), [file]);
    assert.equal(cksum, result.message);
  });

  it("should import files recursively", async function () {
    await C.lcd.lcd({
      path: "..",
    });

    inspect = stdout.inspect();
    await C.import.exec({
      path: "files",
      recursive: true,
    });
    inspect.restore();
    assertConsole(inspect, [
      "Imported files:",
      "/file",
      "/file.2",
      "/file0.txt",
      "/file3",
      "/folder1/file-2",
      "/folder1/file1",
      "/folder1/folder3/file4",
      "Skipped files:",
    ]);

    inspect = stdout.inspect();
    await C.find.exec({
      keywords: "*",
      content: true,
    });
    inspect.restore();
    assertConsole(inspect, [
      "9 results found:",
      "1  /file",
      "2  /file.2",
      "3  /file0.txt",
      "4  /file3",
      "5  /folder1/",
      "6  /folder1/file-2",
      "7  /folder1/file1",
      "8  /folder1/folder3/",
      "9  /folder1/folder3/file4",
    ]);
  });

  it("should read a folder and import the only text file", async function () {
    let content1 = await C.lcat.lcat({
      path: "folder1/file1",
    });
    let content2 = await C.lcat.lcat({
      path: "folder1/file$2",
    });

    await noPrint(
      C.mkdir.exec({
        path: "/folder",
      })
    );
    await noPrint(
      C.cd.exec({
        path: "/folder",
      })
    );

    inspect = stdout.inspect();
    await C.import.exec({
      path: "folder1",
    });
    inspect.restore();
    assertConsole(inspect, [
      "Imported files:",
      "/folder/file-2",
      "/folder/file1",
      "Skipped files:",
    ]);

    let newSecret = await C.cat.cat({ path: "/folder/file1" });
    assert.equal(content1, newSecret[0].content);
    newSecret = await C.cat.cat({ path: "/folder/file-2" });
    assert.equal(content2, newSecret[0].content);
  });

  it("should read a folder and import text and binary files", async function () {
    await noPrint(
      C.mkdir.exec({
        path: "/folder",
      })
    );
    await noPrint(
      C.cd.exec({
        path: "/folder",
      })
    );

    inspect = stdout.inspect();
    await C.import.exec({
      path: "folder1",
      binaryToo: true,
    });
    inspect.restore();
    assertConsole(inspect, [
      "Imported files:",
      "/folder/file-2",
      "/folder/file1",
      "/folder/file1.tar.gz",
    ]);

    let newSecret = await C.cat.cat({ path: "/folder/file1.tar.gz" });
    assert.equal(newSecret[0].type, prompt.secrez.config.types.BINARY);
  });

  it("should simulate the import of two files", async function () {
    await noPrint(
      C.mkdir.exec({
        path: "/folder",
      })
    );
    await noPrint(
      C.cd.exec({
        path: "/folder",
      })
    );

    inspect = stdout.inspect();
    await C.import.exec({
      path: "folder1",
      simulate: true,
    });
    inspect.restore();
    assertConsole(inspect, [
      "Imported files (simulation):",
      "/folder/file-2",
      "/folder/file1",
    ]);

    try {
      await C.cat.cat({ path: "/folder/file1" });
      assert.isTrue(false);
    } catch (e) {
      assert.equal(e.message, "Path does not exist");
    }
    try {
      await C.cat.cat({ path: "/folder/file-2" });
      assert.isTrue(false);
    } catch (e) {
      assert.equal(e.message, "Path does not exist");
    }
  });

  it("should move the imported file", async function () {
    await noPrint(
      C.mkdir.exec({
        path: "/folder",
      })
    );
    await noPrint(
      C.cd.exec({
        path: "/folder",
      })
    );

    // we copy the file to be moved in order to not change the data
    let dest = path.resolve(__dirname, "../../tmp/test/file4");
    await fs.copy(path.join(options.localDir, "file3"), dest);
    assert.isTrue(await fs.pathExists(dest));

    await C.lcd.lcd({
      path: "../../../tmp/test",
    });

    let content = await C.lcat.lcat({
      path: "file4",
    });

    inspect = stdout.inspect();
    await C.import.exec({
      path: "file4",
      move: true,
    });
    inspect.restore();
    assertConsole(inspect, ["Imported files (moved):", "/folder/file4"]);

    let newSecret = await C.cat.cat({ path: "/folder/file4" });
    assert.equal(newSecret[0].type, prompt.secrez.config.types.TEXT);
    assert.equal(newSecret[0].content, content);

    assert.isFalse(await fs.pathExists(dest));
  });

  it("should import a backup from another software spanning the data among folders and files", async function () {
    await noPrint(
      C.mkdir.exec({
        path: "/folder",
      })
    );
    await noPrint(
      C.cd.exec({
        path: "/folder",
      })
    );

    inspect = stdout.inspect();
    await C.import.exec({
      path: "../some.csv",
      expand: "./imported",
    });
    inspect.restore();
    assertConsole(inspect, [
      "Imported files:",
      "/folder/imported/webs/SampleEntryTitle.yaml",
      "/folder/imported/passwords/twitter/Multi-Line Test Entry.yaml",
      "/folder/imported/tests/Entry To Test/Special Characters.yaml",
      "/folder/imported/tests/Entry To Test/JSON data/1.yaml",
      "/folder/imported/webs/SampleEntryTitle.2.yaml",
    ]);

    let newSecret = await C.cat.cat({
      path: "/folder/imported/webs/SampleEntryTitle.yaml",
      unformatted: true,
    });
    assert.equal(newSecret[0].type, prompt.secrez.config.types.TEXT);
    let content = fromSimpleYamlToJson(newSecret[0].content);
    assert.equal(content.password, "ycXfARD2G1AOBzLlhtbn");
    assert.equal(content.tags, "email eth");
  });

  it("should import a backup from another software but saving the tags as tags", async function () {
    inspect = stdout.inspect();
    await C.import.exec({
      path: "../some.csv",
      expand: "./imported2",
      tags: true,
    });
    inspect.restore();
    assertConsole(inspect, [
      "Imported files:",
      "/imported2/webs/SampleEntryTitle.yaml",
      "/imported2/passwords/twitter/Multi-Line Test Entry.yaml",
      "/imported2/tests/Entry To Test/Special Characters.yaml",
      "/imported2/tests/Entry To Test/JSON data/1.yaml",
      "/imported2/webs/SampleEntryTitle.2.yaml",
    ]);

    let newSecret = await C.cat.cat({
      path: "/imported2/webs/SampleEntryTitle.yaml",
      unformatted: true,
    });
    assert.equal(newSecret[0].type, prompt.secrez.config.types.TEXT);
    let content = fromSimpleYamlToJson(newSecret[0].content);
    assert.equal(content.password, "ycXfARD2G1AOBzLlhtbn");
    assert.isUndefined(content.tags);

    let node = prompt.internalFs.tree.root.getChildFromPath(
      "/imported2/webs/SampleEntryTitle.yaml"
    );
    assert.equal(prompt.internalFs.tree.getTags(node).join(" "), "email eth");
  });

  it("should import a backup from another software using tags to prefix the paths", async function () {
    inspect = stdout.inspect();
    await C.import.exec({
      path: "../some.csv",
      expand: "./imported2",
      tags: true,
      useTagsForPaths: true,
    });
    inspect.restore();
    assertConsole(inspect, [
      "Imported files:",
      "/imported2/eth/email/webs/SampleEntryTitle.yaml",
      "/imported2/some/two/passwords/twitter/Multi-Line Test Entry.yaml",
      "/imported2/tests/Entry To Test/Special Characters.yaml",
      "/imported2/eth/web/tests/Entry To Test/JSON data/1.yaml",
      "/imported2/webs/SampleEntryTitle.yaml",
    ]);

    let newSecret = await C.cat.cat({
      path: "/imported2/eth/email/webs/SampleEntryTitle.yaml",
      unformatted: true,
    });
    assert.equal(newSecret[0].type, prompt.secrez.config.types.TEXT);
    let content = fromSimpleYamlToJson(newSecret[0].content);
    assert.equal(content.password, "ycXfARD2G1AOBzLlhtbn");
    assert.isUndefined(content.tags);

    let node = prompt.internalFs.tree.root.getChildFromPath(
      "/imported2/eth/email/webs/SampleEntryTitle.yaml"
    );
    assert.equal(prompt.internalFs.tree.getTags(node).length, 2);
  });

  it("should import using tags to prefix the paths, ignoring the tags", async function () {
    inspect = stdout.inspect();
    await C.import.exec({
      path: "../some.csv",
      expand: "./imported2",
      useTagsForPaths: true,
    });
    inspect.restore();
    assertConsole(inspect, [
      "Imported files:",
      "/imported2/eth/email/webs/SampleEntryTitle.yaml",
      "/imported2/some/two/passwords/twitter/Multi-Line Test Entry.yaml",
      "/imported2/tests/Entry To Test/Special Characters.yaml",
      "/imported2/eth/web/tests/Entry To Test/JSON data/1.yaml",
      "/imported2/webs/SampleEntryTitle.yaml",
    ]);

    let newSecret = await C.cat.cat({
      path: "/imported2/eth/email/webs/SampleEntryTitle.yaml",
      unformatted: true,
    });
    assert.equal(newSecret[0].type, prompt.secrez.config.types.TEXT);
    let content = fromSimpleYamlToJson(newSecret[0].content);
    assert.equal(content.password, "ycXfARD2G1AOBzLlhtbn");
    assert.isUndefined(content.tags);

    let node = prompt.internalFs.tree.root.getChildFromPath(
      "/imported2/eth/email/webs/SampleEntryTitle.yaml"
    );
    assert.equal(prompt.internalFs.tree.getTags(node).length, 0);
  });

  it('should import from a LastPass-like csv setting the path from "grouping" and "name"', async function () {
    inspect = stdout.inspect();
    await C.import.exec({
      path: "../lastpass_export.csv",
      expand: "./lastpass",
      pathFrom: ["grouping", "name"],
      useTagsForPaths: true,
    });

    inspect.restore();
    assertConsole(inspect, [
      "Imported files:",
      "/lastpass/News/Reference/HackerNews/YC.yaml",
      "/lastpass/Productivity Tools/asana.com.yaml",
      "/lastpass/http_/lombardstreet.io WP.yaml",
      "/lastpass/amazon.it personal.yaml",
    ]);

    inspect = stdout.inspect();
    await C.import.exec({
      path: "../lastpass_export.csv",
      expand: "./lastpass2",
      pathFrom: ["not_existing", "name"],
      useTagsForPaths: true,
    });

    inspect.restore();
    assertConsole(inspect, [
      "Imported files:",
      "/lastpass2/HackerNews/YC.yaml",
      "/lastpass2/asana.com.yaml",
      "/lastpass2/http_/lombardstreet.io WP.yaml",
      "/lastpass2/amazon.it personal.yaml",
    ]);

    inspect = stdout.inspect();
    await C.import.exec({
      path: "../lastpass_export.csv",
      expand: "./lastpass3",
      pathFrom: ["name"],
      useTagsForPaths: true,
    });

    inspect.restore();
    assertConsole(inspect, [
      "Imported files:",
      "/lastpass3/HackerNews/YC.yaml",
      "/lastpass3/asana.com.yaml",
      "/lastpass3/http_/lombardstreet.io WP.yaml",
      "/lastpass3/amazon.it personal.yaml",
    ]);
  });

  it("should import from a json", async function () {
    inspect = stdout.inspect();
    await C.import.exec({
      path: "../some.json",
      expand: "./imported3",
    });
    inspect.restore();
    assertConsole(inspect, [
      "Imported files:",
      "/imported3/webs/SampleEntryTitle.yaml",
      "/imported3/passwords/twitter/Multi-Line Test Entry.yaml",
      "/imported3/tests/Entry To Test/Special Characters.yaml",
      "/imported3/tests/Entry To Test/JSON data/1.yaml",
    ]);
  });

  it("should throw importing a malformed backup", async function () {
    inspect = stdout.inspect();
    await C.import.exec({
      path: "../bad0.csv",
      expand: "./imported",
    });
    inspect.restore();
    assertConsole(inspect, ["The file does not exist"]);

    inspect = stdout.inspect();
    await C.import.exec({
      path: "../bad1.csv",
      expand: "./imported",
    });
    inspect.restore();
    assertConsole(inspect, ["The data misses a path field"]);

    inspect = stdout.inspect();
    await C.import.exec({
      path: "../bad2.csv",
      expand: "./imported",
    });
    inspect.restore();
    assertConsole(inspect, ["The data is empty"]);

    inspect = stdout.inspect();
    await C.import.exec({
      path: "../bad3.csv",
      expand: "./imported",
    });
    inspect.restore();
    assertConsole(inspect, ["The header of the CSV looks wrong"]);
  });

  it("should throw importing a CSV indicating wrong fields to generate the path", async function () {
    inspect = stdout.inspect();
    await C.import.exec({
      path: "../lastpass_export.csv",
      expand: "./lastpass",
      pathFrom: ["folder"],
      useTagsForPaths: true,
    });
    inspect.restore();
    assertConsole(inspect, ["Path cannot be built from the specified fields"]);
  });
});
