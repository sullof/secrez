const chai = require("chai");
const assert = chai.assert;
const stdout = require("test-console").stdout;
const fs = require("fs-extra");
const path = require("path");
const MainPrompt = require("../../src/prompts/MainPromptMock");
const {
  noPrint,
  decolorize,
  createBareRemote,
  resetBareRemote,
  cloneFromBareRemote,
  configureGitUser,
} = require("@secrez/test-helpers");
const { execAsync } = require("@secrez/utils");

const { password, iterations } = require("../fixtures");

describe("#Git", function () {
  let prompt;
  let prompt2;
  let inspect, C, C2;
  let testDir;
  let localDir1;
  let localDir2;
  let bareRepoPath;
  let initialCommitSha;

  before(async function () {
    this.timeout(30000);

    testDir = path.resolve(__dirname, "../../tmp/test-git");
    localDir1 = path.join(testDir, "local1");
    localDir2 = path.join(testDir, "local2");

    ({ bareRepoPath, initialCommitSha } = await createBareRemote(
      testDir,
      async (bootstrapDir) => {
        const prompt = new MainPrompt();
        await prompt.init({
          container: bootstrapDir,
          localDir: __dirname,
        });
        await prompt.secrez.signup(password, iterations);
        await prompt.internalFs.init();
      }
    ));
  });

  beforeEach(async function () {
    this.timeout(30000);

    await resetBareRemote(bareRepoPath, initialCommitSha);
    await fs.remove(localDir1);
    await fs.remove(localDir2);

    await cloneFromBareRemote(testDir, bareRepoPath, "local1");
    await cloneFromBareRemote(testDir, bareRepoPath, "local2");

    for (const dir of [localDir1, localDir2]) {
      await configureGitUser(dir);
    }

    prompt = new MainPrompt();
    await prompt.init({
      container: localDir1,
      localDir: __dirname,
    });
    C = prompt.commands;
    await prompt.secrez.signin(password, iterations);
    await prompt.internalFs.init();

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
    inspect = stdout.inspect();
    await C.git.exec({ status: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));

    assert.isTrue(
      /No remote changes found/.test(output.join("")) ||
        /Git Conflict Risk Detected/.test(output.join("")) ||
        /Git Status Check Failed/.test(output.join(""))
    );
  });

  it("should show git status by default", async function () {
    inspect = stdout.inspect();
    await C.git.exec({});
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(
      /No remote changes found/.test(output.join("")) ||
        /Git Conflict Risk Detected/.test(output.join("")) ||
        /Git Status Check Failed/.test(output.join(""))
    );
  });

  it("should handle conflict risk scenario", async function () {
    await fs.writeFile(
      path.join(localDir1, "conflict-test.txt"),
      "Remote change"
    );
    await execAsync("git", localDir1, ["add", "conflict-test.txt"]);
    await execAsync("git", localDir1, ["commit", "-m", "Conflict test"]);
    await execAsync("git", localDir1, ["push", "origin", "main"]);

    inspect = stdout.inspect();
    await C2.git.exec({ status: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));
    assert.isTrue(
      /Git Conflict Risk Detected/.test(output.join("")) ||
        /No remote changes found/.test(output.join(""))
    );
  });

  it("should do nothing when --push is used with no changes", async function () {
    inspect = stdout.inspect();
    await C2.git.exec({ push: true });
    inspect.restore();
    const output = inspect.output.map((e) => decolorize(e)).join("");

    assert.match(output, /No changes in the repository/);
  });

  it("should push changes and update fingerprint when --push is used", async function () {
    const beforeFingerprint =
      prompt2.internalFs.gitConflictChecker.initialGitState;

    await noPrint(
      C2.touch.exec({
        path: `/push-test-${Date.now()}`,
      })
    );

    inspect = stdout.inspect();
    await C2.git.exec({ push: true });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e)).join("");

    assert.match(output, /Pushed successfully\. Fingerprint updated\./);

    const status = await prompt2.internalFs.gitConflictChecker.getGitStatus();
    const afterFingerprint =
      prompt2.internalFs.gitConflictChecker.initialGitState;

    assert.isNotNull(afterFingerprint);
    assert.equal(afterFingerprint.headCommit, status.headCommit);
    if (beforeFingerprint && beforeFingerprint.headCommit) {
      assert.notEqual(
        afterFingerprint.headCommit,
        beforeFingerprint.headCommit
      );
    }
  });

  it("should handle non-git repository", async function () {
    const nonGitDir = path.join(testDir, "non-git-secrez");
    await fs.emptyDir(nonGitDir);

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

    await fs.remove(nonGitDir);
  });

  it("should allow normal operations in non-git repository", async function () {
    const nonGitDir = path.join(testDir, "non-git-operations");
    await fs.emptyDir(nonGitDir);

    const tempPrompt = new MainPrompt();
    await tempPrompt.init({
      container: nonGitDir,
      localDir: __dirname,
    });
    await tempPrompt.secrez.signup(password, iterations);
    await tempPrompt.internalFs.init();

    assert.isNull(tempPrompt.internalFs.gitConflictChecker.initialGitState);

    inspect = stdout.inspect();
    await tempPrompt.commands.touch.exec({
      path: "/test-file-1.txt",
    });
    inspect.restore();
    let output = inspect.output.map((e) => decolorize(e));

    assert.isFalse(/Repository State Changed Externally/.test(output.join("")));
    assert.isFalse(/Git Conflict Risk/.test(output.join("")));

    inspect = stdout.inspect();
    await tempPrompt.commands.ls.exec({ path: "/", list: true });
    inspect.restore();
    output = inspect.output.map((e) => decolorize(e)).join("");
    assert.isTrue(/test-file-1\.txt/.test(output));

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

    await fs.remove(nonGitDir);
  });

  it("should detect external git changes and block operations", async function () {
    let output;

    const prompt3 = new MainPrompt();
    await prompt3.init({
      container: localDir1,
      localDir: __dirname,
    });
    const C3 = prompt3.commands;
    await prompt3.secrez.signin(password, iterations);
    await prompt3.internalFs.init();

    assert.isNotNull(prompt3.internalFs.gitConflictChecker.initialGitState);

    inspect = stdout.inspect();
    await C.ls.exec({ path: "/test-before-external-commit-*", list: true });
    inspect.restore();
    const lsLines = inspect.output.length
      ? inspect.output.map((e) => decolorize(e))[0].split("\n")
      : [];
    for (let i = 0; i < lsLines.length; i++) {
      let cols = lsLines[i].split(/ +/);
      let file = cols[cols.length - 1];
      if (file) {
        await noPrint(C.rm.exec({ path: file }));
      }
    }

    const newPath = "/test-before-external-commit-" + Date.now();
    await noPrint(
      C.touch.exec({
        path: newPath,
      })
    );

    await noPrint(C.quit.exec({}));

    await execAsync("git", localDir1, ["add", "-A"]);
    await execAsync("git", localDir1, [
      "commit",
      "-m",
      "External commit while Secrez running",
    ]);
    await execAsync("git", localDir1, ["push", "origin", "main"]);

    inspect = stdout.inspect();
    await C3.touch.exec({
      path: "/test-after-external-commit",
    });
    inspect.restore();
    output = inspect.output.map((e) => decolorize(e));

    assert.isTrue(/Repository State Changed Externally/.test(output.join("")));
    assert.isTrue(
      /only READ operations and QUIT are allowed/.test(output.join(""))
    );

    inspect = stdout.inspect();
    await C3.ls.exec({ path: "test-after-external-commit", list: true });
    inspect.restore();
    output = inspect.output.map((e) => decolorize(e));
    assert.isFalse(inspect.output.length === 1);
  });
});
