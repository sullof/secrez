const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;
const inquirer = require("inquirer");
const fs = require("fs-extra");
const path = require("path");
const { ConfigUtils } = require("@secrez/core");
const Welcome = require("../src/Welcome");
const { assertConsole } = require("@secrez/test-helpers");

const { password, iterations } = require("./fixtures");

describe("#Welcome", function () {
  let originalPrompt;
  let testDir;
  let rootDir;
  let secrez;

  beforeEach(async function () {
    originalPrompt = inquirer.prompt;
    testDir = path.resolve(__dirname, "../tmp/welcome-test");
    rootDir = path.resolve(testDir, ".secrez");
    await fs.emptyDir(testDir);
    secrez = new (require("@secrez/core").Secrez())();
    await secrez.init(rootDir, __dirname);
    Welcome.secrez = secrez;
    Welcome.options = {};
    if (secrez.config.envPath && require.cache[secrez.config.envPath]) {
      delete require.cache[secrez.config.envPath];
    }
  });

  afterEach(function () {
    inquirer.prompt = originalPrompt;
  });

  describe("#confirmLowIterations", function () {
    it("should accept iteration counts at or above the warning threshold", async function () {
      assert.isTrue(
        await Welcome.confirmLowIterations(
          Welcome.LOW_ITERATIONS_WARNING_THRESHOLD
        )
      );
      assert.isTrue(await Welcome.confirmLowIterations(500000));
    });

    it("should show a warning when iterations are below the threshold", async function () {
      inquirer.prompt = async () => ({ proceed: true });

      const inspect = stdout.inspect();
      await Welcome.confirmLowIterations(50000);
      inspect.restore();

      assertConsole(
        inspect,
        ["Warning: you chose fewer than 100,000 iterations."],
        true
      );
    });

    it("should prompt for confirmation when iterations are below the threshold", async function () {
      let prompted = false;
      inquirer.prompt = async () => {
        prompted = true;
        return { proceed: true };
      };

      const inspect = stdout.inspect();
      assert.isTrue(await Welcome.confirmLowIterations(50000));
      inspect.restore();

      assert.isTrue(prompted);
    });

    it("should return false when the user declines the low-iteration warning", async function () {
      inquirer.prompt = async () => ({ proceed: false });

      const inspect = stdout.inspect();
      assert.isFalse(await Welcome.confirmLowIterations(1000));
      inspect.restore();
    });
  });

  describe("#getIterations", function () {
    it("should read iterations from env.json when present", async function () {
      await ConfigUtils.putEnv(secrez.config, { iterations: 99999 });
      assert.equal(await Welcome.getIterations(), 99999);
    });

    it("should prompt when env.json has no iterations", async function () {
      await fs.writeFile(secrez.config.envPath, "{}");
      delete require.cache[secrez.config.envPath];
      inquirer.prompt = async () => ({ iterations: "12345" });
      assert.equal(await Welcome.getIterations(), 12345);
    });
  });

  describe("#saveIterations", function () {
    it("should save iterations when -s is set", async function () {
      Welcome.options = { saveIterations: true };
      Welcome.iterations = 88888;
      await Welcome.saveIterations();
      const env = await ConfigUtils.getEnv(secrez.config);
      assert.equal(env.iterations, 88888);
    });

    it("should not save iterations when -s is not set", async function () {
      await ConfigUtils.putEnv(secrez.config, { iterations: 11111 });
      Welcome.options = {};
      Welcome.iterations = 88888;
      await Welcome.saveIterations();
      const env = await ConfigUtils.getEnv(secrez.config);
      assert.equal(env.iterations, 11111);
    });
  });

  describe("#login", function () {
    beforeEach(async function () {
      await secrez.signup(password, iterations);
      Welcome.iterations = iterations;
    });

    it("should sign in with the correct password", async function () {
      inquirer.prompt = async () => ({ password });
      const inspect = stdout.inspect();
      await Welcome.login();
      inspect.restore();
      assert.isOk(secrez.getPublicKey());
    });

    it("should retry after a wrong password", async function () {
      let attempts = 0;
      inquirer.prompt = async () => {
        attempts++;
        return { password: attempts === 1 ? "wrong-password" : password };
      };
      const inspect = stdout.inspect();
      await Welcome.login();
      inspect.restore();
      assert.equal(attempts, 2);
      assertConsole(inspect, "Try again", true);
      assert.isOk(secrez.getPublicKey());
    });
  });

  describe("#signup", function () {
    it("should create an account when passwords match", async function () {
      Welcome.iterations = 500000;
      inquirer.prompt = async () => ({ password, retype: password });
      const inspect = stdout.inspect();
      await Welcome.signup();
      inspect.restore();
      assert.isOk(secrez.getPublicKey());
    });

    it("should retry when passwords do not match", async function () {
      Welcome.iterations = 500000;
      let attempts = 0;
      inquirer.prompt = async () => {
        attempts++;
        if (attempts === 1) {
          return { password, retype: "different" };
        }
        return { password, retype: password };
      };
      const inspect = stdout.inspect();
      await Welcome.signup();
      inspect.restore();
      assert.equal(attempts, 2);
      assertConsole(inspect, "do not match", true);
      assert.isOk(secrez.getPublicKey());
    });
  });
});
