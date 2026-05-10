const stdout = require("test-console").stdout;
const fs = require("fs-extra");
const path = require("path");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const { decolorize, noPrint } = require("@secrez/test-helpers");
const Gen = require("../../src/commands/Gen");

const chai = require("chai");
const assert = chai.assert;

const { password, iterations } = require("../fixtures");
const { yamlParse } = require("@secrez/utils");

const SPECIAL_POOL = '!@#$%^&*()-_=+[]{};:,.<>?';

describe("#Gen", function () {
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

  /** Generated password is always printed before optional grey confirmations. */
  function firstStdoutLine(inspectObj) {
    let text = inspectObj.output.map((e) => decolorize(e)).join("\n");
    let lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    return lines[0] || "";
  }

  it("should print a 12-character password with aA1# classes", async function () {
    inspect = stdout.inspect();
    await C.gen.exec();
    inspect.restore();
    let pwd = firstStdoutLine(inspect);
    assert.equal(pwd.length, 12);
    assert.match(pwd, /[a-z]/);
    assert.match(pwd, /[A-Z]/);
    assert.match(pwd, /[0-9]/);
    assert.isTrue([...pwd].some((ch) => SPECIAL_POOL.includes(ch)));
  });

  it("generatePassword covers all subsets (default charset)", function () {
    for (let i = 0; i < 20; i++) {
      let p = Gen.generatePassword(12, ["a", "A", "1", "#"]);
      assert.match(p, /[a-z]/);
      assert.match(p, /[A-Z]/);
      assert.match(p, /[0-9]/);
      assert.isTrue([...p].some((ch) => SPECIAL_POOL.includes(ch)));
      assert.equal(p.length, 12);
    }
  });

  it("supports -s lowercase only", async function () {
    inspect = stdout.inspect();
    await C.gen.exec({ set: "a" });
    inspect.restore();
    let pwd = firstStdoutLine(inspect);
    assert.match(pwd, /^[a-z]{12}$/);
  });

  it("dedupes and ignores subset order", function () {
    let k = Gen.parseSetSpec("Aa1#a");
    assert.deepEqual(k, ["A", "a", "1", "#"]);
  });

  it("rejects invalid charset chars in parseSetSpec", function () {
    assert.throws(
      () => Gen.parseSetSpec("aQx"),
      /Invalid charset character "Q"/
    );
  });

  it("rejects missing --length value when -l parses as null", async function () {
    inspect = stdout.inspect();
    await C.gen.exec({ length: null });
    inspect.restore();
    let out = decolorize(inspect.output.join(" "));
    assert.isTrue(/length.*integer|integer/i.test(out));
  });

  it("rejects missing --set value when -s parses as null", async function () {
    inspect = stdout.inspect();
    await C.gen.exec({ set: null });
    inspect.restore();
    let out = decolorize(inspect.output.join(" "));
    assert.match(out, /Missing value for "--set"/);
  });

  it("honors -l with default charset", async function () {
    inspect = stdout.inspect();
    await C.gen.exec({ length: 20 });
    inspect.restore();
    let pwd = firstStdoutLine(inspect);
    assert.equal(pwd.length, 20);
    assert.match(pwd, /[a-z]/);
    assert.match(pwd, /[A-Z]/);
    assert.match(pwd, /[0-9]/);
    assert.isTrue([...pwd].some((ch) => SPECIAL_POOL.includes(ch)));
  });

  it("honors combined -s and -l", async function () {
    inspect = stdout.inspect();
    await C.gen.exec({ set: "aA", length: 16 });
    inspect.restore();
    let pwd = firstStdoutLine(inspect);
    assert.equal(pwd.length, 16);
    assert.match(pwd, /^[a-zA-Z]{16}$/);
    assert.match(pwd, /[a-z]/);
    assert.match(pwd, /[A-Z]/);
  });

  it("rejects length below subset count", async function () {
    inspect = stdout.inspect();
    await C.gen.exec({ set: "aA1#", length: 3 });
    inspect.restore();
    let out = decolorize(inspect.output.join(" "));
    assert.match(out, /at least 4/);
  });

  it("rejects length above maximum (1024)", async function () {
    inspect = stdout.inspect();
    await C.gen.exec({ length: 1025 });
    inspect.restore();
    let out = decolorize(inspect.output.join(" "));
    assert.match(out, /1024/);
  });

  it("should show help", async function () {
    inspect = stdout.inspect();
    await C.gen.exec({ help: true });
    inspect.restore();
    let str = inspect.output.map((e) => decolorize(e)).join("\n");
    assert.isTrue(/-h, --help/.test(str));
    assert.isTrue(/--length/.test(str) || /-l,/.test(str));
    assert.isTrue(/--path/.test(str) || /-p,/.test(str));
  });

  it("implements help() description", function () {
    let h = C.gen.help();
    assert.isArray(h.description);
    assert.isAbove(h.description.length, 1);
    assert.property(h, "examples");
  });

  it("writes a new plain text file and matches printed password", async function () {
    let p = "/secrets/pw.txt";
    inspect = stdout.inspect();
    await C.gen.exec({ path: p });
    inspect.restore();
    let pwd = firstStdoutLine(inspect);
    assert.equal(pwd.length, 12);

    let stored = (await C.cat.cat({ path: p, unformatted: true }))[0].content;
    assert.equal(stored, pwd);
  });

  it("writes a new yaml card with default password field", async function () {
    let p = "/sites/app.yml";
    inspect = stdout.inspect();
    await C.gen.exec({ path: p, length: 20 });
    inspect.restore();
    let pwd = firstStdoutLine(inspect);
    assert.equal(pwd.length, 20);

    let raw = (await C.cat.cat({ path: p, unformatted: true }))[0].content;
    let data = yamlParse(raw);
    assert.equal(data.password, pwd);
    assert.equal(Object.keys(data).length, 1);
  });

  it("merges yaml and preserves other fields", async function () {
    let p = "/sites/acme.yml";
    await noPrint(
      C.touch.exec({
        path: p,
        content: "user: bob",
      })
    );

    inspect = stdout.inspect();
    await C.gen.exec({ path: p });
    inspect.restore();

    let pwd = firstStdoutLine(inspect);
    let raw = (await C.cat.cat({ path: p, unformatted: true }))[0].content;
    let data = yamlParse(raw);
    assert.equal(data.user, "bob");
    assert.equal(data.password, pwd);
  });

  it("uses -f field name on yaml paths", async function () {
    let p = "/k/api.yml";
    inspect = stdout.inspect();
    await C.gen.exec({
      path: p,
      length: 16,
      field: "token",
      set: "aA1#",
    });
    inspect.restore();
    let pwd = firstStdoutLine(inspect);
    let data = yamlParse(
      (await C.cat.cat({ path: p, unformatted: true }))[0].content
    );
    assert.equal(data.token, pwd);
    assert.equal(data.password, undefined);
  });

  it('rejects -f on non-yaml paths', async function () {
    inspect = stdout.inspect();
    await C.gen.exec({ path: "/plain.txt", field: "x" });
    inspect.restore();
    let out = decolorize(inspect.output.join(" "));
    assert.include(out, "yml");
  });
});
