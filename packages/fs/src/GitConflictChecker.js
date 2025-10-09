const { execAsync } = require("@secrez/utils");
const path = require("path");
const fs = require("fs-extra");

class GitConflictChecker {
  constructor(secrez) {
    this.secrez = secrez;
    this.isGitRepo = null;
    this.remoteStatus = null;
    this.initialGitState = null; // Initial state captured at account entry
    this.lastCheck = null;
    this.checkInterval = 30000; // 30 seconds between checks
  }

  /**
   * Check if the current directory is a git repository
   */
  async isGitRepository() {
    if (this.isGitRepo !== null) {
      return this.isGitRepo;
    }

    try {
      const containerPath = this.secrez.config.container;
      const gitPath = path.join(containerPath, ".git");
      this.isGitRepo = await fs.pathExists(gitPath);
      return this.isGitRepo;
    } catch (e) {
      this.isGitRepo = false;
      return false;
    }
  }

  /**
   * Capture the initial git state when entering the account
   */
  async captureInitialState() {
    const status = await this.getGitStatus();
    if (status && !status.error) {
      this.initialGitState = this.getGitFingerprint(status);
    }
    return status;
  }

  /**
   * Get a fingerprint of the current git state for comparison
   */
  getGitFingerprint(status) {
    if (!status || status.error) {
      return null;
    }

    // Create a fingerprint based on the repository state
    return {
      localBranch: status.localBranch,
      remoteBranch: status.remoteBranch,
      headCommit: status.headCommit,
      behind: status.behind,
      ahead: status.ahead,
      uncommitted: status.uncommitted,
    };
  }

  /**
   * Check if the repository state has changed since initial capture
   */
  hasRepositoryChanged(currentStatus) {
    if (!this.initialGitState || !currentStatus || currentStatus.error) {
      return false;
    }

    const currentFingerprint = this.getGitFingerprint(currentStatus);
    if (!currentFingerprint) {
      return false;
    }

    // Check if any aspect of the repository has changed
    // Most importantly, check if HEAD commit has changed (e.g., after pull)
    return (
      this.initialGitState.localBranch !== currentFingerprint.localBranch ||
      this.initialGitState.remoteBranch !== currentFingerprint.remoteBranch ||
      this.initialGitState.headCommit !== currentFingerprint.headCommit ||
      this.initialGitState.behind !== currentFingerprint.behind ||
      this.initialGitState.ahead !== currentFingerprint.ahead ||
      this.initialGitState.uncommitted !== currentFingerprint.uncommitted
    );
  }

  /**
   * Get the current git status and remote information
   */
  async getGitStatus() {
    if (!(await this.isGitRepository())) {
      return null;
    }

    try {
      const containerPath = this.secrez.config.container;

      // Get current branch
      const currentBranch = await execAsync("git", containerPath, [
        "branch",
        "--show-current",
      ]);

      if (!currentBranch || !currentBranch.message) {
        return { error: "Could not determine current branch" };
      }

      // Get the HEAD commit hash for tracking changes
      const headCommit = await execAsync("git", containerPath, [
        "rev-parse",
        "HEAD",
      ]);

      if (!headCommit || !headCommit.message) {
        return { error: "Could not determine HEAD commit" };
      }

      // Fetch latest remote info
      const fetchResult = await execAsync("git", containerPath, [
        "fetch",
        "--quiet",
      ]);
      if (fetchResult && fetchResult.error) {
        return { error: `Network error during fetch: ${fetchResult.error}` };
      }

      // Get the HEAD branch from remote
      const remoteInfo = await execAsync("git", containerPath, [
        "remote",
        "show",
        "origin",
      ]);
      let remoteRef;

      if (remoteInfo && remoteInfo.error) {
        return { error: `Could not get remote info: ${remoteInfo.error}` };
      }

      if (remoteInfo && remoteInfo.message) {
        const lines = remoteInfo.message.split("\n");
        for (const line of lines) {
          if (line.includes("HEAD branch:")) {
            const branchName = line.split("HEAD branch:")[1].trim();
            remoteRef = `origin/${branchName}`;
            break;
          }
        }
      }
      // If still no remote ref found, return error
      if (!remoteRef) {
        return { error: "Could not determine remote primary branch" };
      }

      // Verify the remote reference exists
      const remoteExists = await execAsync("git", containerPath, [
        "rev-parse",
        "--verify",
        remoteRef,
      ]);

      if (remoteExists && remoteExists.error) {
        return {
          error: `Remote branch ${remoteRef} does not exist: ${remoteExists.error}`,
        };
      }
      if (!remoteExists || !remoteExists.message) {
        return { error: `Remote branch ${remoteRef} does not exist` };
      }

      // Check if local is behind remote
      const behind = await execAsync("git", containerPath, [
        "rev-list",
        "--count",
        `HEAD..${remoteRef}`,
      ]);
      if (behind && behind.error) {
        return { error: `Could not check if behind remote: ${behind.error}` };
      }
      if (!behind || !behind.message) {
        return { error: "Could not determine if local is behind remote" };
      }

      // Check if local is ahead of remote
      const ahead = await execAsync("git", containerPath, [
        "rev-list",
        "--count",
        `${remoteRef}..HEAD`,
      ]);
      if (ahead && ahead.error) {
        return { error: `Could not check if ahead of remote: ${ahead.error}` };
      }
      if (!ahead || !ahead.message) {
        return { error: "Could not determine if local is ahead of remote" };
      }

      // Check for uncommitted changes
      const status = await execAsync("git", containerPath, [
        "status",
        "--porcelain",
      ]);
      if (status && status.error) {
        return { error: `Could not check git status: ${status.error}` };
      }

      return {
        localBranch: currentBranch.message.trim(),
        remoteBranch: remoteRef,
        headCommit: headCommit.message.trim(),
        behind: parseInt(behind.message.trim()) || 0,
        ahead: parseInt(ahead.message.trim()) || 0,
        uncommitted: status.message
          ? status.message.trim().length > 0
            ? 1
            : 0
          : 0,
        lastCheck: Date.now(),
      };
    } catch (e) {
      // If git commands fail, return error instead of null
      return { error: `Git command failed: ${e.message}` };
    }
  }

  /**
   * Check if there are potential conflicts with remote changes
   */
  async checkForRemoteChanges() {
    const now = Date.now();

    // Skip check if we've checked recently
    if (this.lastCheck && now - this.lastCheck < this.checkInterval) {
      return this.remoteStatus;
    }

    this.remoteStatus = await this.getGitStatus();
    this.lastCheck = now;

    return this.remoteStatus;
  }

  /**
   * Determine if there's a risk of conflicts
   * Returns an object with risk level and details
   */
  hasConflictRisk(status) {
    if (!status) {
      return { hasRisk: false, type: null };
    }

    // Check if repository has changed externally (e.g., pull in another terminal)
    if (this.hasRepositoryChanged(status)) {
      return { hasRisk: true, type: "external_change", allowBypass: false };
    }

    // If there's an error, we should warn the user
    if (status.error) {
      return { hasRisk: true, type: "error", allowBypass: true };
    }

    // Risk if local is behind remote (remote has new commits that haven't been pulled)
    // This means any local changes will conflict with remote changes
    if (status.behind > 0) {
      return { hasRisk: true, type: "behind_remote", allowBypass: true };
    }

    return { hasRisk: false, type: null };
  }

  /**
   * Get a user-friendly warning message
   */
  getWarningMessage(status = {}, riskInfo = {}) {
    // Check for external repository changes first (highest priority)
    if (riskInfo.type === "external_change") {
      return `🚫  Repository State Changed Externally!
      
The git repository state has changed since you entered your account.
This likely means a 'git pull' or other git operation was performed in another terminal.

Secrez cannot safely read these changes while running.
For data integrity, only READ operations and QUIT are allowed.

Please quit Secrez and re-enter your account to sync with the new repository state.`;
    }

    if (status.error) {
      return `⚠️  Git Status Check Failed!
      
The system cannot check git status due to an error:
${status.error}

This could be due to network issues, authentication problems, or repository configuration issues.
Any changes you make now might conflict with remote changes that we cannot detect.`;
    }

    if (status.behind > 0) {
      return `⚠️  Git Conflict Risk Detected!
      
Your local repository is ${status.behind} commit(s) behind the remote '${status.remoteBranch}' branch.
Any changes you make now could lead to merge conflicts when you try to sync later.

Consider quitting Secrez and running in the container:
  git pull  # to sync with remote changes first`;
    }

    return null;
  }

  /**
   * Reset the cache (useful for testing or when git status changes)
   */
  resetCache() {
    this.isGitRepo = null;
    this.remoteStatus = null;
    this.initialGitState = null;
    this.lastCheck = null;
  }
}

module.exports = GitConflictChecker;
