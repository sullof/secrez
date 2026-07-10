const chai = require("chai");
const assert = chai.assert;
const inquirer = require("inquirer");
const Crypto = require("@secrez/crypto");
const PreCommand = require("../src/PreCommand");

describe("#PreCommand", function () {
  let cmd;
  let prompt;
  let originalPrompt;

  beforeEach(function () {
    cmd = new PreCommand();
    originalPrompt = inquirer.prompt;
    prompt = {
      inquirer,
      getRl() {
        return { pause() {}, resume() {} };
      },
    };
    cmd.prompt = prompt;
  });

  afterEach(function () {
    inquirer.prompt = originalPrompt;
  });

  describe("#useConfirm", function () {
    it("should return the confirm result", async function () {
      inquirer.prompt = async () => ({ result: true });
      assert.isTrue(await cmd.useConfirm({ message: "Sure?", default: false }));
    });
  });

  describe("#useSelect", function () {
    it("should return the selected choice", async function () {
      inquirer.prompt = async () => ({ result: "alpha" });
      assert.equal(
        await cmd.useSelect({ message: "Pick", choices: ["alpha", "beta"] }),
        "alpha"
      );
    });

    it("should return undefined when cancelled", async function () {
      inquirer.prompt = async () => ({ result: "(cancel)" });
      assert.isUndefined(
        await cmd.useSelect({ message: "Pick", choices: ["alpha"] })
      );
    });

    it("should not add cancel when dontCancel is set", async function () {
      let captured;
      inquirer.prompt = async (qs) => {
        captured = qs[0].choices;
        return { result: "only" };
      };
      await cmd.useSelect({
        message: "Pick",
        choices: ["only"],
        dontCancel: true,
      });
      assert.deepEqual(captured, ["only"]);
    });
  });

  describe("#useInput", function () {
    it("should return the typed value", async function () {
      inquirer.prompt = async () => ({ result: "hello" });
      assert.equal(
        await cmd.useInput({ message: "Name", name: "name" }),
        "hello"
      );
    });

    it("should return undefined when the user cancels with the exit code", async function () {
      const exitCode = "ZZ";
      const original = Crypto.getRandomBase58String;
      Crypto.getRandomBase58String = () => exitCode;
      inquirer.prompt = async () => ({ result: exitCode });
      try {
        assert.isUndefined(
          await cmd.useInput({ message: "Name", name: "name" })
        );
      } finally {
        Crypto.getRandomBase58String = original;
      }
    });

    it("should run custom validate", async function () {
      inquirer.prompt = async () => ({ result: "valid" });
      assert.equal(
        await cmd.useInput({
          message: "Code",
          validate: (v) => v === "valid",
        }),
        "valid"
      );
    });
  });

  describe("#useEditor", function () {
    it("should use editorProvider when set", async function () {
      prompt.editorProvider = async (opts) => `edited:${opts.content}`;
      assert.equal(await cmd.useEditor({ content: "start" }), "edited:start");
    });
  });
});
