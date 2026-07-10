const chai = require("chai");
const assert = chai.assert;
const inquirer = require("inquirer");
const Welcome = require("../src/Welcome");

describe("#Welcome", function () {
  let originalPrompt;

  beforeEach(function () {
    originalPrompt = inquirer.prompt;
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

    it("should prompt for confirmation when iterations are below the threshold", async function () {
      let prompted = false;
      inquirer.prompt = async () => {
        prompted = true;
        return { proceed: true };
      };

      assert.isTrue(await Welcome.confirmLowIterations(50000));
      assert.isTrue(prompted);
    });

    it("should return false when the user declines the low-iteration warning", async function () {
      inquirer.prompt = async () => ({ proceed: false });

      assert.isFalse(await Welcome.confirmLowIterations(1000));
    });
  });
});
