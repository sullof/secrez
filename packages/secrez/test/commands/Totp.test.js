const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;
const clipboardy = require("clipboardy");
const fs = require("fs-extra");
const chalk = require("chalk");
const path = require("path");
const { yamlParse } = require("@secrez/utils");

const MainPrompt = require("../../src/prompts/MainPromptMock");
const {
  sleep,
  noPrint,
  decolorize,
  assertConsole,
  copyImageToClipboard,
} = require("@secrez/test-helpers");

const { password, iterations } = require("../fixtures");

describe("#Totp", function () {
  let prompt;
  let rootDir = path.resolve(__dirname, "../../tmp/test/.secrez");
  let inspect, C;

  let options = {
    container: rootDir,
    localDir: path.resolve(__dirname, "../../tmp/test"),
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
    await C.totp.exec({ help: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(/-h, --help/.test(output[4]));
  });

  it("should totp a file to the clipboard", async function () {
    let content = "totp: sheurytwrefd";
    let p = "/card.yml";
    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    await clipboardy.write("test\n");

    let previousContent = await clipboardy.read();
    inspect = stdout.inspect();
    await C.totp.exec({
      path: "card.yml",
      duration: [0.2],
      noBeep: true,
    });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(/TOTP token: \d{6}/.test(output[0]));
    let token = output[0].split("TOTP token: ")[1];

    await sleep(100);
    assert.equal(await clipboardy.read(), token);

    await sleep(200);
    assert.equal(await clipboardy.read(), previousContent);
  });

  it("should read a totp secret from an image and add the totp field to the card", async function () {
    let content = "user: john";
    let p = "/card.yml";
    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    inspect = stdout.inspect();
    await C.totp.exec({
      path: p,
      fromImage: path.resolve(__dirname, "../fixtures/qrcode.png"),
      noBeep: true,
    });
    inspect.restore();
    assertConsole(inspect, [
      "A totp field has been successfully created.",
      'Try it, running "totp /card.yml"',
    ]);
    let newContent = yamlParse(
      prompt.internalFs.tree.root.getChildFromPath(p).getContent()
    );
    assert.equal(newContent.totp, "ueiwureiruee");
  });

  it("should read a totp secret from an image and return the secret", async function () {
    inspect = stdout.inspect();
    await C.totp.exec({
      fromImage: path.resolve(__dirname, "../fixtures/qrcode.png"),
      noBeep: true,
    });
    inspect.restore();
    assertConsole(inspect, ['The secret in the QR Code is "ueiwureiruee"']);
  });

  it("should throw if bad image", async function () {
    let content = "user: john";
    let p = "/card.yml";
    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    inspect = stdout.inspect();
    await C.totp.exec({
      path: p,
      fromImage: path.resolve(__dirname, "../fixtures/some.csv"),
      noBeep: true,
    });
    inspect.restore();
    assertConsole(inspect, ["The file does not look like a valid 2FA QR code"]);
  });

  it("should throw if missing parameters", async function () {
    let content = "john";
    let p = "/card.yml";
    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    inspect = stdout.inspect();
    await C.totp.exec({
      path: p,
    });
    inspect.restore();
    assertConsole(inspect, ["The file is not a card with a totp field"]);

    content = "john";
    p = "text";
    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    inspect = stdout.inspect();
    await C.totp.exec({
      path: p,
    });
    inspect.restore();
    assertConsole(inspect, ["The file is not a card with a totp field"]);
  });

  it("should throw if the yaml is malformed", async function () {
    let content = "user: user: john";
    let p = "/card.yml";
    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    inspect = stdout.inspect();
    await C.totp.exec({
      path: p,
      fromImage: path.resolve(__dirname, "../fixtures/qrcode.png"),
    });
    inspect.restore();
    assertConsole(inspect, ["The yml is malformed"]);
  });

  it("should read a totp secret from the clipboard", async function () {
    try {
      await copyImageToClipboard(
        path.resolve(__dirname, "../fixtures/qrcode.png")
      );
      inspect = stdout.inspect();
      await C.totp.exec({
        fromClipboard: true,
        noBeep: true,
      });
      inspect.restore();
      assertConsole(inspect, ['The secret in the QR Code is "ueiwureiruee"']);
    } catch (e) {
      console.info(chalk.bold.red(e.message));
      assert.isTrue(false);
    }
  });

  it("should read clipboard png via xclip without shell interpolation", async function () {
    const childProcess = require("child_process");
    const originalSpawn = childProcess.spawn;
    let spawnArgs;
    childProcess.spawn = function (cmd, args) {
      spawnArgs = { cmd, args };
      const { EventEmitter } = require("events");
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      process.nextTick(() => {
        child.stdout.emit("data", Buffer.from("png"));
        child.emit("close", 0);
      });
      return child;
    };
    try {
      const outputPath = path.join(prompt.secrez.config.tmpPath, "image.png");
      await C.totp.writeClipboardPngToFile(outputPath);
      assert.equal(spawnArgs.cmd, "xclip");
      assert.deepEqual(spawnArgs.args, [
        "-selection",
        "clipboard",
        "-t",
        "image/png",
        "-o",
      ]);
      assert.isTrue(await fs.pathExists(outputPath));
      assert.equal((await fs.readFile(outputPath)).toString(), "png");
    } finally {
      childProcess.spawn = originalSpawn;
    }
  });
});
