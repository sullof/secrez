const chai = require("chai");
const { assert, expect } = chai;
const stdout = require("test-console").stdout;
const fs = require("fs-extra");
const path = require("path");
const { getWalletFromEncryptedJson } = require("@secrez/eth");
const Crypto = require("@secrez/crypto");
const { FileCipher } = require("@secrez/fs");

const MainPrompt = require("../../src/prompts/MainPromptMock");
const {
  assertConsole,
  noPrint,
  decolorize,
  sleep,
} = require("@secrez/test-helpers");
const { execAsync } = require("@secrez/utils");

const { password, iterations } = require("../fixtures");

describe("#Export", function () {
  let prompt;
  let testDir = path.resolve(__dirname, "../../tmp/test");
  let rootDir = path.resolve(testDir, ".secrez");
  let inspect, C;
  let publicKeys = {};

  let options = {
    container: rootDir,
    localDir: path.resolve(__dirname, "../../tmp/test"),
  };

  before(async function () {
    for (let i = 0; i < 3; i++) {
      await fs.emptyDir(testDir);
      prompt = new MainPrompt();
      await prompt.init(options);
      await prompt.secrez.signup(password, iterations);
      publicKeys["user" + i] = prompt.secrez.getPublicKey();
    }
  });

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
    await C.export.exec({ help: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(/-h, --help/.test(output[5]));
  });

  it("should export a file to the current local folder", async function () {
    let content = "Some secret";
    let p = "/folder/file";

    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    await noPrint(
      C.cd.exec({
        path: "/folder",
      })
    );

    inspect = stdout.inspect();
    await C.export.exec({
      path: "file",
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", "file"]);

    let content2 = await C.lcat.lcat({
      path: path.join(await C.lpwd.lpwd(), "file"),
    });
    assert.equal(content2, content);

    inspect = stdout.inspect();
    await C.export.exec({
      path: "file",
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", "file.2"]);

    content2 = await C.lcat.lcat({
      path: path.join(await C.lpwd.lpwd(), "file"),
    });
    assert.equal(content2, content);
  });

  it("should export a file encrypted only for the user itself", async function () {
    let content = "Some secret";
    let p = "/file";

    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    await noPrint(
      C.lcd.exec({
        path: testDir,
      })
    );

    inspect = stdout.inspect();
    await C.export.exec({
      path: "file",
      encrypt: true,
      includeMe: true,
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", "file.secrez"]);

    let encryptedContent = await C.lcat.lcat({
      path: path.join(await C.lpwd.lpwd(), "file.secrez"),
    });
    // Decrypt the content since it was exported with encryption

    const fileCipher = new FileCipher(prompt.secrez);
    const decryptedContent = fileCipher.decryptFile(encryptedContent, {});
    assert.equal(decryptedContent, content);

    inspect = stdout.inspect();
    await C.export.exec({
      path: "file",
      encrypt: true,
      includeMe: true,
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", "file.secrez.2"]);

    encryptedContent = await C.lcat.lcat({
      path: path.join(await C.lpwd.lpwd(), "file.secrez.2"),
    });
    // Decrypt the content since it was exported with encryption
    const decryptedContent2 = fileCipher.decryptFile(encryptedContent, {});
    assert.equal(decryptedContent2, content);
  });

  it("should export a binary file to the current local folder", async function () {
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
      C.lcd.exec({
        path: "../../test/fixtures/files/folder1",
      })
    );

    inspect = stdout.inspect();
    await C.import.exec({
      path: "file1.tar.gz",
      binaryToo: true,
    });
    inspect.restore();
    assertConsole(inspect, ["Imported files:", "/folder/file1.tar.gz"]);

    await noPrint(
      C.lcd.exec({
        path: "../../../../tmp/test",
      })
    );

    inspect = stdout.inspect();
    await C.export.exec({
      path: "file1.tar.gz",
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", "file1.tar.gz"]);

    let currFolder = await C.lpwd.lpwd();
    let result = await execAsync("file", currFolder, ["file1.tar.gz"]);
    assert.isTrue(/gzip compressed data/.test(result.message));

    inspect = stdout.inspect();
    await C.export.exec({
      path: "file1.tar.gz",
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", "file1.tar.gz.2"]);
  });

  it("should export an encrypted file to the current local folder", async function () {
    await C.contacts.contacts({
      add: "user1",
      publicKey: publicKeys.user1,
    });

    await C.contacts.contacts({
      add: "user2",
      publicKey: publicKeys.user2,
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

    await noPrint(
      C.lcd.exec({
        path: "../../test/fixtures/files/folder1",
      })
    );

    inspect = stdout.inspect();
    await C.import.exec({
      path: "file1.tar.gz",
      binaryToo: true,
    });
    inspect.restore();
    assertConsole(inspect, ["Imported files:", "/folder/file1.tar.gz"]);

    await noPrint(
      C.lcd.exec({
        path: "../../../../tmp/test",
      })
    );

    inspect = stdout.inspect();
    await C.export.exec({
      path: "file1.tar.gz",
      encrypt: true,
      password: "some weird password",
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", "file1.tar.gz.secrezb"]);

    let currFolder = await C.lpwd.lpwd();
    let result = await execAsync("file", currFolder, ["file1.tar.gz.secrezb"]);
    assert.isTrue(/ASCII text/.test(result.message));

    inspect = stdout.inspect();
    await C.export.exec({
      path: "file1.tar.gz",
      encrypt: true,
      password: "some weird password",
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", "file1.tar.gz.secrezb.2"]);

    inspect = stdout.inspect();
    await C.export.exec({
      path: "file1.tar.gz",
      encrypt: true,
      contacts: ["user1", "user2"],
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", "file1.tar.gz.secrezb.3"]);

    currFolder = await C.lpwd.lpwd();
    result = await execAsync("file", currFolder, ["file1.tar.gz.secrezb.3"]);
    assert.isTrue(/ASCII text/.test(result.message));
  });

  it("should export a file and delete it after 1 second", async function () {
    let content = "Some secret";
    let p = "/folder/file";

    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    await noPrint(
      C.cd.exec({
        path: "/folder",
      })
    );

    await noPrint(
      C.export.exec({
        path: "file",
        duration: 1,
      })
    );

    let list = await C.lls.lls({ path: await C.lpwd.lpwd() });
    assert.equal(list.length, 1);

    await sleep(1200);

    list = await C.lls.lls({ path: await C.lpwd.lpwd() });
    assert.equal(list.length, 0);
  });

  it("should return an error if the file does not exist or is a folder", async function () {
    await noPrint(
      C.mkdir.exec({
        path: "/folder",
      })
    );

    inspect = stdout.inspect();
    await C.export.exec({
      path: "/folder",
    });
    inspect.restore();
    assertConsole(inspect, ["Cannot export a folder"]);

    inspect = stdout.inspect();
    await C.export.exec({
      path: "/some",
    });
    inspect.restore();
    assertConsole(inspect, ["Path does not exist"]);
  });

  it("should export a keystore json file if a private_key exists in the entry", async function () {
    const p = "/folder/pk.yml";
    const expected = "pk.keystore.json";
    const password = "some weird password";

    await noPrint(
      C.touch.exec({
        path: p,
        generateWallet: true,
      })
    );

    const pkYml = await C.cat.cat({
      path: p,
      unformatted: true,
    });
    const privateKey = pkYml[0].content
      .split("private_key: ")[1]
      .split("\n")[0];

    inspect = stdout.inspect();
    await C.export.exec({
      path: p,
      keystore: true,
      password,
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", expected]);

    const jsonFileContent = await C.lcat.lcat({
      path: path.join(await C.lpwd.lpwd(), expected),
    });

    const wallet = await getWalletFromEncryptedJson(jsonFileContent, password);
    expect(wallet.privateKey).equal("0x" + privateKey);
  });

  it("should export a cryptoenv file if a private_key exists in the entry", async function () {
    const p = "/folder/pk.yml";
    const expected = "pk.crypto.env";
    const password = "some weird password";

    await noPrint(
      C.touch.exec({
        path: p,
        generateWallet: true,
      })
    );

    const pkYml = await C.cat.cat({
      path: p,
      unformatted: true,
    });
    const privateKey = pkYml[0].content
      .split("private_key: ")[1]
      .split("\n")[0];

    inspect = stdout.inspect();
    await C.export.exec({
      path: p,
      cryptoEnv: true,
      password,
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", expected]);

    const jsonFileContent = await C.lcat.lcat({
      path: path.join(await C.lpwd.lpwd(), expected),
    });

    const recovered = Crypto.decrypt(jsonFileContent, Crypto.SHA3(password));
    expect(recovered).equal(privateKey);
  });

  it("should export a cryptoenv file with entire content when no private_key fields exist and user confirms", async function () {
    const p = "/folder/no-pk.yml";
    const expected = "no-pk.crypto.env";
    const password = "some weird password";
    const content = "some_secret_value: abc123\napi_key: xyz789";

    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    // Mock the user input to confirm encrypting entire content
    const originalUseInput = C.export.useInput;
    C.export.useInput = async (options) => {
      if (options.type === "confirm") {
        return true; // User confirms to encrypt entire content
      }
      if (options.type === "password") {
        return password;
      }
      return originalUseInput.call(C.export, options);
    };

    inspect = stdout.inspect();
    await C.export.exec({
      path: p,
      cryptoEnv: true,
    });
    inspect.restore();
    assertConsole(inspect, ["Exported file:", expected]);

    const jsonFileContent = await C.lcat.lcat({
      path: path.join(await C.lpwd.lpwd(), expected),
    });

    const recovered = Crypto.decrypt(jsonFileContent, Crypto.SHA3(password));
    expect(recovered).equal(content);

    // Restore original useInput
    C.export.useInput = originalUseInput;
  });

  it("should throw error when no private_key fields exist and user declines", async function () {
    const p = "/folder/no-pk.yml";
    const content = "some_secret_value: abc123\napi_key: xyz789";

    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    // Mock the user input to decline encrypting entire content
    const originalUseInput = C.export.useInput;
    C.export.useInput = async (options) => {
      if (options.type === "confirm") {
        return false; // User declines to encrypt entire content
      }
      return originalUseInput.call(C.export, options);
    };

    inspect = stdout.inspect();
    await C.export.exec({
      path: p,
      cryptoEnv: true,
    });
    inspect.restore();
    assertConsole(inspect, ["The entry does not contain any private key"]);

    // Restore original useInput
    C.export.useInput = originalUseInput;
  });

  it("should throw error when no private_key fields exist and keystore option is used", async function () {
    const p = "/folder/no-pk.yml";
    const content = "some_secret_value: abc123\napi_key: xyz789";

    await noPrint(
      C.touch.exec({
        path: p,
        content,
      })
    );

    inspect = stdout.inspect();
    await C.export.exec({
      path: p,
      keystore: true,
    });
    inspect.restore();
    assertConsole(inspect, ["The entry does not contain any private key"]);
  });

  it("should display encrypted content in console when using crypto-env with no-export", async function () {
    const p = "/folder/pk.yml";
    const password = "some weird password";

    await noPrint(
      C.touch.exec({
        path: p,
        generateWallet: true,
      })
    );

    const pkYml = await C.cat.cat({
      path: p,
      unformatted: true,
    });
    const privateKey = pkYml[0].content
      .split("private_key: ")[1]
      .split("\n")[0];

    inspect = stdout.inspect();
    await C.export.exec({
      path: p,
      cryptoEnv: true,
      noExport: true,
      password,
    });
    inspect.restore();

    // Should display encrypted content instead of exporting file
    assertConsole(inspect, ["Encrypted content:"]);
    // Verify the encrypted content is a valid base64 string
    const output = inspect.output.map((e) => decolorize(e)).join("");
    const encryptedContent = output.split("Encrypted content:")[1].trim();
    assert.isTrue(/^[A-Za-z0-9+/=]+$/.test(encryptedContent));

    // Verify no file was created
    const files = await C.lls.lls({ path: await C.lpwd.lpwd() });
    const cryptoEnvFiles = files.filter((f) => f.endsWith(".crypto.env"));
    assert.equal(cryptoEnvFiles.length, 0);
  });
});
