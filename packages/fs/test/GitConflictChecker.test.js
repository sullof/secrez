const { expect, assert } = require("chai");
const path = require("path");
const fs = require("fs-extra");
const { execAsync } = require("@secrez/utils");
const Secrez = require("@secrez/core").Secrez(Math.random());
const InternalFs = require("../src/InternalFs");
require("dotenv").config({ quiet: true });

describe("#GitConflictChecker", function () {
  let testDir;
  let localDir1;
  let localDir2;
  let originalContainer;
  let testSecrez;
  let testInternalFs;
  let tempSshKeyPath;
  const testRepoUrl = process.env.SECREZ_TEST_REPO_URL;

  before(async function () {
    testDir = path.resolve(__dirname, "../tmp/test-git");
    localDir1 = path.join(testDir, "local1");
    localDir2 = path.join(testDir, "local2");
    tempSshKeyPath = path.join(testDir, "temp_ssh_key");

    await fs.emptyDir(testDir);

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
    await fs.chmod(tempSshKeyPath, 0o600); // Set proper permissions for SSH key
  });

  beforeEach(async function () {
    // Create a fresh Secrez instance for each test
    testSecrez = new Secrez();
    await testSecrez.init(path.join(testDir, ".secrez"));
    testInternalFs = new InternalFs(testSecrez);
    await testInternalFs.init();
  });

  after(async function () {
    // Clean up test directory - each test is now independent so no need for complex cleanup
    await fs.remove(testDir);
  });

  it("should detect non-git repository", async function () {
    const isGit = await testInternalFs.gitConflictChecker.isGitRepository();
    assert.isFalse(isGit);
  });

  it("should return null status for non-git repository", async function () {
    const status =
      await testInternalFs.gitConflictChecker.checkForRemoteChanges();
    assert.isNull(status);
  });

  it("should not detect conflict risk in non-git repository", async function () {
    const status =
      await testInternalFs.gitConflictChecker.checkForRemoteChanges();
    const riskInfo = testInternalFs.gitConflictChecker.hasConflictRisk(status);
    assert.isFalse(riskInfo.hasRisk);
  });

  describe("with real GitHub repository", function () {
    beforeEach(async function () {
      this.timeout(10000);

      // Clean up existing directories
      await fs.remove(localDir1);
      await fs.remove(localDir2);

      // Clone fresh repositories
      const env = {
        ...process.env,
        GIT_SSH_COMMAND: `ssh -i ${tempSshKeyPath} -o StrictHostKeyChecking=no`,
      };
      await execAsync("git", testDir, ["clone", testRepoUrl, "local1"], {
        env,
      });
      await execAsync("git", testDir, ["clone", testRepoUrl, "local2"], {
        env,
      });

      // Configure git in both repos
      for (const dir of [localDir1, localDir2]) {
        await execAsync("git", dir, ["config", "user.name", "Test User"]);
        await execAsync("git", dir, [
          "config",
          "user.email",
          "test@example.com",
        ]);
      }
    });

    afterEach(async function () {
      this.timeout(15000); // Increase timeout for git cleanup operations

      // Clean up any changes made during the test to restore the repository to its original state
      try {
        const env = {
          ...process.env,
          GIT_SSH_COMMAND: `ssh -i ${tempSshKeyPath} -o StrictHostKeyChecking=no`,
        };

        // Check if any test files were created and collect them for removal
        const testFiles = [
          "test-remote-change.txt",
          "remote-change.txt",
          "conflict-test.txt",
        ];
        const filesToRemove = [];

        for (const testFile of testFiles) {
          const filePath = path.join(localDir1, testFile);
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            filesToRemove.push(testFile);
          }
        }

        // If we have files to remove, perform a single add/commit/push operation
        if (filesToRemove.length > 0) {
          await execAsync("git", localDir1, ["add", ...filesToRemove]);
          await execAsync("git", localDir1, [
            "commit",
            "-m",
            "Test cleanup: Remove temporary test files",
          ]);
          await execAsync("git", localDir1, ["push", "origin", "main"], {
            env,
          });
        }

        // Restore original container path
        if (originalContainer) {
          testSecrez.config.container = originalContainer;
        }
      } catch (error) {
        console.warn("Test cleanup failed:", error.message);
      }
    });

    it("should detect git repository", async function () {
      // Test with localDir1 (first clone)
      originalContainer = testSecrez.config.container;
      testSecrez.config.container = localDir1;

      // Reset cache to force re-check
      testInternalFs.gitConflictChecker.resetCache();

      const isGit = await testInternalFs.gitConflictChecker.isGitRepository();
      assert.isTrue(isGit);
    });

    it("should get git status when up to date with remote", async function () {
      this.timeout(10000); // Increase timeout for git operations

      // Test with localDir1 - should be up to date initially
      testSecrez.config.container = localDir1;

      // Reset cache to force re-check
      testInternalFs.gitConflictChecker.resetCache();

      const status =
        await testInternalFs.gitConflictChecker.checkForRemoteChanges();
      assert.isNotNull(status);
      assert.equal(status.localBranch, "main");
      assert.equal(status.remoteBranch, "origin/main");
      assert.equal(status.behind, 0); // Should be up to date initially
      assert.equal(status.ahead, 0);

      const riskInfo = testInternalFs.gitConflictChecker.hasConflictRisk(status);
      assert.isFalse(riskInfo.hasRisk);
    });

    it("should detect conflict risk when behind remote", async function () {
      this.timeout(15000);

      const tempFileName = "test-remote-change.txt";
      const env = {
        ...process.env,
        GIT_SSH_COMMAND: `ssh -i ${tempSshKeyPath} -o StrictHostKeyChecking=no`,
      };

      // Make a change in localDir1 and push to remote
      await fs.writeFile(
        path.join(localDir1, tempFileName),
        "Remote change for testing"
      );
      await execAsync("git", localDir1, ["add", tempFileName]);
      await execAsync("git", localDir1, [
        "commit",
        "-m",
        "Test: Remote change for conflict detection",
      ]);
      await execAsync("git", localDir1, ["push", "origin", "main"], { env });

      // Now test with localDir2 - should be behind
      testSecrez.config.container = localDir2;

      // Reset cache to force re-check
      testInternalFs.gitConflictChecker.resetCache();

      // Test the conflict detection logic with a mock status that simulates being behind
      const mockStatus = {
        localBranch: "main",
        remoteBranch: "origin/main",
        behind: 1,
        ahead: 0,
      };

      const riskInfo =
        testInternalFs.gitConflictChecker.hasConflictRisk(mockStatus);
      assert.isTrue(riskInfo.hasRisk);

      // Test the actual git status - localDir2 should be behind after the push from localDir1
      const status =
        await testInternalFs.gitConflictChecker.checkForRemoteChanges();
      assert.isNotNull(status);

      assert.isNumber(status.behind);
      assert.isNumber(status.ahead);

      // localDir2 should be behind because it hasn't merged the remote changes yet
      // This is the correct behavior - fetch updates the remote refs but doesn't merge
      const actualRiskInfo =
        testInternalFs.gitConflictChecker.hasConflictRisk(status);

      // If there's an error, that's also a valid reason for conflict risk
      if (status.error) {
        assert.isTrue(actualRiskInfo.hasRisk); // Error should indicate conflict risk
      } else {
        // localDir2 is behind remote, so there should be conflict risk
        assert.isTrue(actualRiskInfo.hasRisk); // Should be true because localDir2 is behind remote
        assert.isTrue(status.behind > 0); // Should be behind the remote
      }
    });

    it("should get warning message for conflict risk", async function () {
      // Test the warning message format
      const mockStatus = {
        localBranch: "main",
        remoteBranch: "origin/main",
        behind: 2,
        ahead: 0,
      };

      const riskInfo = testInternalFs.gitConflictChecker.hasConflictRisk(mockStatus);
      const message =
        testInternalFs.gitConflictChecker.getWarningMessage(mockStatus, riskInfo);
      assert.isString(message);
      assert.include(message, "Git Conflict Risk Detected");
      assert.include(message, "2 commit(s) behind");
    });

    it("should not show alert again after user proceeds", async function () {
      this.timeout(10000); // Increase timeout for git operations

      // Test with localDir1 - should be up to date
      testSecrez.config.container = localDir1;

      // Reset cache to force re-check
      testInternalFs.gitConflictChecker.resetCache();

      const status =
        await testInternalFs.gitConflictChecker.checkForRemoteChanges();
      assert.isNotNull(status);
      assert.isNumber(status.behind);

      const riskInfo = testInternalFs.gitConflictChecker.hasConflictRisk(status);
      // Should be up to date, so no risk
      assert.isFalse(riskInfo.hasRisk);

      // Simulate user proceeding (this would normally be handled by the command)
      // The cache should prevent showing the alert again for a while
      const status2 =
        await testInternalFs.gitConflictChecker.checkForRemoteChanges();
      assert.isNotNull(status2);
      assert.equal(status2.behind, status.behind); // Should be the same as first check
    });


    it("should reset cache", function () {
      testInternalFs.gitConflictChecker.resetCache();
      assert.isNull(testInternalFs.gitConflictChecker.isGitRepo);
      assert.isNull(testInternalFs.gitConflictChecker.remoteStatus);
      assert.isNull(testInternalFs.gitConflictChecker.initialGitState);
      assert.isNull(testInternalFs.gitConflictChecker.lastCheck);
    });

    afterEach(function () {
      // Restore original container path
      if (originalContainer) {
        testSecrez.config.container = originalContainer;
      }
    });
  });
});
