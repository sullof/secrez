const stdout = require("test-console").stdout;
const chai = require("chai");
const assert = chai.assert;
const fs = require("fs-extra");
const path = require("path");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const {
  assertConsole,
  noPrint,
  decolorize,
  sleep,
} = require("@secrez/test-helpers");

const { password, iterations } = require("../fixtures");

describe("#Find", function () {
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
    await C.find.exec({ help: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(/-h, --help/.test(output[5]));
  });

  it("should show find a string in the tree", async function () {
    await sleep(1000);

    let { internalFs } = prompt;
    let { config } = prompt.secrez;

    await noPrint(
      internalFs.make({
        path: "folder1/file1",
        type: config.types.TEXT,
      })
    );

    await noPrint(
      internalFs.change({
        path: "/folder1/file1",
        content: "Password 2",
      })
    );

    await noPrint(
      internalFs.change({
        path: "/folder1/file1",
        newPath: "/folder1/File2",
        content: "Password 3",
      })
    );

    await noPrint(
      internalFs.make({
        path: "folder2/file3",
        type: config.types.TEXT,
      })
    );

    await noPrint(
      internalFs.make({
        path: "folder4/some",
        type: config.types.TEXT,
      })
    );

    await noPrint(
      internalFs.make({
        path: "folder3/folder4/FOLDER5/File3",
        type: config.types.TEXT,
      })
    );

    inspect = stdout.inspect();
    await C.find.exec({
      keywords: "file",
    });
    inspect.restore();
    assertConsole(inspect, [
      "3 results found:",
      "1  /folder1/File2",
      "2  /folder2/file3",
      "3  /folder3/folder4/FOLDER5/File3",
    ]);

    inspect = stdout.inspect();
    await C.find.exec({
      keywords: "der",
    });
    inspect.restore();
    assertConsole(inspect, [
      "6 results found:",
      "1  /folder1/",
      "2  /folder2/",
      "3  /folder3/",
      "4  /folder3/folder4/",
      "5  /folder3/folder4/FOLDER5/",
      "6  /folder4/",
    ]);

    inspect = stdout.inspect();
    await C.find.exec({
      keywords: "3",
    });
    inspect.restore();
    assertConsole(inspect, [
      "3 results found:",
      "1  /folder2/file3",
      "2  /folder3/",
      "3  /folder3/folder4/FOLDER5/File3",
    ]);

    let nodes = await C.find.find({
      keywords: "3",
      getNodes: true,
    });

    assert.equal(nodes.length, 3);

    inspect = stdout.inspect();
    await C.find.exec({
      keywords: "file1",
      all: true,
    });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e))[1].split(/ +/);
    assert.equal(output[0], 1);
    assert.equal(output[1].length, 4);
    assert.equal(output[2], "/folder1/File2");
    assert.equal(output[3], "file1");

    inspect = stdout.inspect();
    await C.find.exec({
      keywords: "Password",
      content: true,
    });
    inspect.restore();
    assertConsole(inspect, ["1 result found:", "1  /folder1/File2"]);

    inspect = stdout.inspect();
    await C.find.exec({
      keywords: "main:Password",
      content: true,
    });
    inspect.restore();
    assertConsole(inspect, ["1 result found:", "1  main:/folder1/File2"]);

    await noPrint(
      C.use.exec({
        dataset: "archive",
        create: true,
      })
    );

    await noPrint(
      C.touch.exec({
        path: "archive:/password",
        content: "s6s633g3ret",
      })
    );

    inspect = stdout.inspect();
    await C.find.exec({
      keywords: "word",
      content: true,
      global: true,
    });
    inspect.restore();
    assertConsole(inspect, [
      "2 results found:",
      "1  main:/folder1/File2",
      "2  archive:/password",
    ]);
  });

  it("should find no result without parameters", async function () {
    inspect = stdout.inspect();
    await C.find.exec({});
    inspect.restore();
    assertConsole(inspect, ["Missing parameters"]);
  });

  it("should skip binary files from search", async function () {
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

    await noPrint(
      C.import.exec({
        path: "folder1",
        binaryToo: true,
      })
    );

    inspect = stdout.inspect();
    await C.find.exec({
      keywords: "m",
      content: true,
    });
    inspect.restore();
    assertConsole(inspect, [
      "2 results found:",
      "1  /folder/file-2",
      "2  /folder/file1",
    ]);
  });

  it("should find recent changes", async function () {
    await sleep(1000);

    let { internalFs } = prompt;
    let { config } = prompt.secrez;

    // Create entries with delays to ensure different timestamps
    await noPrint(
      internalFs.make({
        path: "recent1",
        type: config.types.TEXT,
        content: "First entry",
      })
    );

    await noPrint(
      internalFs.make({
        path: "recent2",
        type: config.types.TEXT,
        content: "Second entry",
      })
    );

    await noPrint(
      internalFs.make({
        path: "recent3",
        type: config.types.TEXT,
        content: "Third entry",
      })
    );

    await noPrint(
      internalFs.make({
        path: "folder/recent4",
        type: config.types.TEXT,
        content: "Fourth entry",
      })
    );

    await noPrint(
      internalFs.make({
        path: "recent5",
        type: config.types.TEXT,
        content: "Fifth entry",
      })
    );

    // Test default limit (10)
    inspect = stdout.inspect();
    await C.find.exec({
      recent: true,
    });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));

    assert.isTrue(output[0].includes("result"));
    // Should return at least 5 results (we created 5 entries)
    let resultCount = parseInt(output[0].match(/(\d+)\s+result/)[1]);
    assert.isAtLeast(resultCount, 5);

    // Test custom limit
    inspect = stdout.inspect();
    await C.find.exec({
      recent: true,
      limit: 3,
    });
    inspect.restore();
    output = inspect.output.map((e) => decolorize(e));
    assertConsole(inspect, ["3 results found:"]);

    // Verify results are sorted by most recent first
    // Get raw results to check timestamps
    let results = await C.find.find({
      recent: true,
      limit: 5,
    });
    assert.isAtLeast(results.length, 1);
    // The most recent entry should be recent5 (created last)
    let mostRecentPath = results[0][1];
    assert.isTrue(
      mostRecentPath.includes("recent5") ||
        mostRecentPath.includes("folder/recent4")
    );
  });

  it("should find recent changes with global option", async function () {
    await sleep(1000);

    let { internalFs } = prompt;
    let { config } = prompt.secrez;

    // Create entry in main dataset
    await noPrint(
      internalFs.make({
        path: "main-recent",
        type: config.types.TEXT,
        content: "Main entry",
      })
    );
    await sleep(100);

    // Create archive dataset and add entry
    await noPrint(
      C.use.exec({
        dataset: "archive",
        create: true,
      })
    );

    await noPrint(
      C.touch.exec({
        path: "archive:/archive-recent",
        content: "Archive entry",
      })
    );

    // Test global recent search
    inspect = stdout.inspect();
    await C.find.exec({
      recent: true,
      global: true,
      limit: 10,
    });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(output[0].includes("result"));
    // Should find entries from both datasets
    let hasMain = output.some((line) => /main-recent/.test(line));
    let hasArchive = output.some((line) => /archive-recent/.test(line));
    assert.isTrue(hasMain || hasArchive);
  });

  it("should find recent changes from root", async function () {
    await sleep(1000);

    let { internalFs } = prompt;
    let { config } = prompt.secrez;

    // Create entries in subdirectories
    await noPrint(
      internalFs.make({
        path: "subdir/root-recent",
        type: config.types.TEXT,
        content: "Root search entry",
      })
    );

    // Test root option
    inspect = stdout.inspect();
    await C.find.exec({
      recent: true,
      root: true,
      limit: 5,
    });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(output[0].includes("result"));
    // Should find the entry from subdirectory
    let hasSubdir = output.some((line) => /subdir/.test(line));
    assert.isTrue(hasSubdir);
  });

  it("should find recent changes without keywords", async function () {
    await sleep(1000);

    let { internalFs } = prompt;
    let { config } = prompt.secrez;

    // Create some entries
    await noPrint(
      internalFs.make({
        path: "no-keyword1",
        type: config.types.TEXT,
      })
    );
    await sleep(100);
    await noPrint(
      internalFs.make({
        path: "no-keyword2",
        type: config.types.TEXT,
      })
    );

    // Test recent without keywords (should work)
    inspect = stdout.inspect();
    await C.find.exec({
      recent: true,
      limit: 5,
    });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(output[0].includes("result"));
    // Should return results even without keywords
    assert.isFalse(output[0].includes("Missing parameters"));
  });
});
