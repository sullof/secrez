const chai = require("chai");
const assert = chai.assert;
const fs = require("fs-extra");
const path = require("path");
const Fido2Client = require("../../src/utils/Fido2Client");

describe.skip("#Fido2Client", function () {
  let fido2Client;

  beforeEach(async function () {
    fido2Client = new Fido2Client();
  });

  describe("#configuration", async function () {
    it("should verify that all the scripts exist", async function () {
      assert.isTrue(
        await fs.pathExists(
          path.join(fido2Client.scriptsPath, "fido2_credential.py")
        )
      );
      assert.isTrue(
        await fs.pathExists(
          path.join(fido2Client.scriptsPath, "hmac_secret.py")
        )
      );
      assert.isTrue(
        await fs.pathExists(
          path.join(fido2Client.scriptsPath, "is_fido2_ready.py")
        )
      );
    });
  });
});
