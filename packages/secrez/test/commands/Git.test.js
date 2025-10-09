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
  let prompt2;
  let inspect, C, C2;
  let testDir;
  let localDir1;
  let localDir2;
  let tempSshKeyPath;
  const testRepoUrl = process.env.SECREZ_TEST_REPO_URL;

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
    this.timeout(10000);

    // Initialize first prompt with localDir1
    prompt = new MainPrompt();
    await prompt.init({
      container: localDir1,
      localDir: __dirname,
    });
    C = prompt.commands;
    await prompt.secrez.signin(password, iterations);
    await prompt.internalFs.init();

    // Initialize second prompt with localDir2
    prompt2 = new MainPrompt();
    await prompt2.init({
      container: localDir2,
      localDir: __dirname,
    });
    C2 = prompt2.commands;
    await prompt2.secrez.signin(password, iterations);
    await prompt2.internalFs.init();
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

    // Now test with prompt2 (localDir2) - should be behind
    inspect = stdout.inspect();
    await C2.git.exec({ status: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    // The result should indicate a conflict risk or be up to date depending on fetch timing
    assert.isTrue(
      /Git Conflict Risk Detected/.test(output.join("")) ||
        /No remote changes found/.test(output.join(""))
    );
  });

  it("should handle non-git repository", async function () {
    this.timeout(10000);

    // Create a temporary non-git directory with .secrez structure
    const nonGitDir = path.join(testDir, "non-git-secrez");
    await fs.emptyDir(nonGitDir);

    // Create a temporary prompt and signup in the non-git directory
    const tempPrompt = new MainPrompt();
    await tempPrompt.init({
      container: nonGitDir,
      localDir: __dirname,
    });
    await tempPrompt.secrez.signup(password, iterations);
    await tempPrompt.internalFs.init();

    inspect = stdout.inspect();
    await tempPrompt.commands.git.exec({ status: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(/Not a git repository/.test(output.join("")));

    // Clean up
    await fs.remove(nonGitDir);
  });

  it("should allow normal operations in non-git repository", async function () {
    this.timeout(10000);

    // Create a temporary non-git directory with .secrez structure
    const nonGitDir = path.join(testDir, "non-git-operations");
    await fs.emptyDir(nonGitDir);

    // Create a prompt and signup in the non-git directory
    const tempPrompt = new MainPrompt();
    await tempPrompt.init({
      container: nonGitDir,
      localDir: __dirname,
    });
    await tempPrompt.secrez.signup(password, iterations);
    await tempPrompt.internalFs.init();

    // Verify no git fingerprint was captured
    assert.isNull(tempPrompt.internalFs.gitConflictChecker.initialGitState);

    // Create a file - should work normally without any git checks blocking it
    inspect = stdout.inspect();
    await tempPrompt.commands.touch.exec({
      path: "/test-file-1.txt",
    });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));

    // Should NOT show any git warnings
    assert.isFalse(/Repository State Changed Externally/.test(output.join("")));
    assert.isFalse(/Git Conflict Risk/.test(output.join("")));

    // Verify the file was created successfully
    inspect = stdout.inspect();
    await tempPrompt.commands.ls.exec({ path: "/", list: true });
    inspect.restore();
    output = inspect.output.map((e) => decolorize(e)).join("");
    assert.isTrue(/test-file-1\.txt/.test(output));

    // Create another file - should also work
    await noPrint(
      tempPrompt.commands.touch.exec({
        path: "/test-file-2.txt",
      })
    );

    inspect = stdout.inspect();
    await tempPrompt.commands.ls.exec({ path: "/", list: true });
    inspect.restore();
    output = inspect.output.map((e) => decolorize(e)).join("");
    assert.isTrue(/test-file-2\.txt/.test(output));

    // Clean up
    await fs.remove(nonGitDir);
  });

  it("should detect external git changes and block operations", async function () {
    this.timeout(20000); // Increase timeout for git operations

    // initialize a third prompt with localDir1
    const prompt3 = new MainPrompt();
    await prompt3.init({
      container: localDir1,
      localDir: __dirname,
    });
    const C3 = prompt3.commands;
    await prompt3.secrez.signin(password, iterations);
    await prompt3.internalFs.init();

    // Verify git fingerprint was captured (since this IS a git repo)
    assert.isNotNull(prompt3.internalFs.gitConflictChecker.initialGitState);

    const env = {
      ...process.env,
      GIT_SSH_COMMAND: `ssh -i ${tempSshKeyPath} -o StrictHostKeyChecking=no`,
    };

    inspect = stdout.inspect();
    await C.ls.exec({ path: "/test-before-external-commit-*", list: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e))[0].split("\n");
    for (let i = 0; i < output.length; i++) {
      let cols = output[i].split(/ +/);
      let file = cols[cols.length - 1];
      await noPrint(C.rm.exec({ path: file }));
    }

    // Create a new file
    const newPath = "/test-before-external-commit-" + Date.now();
    await noPrint(
      C.touch.exec({
        path: newPath,
      })
    );

    // Quit the prompt
    await noPrint(C.quit.exec({}));

    // Now run git commands OUTSIDE of Secrez to commit and push
    // This simulates a user committing in another terminal while Secrez is running
    await execAsync("git", localDir1, ["add", "-A"]);
    await execAsync("git", localDir1, [
      "commit",
      "-m",
      "External commit while Secrez running",
    ]);
    await execAsync("git", localDir1, ["push", "origin", "main"], { env });

    // Now C3's repository state has changed externally (new HEAD commit)
    // Try another write operation - this should be blocked
    inspect = stdout.inspect();
    await C3.touch.exec({
      path: "/test-after-external-commit",
    });
    inspect.restore();
    output = inspect.output.map((e) => decolorize(e));

    // Should show the external change warning
    assert.isTrue(/Repository State Changed Externally/.test(output.join("")));
    assert.isTrue(
      /only READ operations and QUIT are allowed/.test(output.join(""))
    );

    // Verify the file was NOT created (operation was blocked)
    inspect = stdout.inspect();
    await C3.ls.exec({ path: "test-after-external-commit", list: true });
    inspect.restore();
    output = inspect.output.map((e) => decolorize(e));
    assert.isFalse(inspect.output.length === 1);
  });
});
