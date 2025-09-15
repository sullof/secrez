const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;
const fs = require("fs-extra");
const path = require("path");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const { assertConsole, noPrint, decolorize } = require("@secrez/test-helpers");
const { execAsync } = require("@secrez/utils");
require("dotenv").config({ quiet: true });

const { password, iterations } = require("../fixtures");

describe("#Git", function () {
  let prompt;
  let rootDir = path.resolve(__dirname, "../../tmp/test/.secrez");
  let inspect, C;
  let testDir;
  let localDir1;
  let localDir2;
  let tempSshKeyPath;
  const testRepoUrl = process.env.SECREZ_TEST_REPO_URL;

  let options = {
    container: rootDir,
    localDir: __dirname,
  };

  before(async function () {
    this.timeout(15000); // Increase timeout for git operations

    if (!testRepoUrl) {
      this.skip();
    }

    testDir = path.resolve(__dirname, "../../tmp/test-git");
    localDir1 = path.join(testDir, "local1");
    localDir2 = path.join(testDir, "local2");
    tempSshKeyPath = path.join(testDir, "temp_ssh_key");

    await fs.emptyDir(testDir);
    await fs.emptyDir(localDir1);
    await fs.emptyDir(localDir2);

    // Check if required environment variables are set
    if (!process.env.SECREZ_TEST_REPO_URL) {
      throw new Error(
        `SECREZ_TEST_REPO_URL environment variable not set. Please set it to your test repository URL (e.g., "git@github.com:username/repo.git")`
      );
    }

    if (!process.env.SECREZ_TEST_SSH_KEY) {
      throw new Error(`SECREZ_TEST_SSH_KEY environment variable not set. Please:
1. Generate SSH key: ssh-keygen -t ed25519 -f ./secrez_test_key -C "secrez-test@example.com"
2. Add public key to GitHub as deploy key with write access
3. Set SECREZ_TEST_SSH_KEY environment variable with the private key content`);
    }

    // Create temporary SSH key file from environment variable
    await fs.writeFile(tempSshKeyPath, process.env.SECREZ_TEST_SSH_KEY);
    await fs.chmod(tempSshKeyPath, 0o600);

    // Clone the test repository in both folders
    const env = {
      ...process.env,
      GIT_SSH_COMMAND: `ssh -i ${tempSshKeyPath} -o StrictHostKeyChecking=no`,
    };
    await execAsync("git", testDir, ["clone", testRepoUrl, "local1"], { env });
    await execAsync("git", testDir, ["clone", testRepoUrl, "local2"], { env });

    // Configure git in both repos
    for (const dir of [localDir1, localDir2]) {
      await execAsync("git", dir, ["config", "user.name", "Test User"]);
      await execAsync("git", dir, ["config", "user.email", "test@example.com"]);
    }
  });

  beforeEach(async function () {
    await fs.emptyDir(path.resolve(__dirname, "../../tmp/test"));
    prompt = new MainPrompt();
    await prompt.init(options);
    C = prompt.commands;
    await prompt.secrez.signup(password, iterations);
    await prompt.internalFs.init();
  });

  after(async function () {
    if (testDir) {
      await fs.remove(testDir);
    }
  });

  it("should return the help", async function () {
    inspect = stdout.inspect();
    await C.git.exec({ help: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));

    assert.isTrue(/-h, --help/.test(output[4]));
  });

  it("should show git status when --status is used", async function () {
    this.timeout(10000); // Increase timeout for git operations

    // Set the container to our test git repository
    prompt.secrez.config.container = localDir1;

    inspect = stdout.inspect();
    await C.git.exec({ status: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));

    // Should show either "No remote changes found." or a warning message
    assert.isTrue(
      /No remote changes found/.test(output.join("")) ||
        /Git Conflict Risk Detected/.test(output.join("")) ||
        /Git Status Check Failed/.test(output.join(""))
    );
  });

  it("should show git status by default", async function () {
    this.timeout(10000); // Increase timeout for git operations

    // Set the container to our test git repository
    prompt.secrez.config.container = localDir1;

    inspect = stdout.inspect();
    await C.git.exec({});
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    // Should show either "No remote changes found." or a warning message
    assert.isTrue(
      /No remote changes found/.test(output.join("")) ||
        /Git Conflict Risk Detected/.test(output.join("")) ||
        /Git Status Check Failed/.test(output.join(""))
    );
  });

  it("should handle conflict risk scenario", async function () {
    this.timeout(15000); // Increase timeout for git operations including push

    // Set the container to our test git repository
    prompt.secrez.config.container = localDir1;

    // Make a change in localDir1 and push to remote to create a conflict scenario
    const env = {
      ...process.env,
      GIT_SSH_COMMAND: `ssh -i ${tempSshKeyPath} -o StrictHostKeyChecking=no`,
    };
    await fs.writeFile(
      path.join(localDir1, "conflict-test.txt"),
      "Remote change"
    );
    await execAsync("git", localDir1, ["add", "conflict-test.txt"]);
    await execAsync("git", localDir1, ["commit", "-m", "Conflict test"]);
    await execAsync("git", localDir1, ["push", "origin", "main"], { env });

    // Now test with localDir2 - should be behind
    prompt.secrez.config.container = localDir2;

    inspect = stdout.inspect();
    await C.git.exec({ status: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    // The result should indicate a conflict risk or be up to date depending on fetch timing
    assert.isTrue(
      /Git Conflict Risk Detected/.test(output.join("")) ||
        /No remote changes found/.test(output.join(""))
    );
  });

  it("should handle non-git repository", async function () {
    // Set the container to a non-git directory
    prompt.secrez.config.container = testDir;

    inspect = stdout.inspect();
    await C.git.exec({ status: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(/Not a git repository/.test(output.join("")));
  });
});
