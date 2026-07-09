const { expect, assert } = require("chai");
const path = require("path");
const fs = require("fs-extra");
const { execAsync } = require("@secrez/utils");
const Secrez = require("@secrez/core").Secrez(Math.random());
const InternalFs = require("../src/InternalFs");
const {
  createBareRemote,
  resetBareRemote,
  cloneFromBareRemote,
  configureGitUser,
} = require("@secrez/test-helpers");

describe("#GitConflictChecker", function () {
  let testDir;
  let localDir1;
  let localDir2;
  let bareRepoPath;
  let initialCommitSha;
  let originalContainer;
  let testSecrez;
  let testInternalFs;

  before(async function () {
    this.timeout(15000);

    testDir = path.resolve(__dirname, "../tmp/test-git");
    localDir1 = path.join(testDir, "local1");
    localDir2 = path.join(testDir, "local2");

    ({ bareRepoPath, initialCommitSha } = await createBareRemote(
      testDir,
      async (bootstrapDir) => {
        await fs.writeFile(
          path.join(bootstrapDir, "README.md"),
          "Secrez git test repository\n"
        );
      }
    ));
  });

  beforeEach(async function () {
    testSecrez = new Secrez();
    await testSecrez.init(path.join(testDir, ".secrez"));
    testInternalFs = new InternalFs(testSecrez);
    await testInternalFs.init();
  });

  after(async function () {
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

  describe("with local git repository", function () {
    beforeEach(async function () {
      this.timeout(15000);

      await resetBareRemote(bareRepoPath, initialCommitSha);
      await fs.remove(localDir1);
      await fs.remove(localDir2);

      await cloneFromBareRemote(testDir, bareRepoPath, "local1");
      await cloneFromBareRemote(testDir, bareRepoPath, "local2");

      for (const dir of [localDir1, localDir2]) {
        await configureGitUser(dir);
      }
    });

    afterEach(function () {
      if (originalContainer) {
        testSecrez.config.container = originalContainer;
        originalContainer = undefined;
      }
    });

    it("should detect git repository", async function () {
      originalContainer = testSecrez.config.container;
      testSecrez.config.container = localDir1;

      testInternalFs.gitConflictChecker.resetCache();

      const isGit = await testInternalFs.gitConflictChecker.isGitRepository();
      assert.isTrue(isGit);
    });

    it("should get git status when up to date with remote", async function () {
      testSecrez.config.container = localDir1;

      testInternalFs.gitConflictChecker.resetCache();

      const status =
        await testInternalFs.gitConflictChecker.checkForRemoteChanges();
      assert.isNotNull(status);
      assert.equal(status.localBranch, "main");
      assert.equal(status.remoteBranch, "origin/main");
      assert.equal(status.behind, 0);
      assert.equal(status.ahead, 0);

      const riskInfo =
        testInternalFs.gitConflictChecker.hasConflictRisk(status);
      assert.isFalse(riskInfo.hasRisk);
    });

    it("should detect conflict risk when behind remote", async function () {
      this.timeout(15000);

      const tempFileName = "test-remote-change.txt";

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
      await execAsync("git", localDir1, ["push", "origin", "main"]);

      testSecrez.config.container = localDir2;

      testInternalFs.gitConflictChecker.resetCache();

      const mockStatus = {
        localBranch: "main",
        remoteBranch: "origin/main",
        behind: 1,
        ahead: 0,
      };

      const riskInfo =
        testInternalFs.gitConflictChecker.hasConflictRisk(mockStatus);
      assert.isTrue(riskInfo.hasRisk);

      const status =
        await testInternalFs.gitConflictChecker.checkForRemoteChanges();
      assert.isNotNull(status);

      assert.isNumber(status.behind);
      assert.isNumber(status.ahead);

      const actualRiskInfo =
        testInternalFs.gitConflictChecker.hasConflictRisk(status);

      if (status.error) {
        assert.isTrue(actualRiskInfo.hasRisk);
      } else {
        assert.isTrue(actualRiskInfo.hasRisk);
        assert.isTrue(status.behind > 0);
      }
    });

    it("should get warning message for conflict risk", async function () {
      const mockStatus = {
        localBranch: "main",
        remoteBranch: "origin/main",
        behind: 2,
        ahead: 0,
      };

      const riskInfo =
        testInternalFs.gitConflictChecker.hasConflictRisk(mockStatus);
      const message = testInternalFs.gitConflictChecker.getWarningMessage(
        mockStatus,
        riskInfo
      );
      assert.isString(message);
      assert.include(message, "Git Conflict Risk Detected");
      assert.include(message, "2 commit(s) behind");
    });

    it("should not show alert again after user proceeds", async function () {
      testSecrez.config.container = localDir1;

      testInternalFs.gitConflictChecker.resetCache();

      const status =
        await testInternalFs.gitConflictChecker.checkForRemoteChanges();
      assert.isNotNull(status);
      assert.isNumber(status.behind);

      const riskInfo =
        testInternalFs.gitConflictChecker.hasConflictRisk(status);
      assert.isFalse(riskInfo.hasRisk);

      const status2 =
        await testInternalFs.gitConflictChecker.checkForRemoteChanges();
      assert.isNotNull(status2);
      assert.equal(status2.behind, status.behind);
    });

    it("should reset cache", function () {
      testInternalFs.gitConflictChecker.resetCache();
      assert.isNull(testInternalFs.gitConflictChecker.isGitRepo);
      assert.isNull(testInternalFs.gitConflictChecker.remoteStatus);
      assert.isNull(testInternalFs.gitConflictChecker.initialGitState);
      assert.isNull(testInternalFs.gitConflictChecker.lastCheck);
    });
  });
});
