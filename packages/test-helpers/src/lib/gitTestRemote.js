const path = require("path");
const fs = require("fs-extra");
const { spawn } = require("child_process");
const _ = require("lodash");

function execAsync(cmd, cwd, params) {
  return new Promise((resolve) => {
    const json = {};
    const child = spawn(cmd, params, { cwd });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString("utf8");
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString("utf8");
    });

    child.on("exit", (code) => {
      if (code === 0) {
        json.message = _.trim(stdout);
        json.code = 0;
      } else {
        json.error = _.trim(stderr || stdout);
        json.code = code;
      }
      resolve(json);
    });

    child.on("error", (error) => {
      json.error = _.trim(error.message);
      json.code = 1;
      resolve(json);
    });
  });
}

function assertGitOk(result, context) {
  if (result.error) {
    throw new Error(`${context}: ${result.error}`);
  }
}

async function resetBareRemote(bareRepoPath, commitSha) {
  const result = await execAsync("git", "/", [
    "--git-dir",
    bareRepoPath,
    "update-ref",
    "refs/heads/main",
    commitSha,
  ]);
  assertGitOk(result, "reset bare remote to initial commit");
}

async function cloneFromBareRemote(testDir, bareRepoPath, dirName) {
  const result = await execAsync("git", testDir, [
    "clone",
    bareRepoPath,
    dirName,
  ]);
  assertGitOk(result, `clone ${dirName}`);
}

async function configureGitUser(repoDir) {
  await execAsync("git", repoDir, ["config", "user.name", "Test User"]);
  await execAsync("git", repoDir, ["config", "user.email", "test@example.com"]);
}

/**
 * Creates a local bare git remote with an initial commit produced by prepareBootstrap.
 * Returns paths and the initial commit SHA so tests can reset the remote between runs.
 */
async function createBareRemote(testDir, prepareBootstrap) {
  const bareRepoPath = path.join(testDir, "remote.git");
  const bootstrapDir = path.join(testDir, "bootstrap");

  await fs.emptyDir(testDir);

  let result = await execAsync("git", testDir, [
    "init",
    "--bare",
    "-b",
    "main",
    "remote.git",
  ]);
  assertGitOk(result, "init bare remote");

  await fs.ensureDir(bootstrapDir);
  if (prepareBootstrap) {
    await prepareBootstrap(bootstrapDir);
  }

  result = await execAsync("git", bootstrapDir, ["init", "-b", "main"]);
  assertGitOk(result, "init bootstrap repo");
  await configureGitUser(bootstrapDir);

  result = await execAsync("git", bootstrapDir, ["add", "-A"]);
  assertGitOk(result, "stage bootstrap repo");
  result = await execAsync("git", bootstrapDir, [
    "commit",
    "-m",
    "Initial test repository",
  ]);
  assertGitOk(result, "commit bootstrap repo");

  result = await execAsync("git", bootstrapDir, [
    "remote",
    "add",
    "origin",
    bareRepoPath,
  ]);
  assertGitOk(result, "add bare remote");
  result = await execAsync("git", bootstrapDir, [
    "push",
    "-u",
    "origin",
    "main",
  ]);
  assertGitOk(result, "push to bare remote");

  result = await execAsync("git", bootstrapDir, ["rev-parse", "HEAD"]);
  assertGitOk(result, "read initial commit");

  const initialCommitSha = result.message.trim();
  await fs.remove(bootstrapDir);

  return { bareRepoPath, initialCommitSha };
}

module.exports = {
  assertGitOk,
  resetBareRemote,
  cloneFromBareRemote,
  configureGitUser,
  createBareRemote,
};
