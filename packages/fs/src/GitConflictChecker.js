const { execAsync } = require("@secrez/utils");
const path = require("path");
const fs = require("fs-extra");

class GitConflictChecker {
  constructor(secrez) {
    this.secrez = secrez;
    this.isGitRepo = null;
    this.remoteStatus = null;
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
      const gitPath = path.join(containerPath, '.git');
      this.isGitRepo = await fs.pathExists(gitPath);
      return this.isGitRepo;
    } catch (e) {
      this.isGitRepo = false;
      return false;
    }
  }

  /**
   * Get the current git status and remote information
   */
  async getGitStatus() {
    if (!await this.isGitRepository()) {
      return null;
    }

    try {
      const containerPath = this.secrez.config.container;

      // Get current branch
      const currentBranch = await execAsync('git', containerPath, ['branch', '--show-current']);
      if (!currentBranch || !currentBranch.message) {
        return null;
      }

      // Fetch latest remote info
      await execAsync('git', containerPath, ['fetch', '--quiet']);

      // Check if origin/main exists
      const remoteExists = await execAsync('git', containerPath, ['rev-parse', '--verify', 'origin/main']);
      if (!remoteExists || !remoteExists.message) {
        return null;
      }

      // Use origin/main as the remote reference
      const remoteRef = 'origin/main';

      // Check if local is behind remote
      const behind = await execAsync('git', containerPath, ['rev-list', '--count', `HEAD..${remoteRef}`]);
      if (!behind || !behind.message) {
        return null;
      }

      // Check if local is ahead of remote
      const ahead = await execAsync('git', containerPath, ['rev-list', '--count', `${remoteRef}..HEAD`]);
      if (!ahead || !ahead.message) {
        return null;
      }

      // Check for uncommitted changes
      const status = await execAsync('git', containerPath, ['status', '--porcelain']);

      return {
        localBranch: currentBranch.message.trim(),
        remoteBranch: remoteRef,
        behind: parseInt(behind.message.trim()) || 0,
        ahead: parseInt(ahead.message.trim()) || 0,
        lastCheck: Date.now()
      };
    } catch (e) {
      // If git commands fail, assume no git repo or no remote
      return null;
    }
  }

  /**
   * Check if there are potential conflicts with remote changes
   */
  async checkForRemoteChanges() {
    const now = Date.now();

    // Skip check if we've checked recently
    if (this.lastCheck && (now - this.lastCheck) < this.checkInterval) {
      return this.remoteStatus;
    }

    this.remoteStatus = await this.getGitStatus();
    this.lastCheck = now;

    return this.remoteStatus;
  }

  /**
   * Determine if there's a risk of conflicts
   */
  hasConflictRisk(status) {
    if (!status) {
      return false;
    }

    // Risk if local is behind remote (remote has new commits that haven't been pulled)
    // This means any local changes will conflict with remote changes
    return status.behind > 0;
  }

  /**
   * Get a user-friendly warning message
   */
  getWarningMessage(status = {}) {
    if (status.behind > 0) {
      return `⚠️  Git Conflict Risk Detected!
      
Your local repository is ${status.behind} commit(s) behind the remote '${status.remoteBranch}' branch.
Any changes you make now could lead to merge conflicts when you try to sync later.

Consider quitting Secrez and running in the container:
  git pull  # to sync with remote changes first

`;
    }

    return null;
  }

  /**
   * Reset the cache (useful for testing or when git status changes)
   */
  resetCache() {
    this.isGitRepo = null;
    this.remoteStatus = null;
    this.lastCheck = null;
  }
}

module.exports = GitConflictChecker;
