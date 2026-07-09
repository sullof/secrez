class SigintManager {
  constructor() {
    this.prompts = [];
    this.siginted = false;
    this.lastCalled = Date.now();
    this.started = false;
  }

  start() {
    if (!this.started && process.env.NODE_ENV !== "test") {
      process.on("SIGINT", async () => {
        await this.onSigint();
      });
      this.started = true;
    }
  }

  async onSigint() {
    this.siginted = true;
    if (Date.now() - this.lastCalled < 500) {
      const prompt = this.prompts.find((p) => p.secrez);
      if (prompt?.secrez?.masterKeyHash) {
        prompt.secrez.signout();
      }
      // eslint-disable-next-line no-process-exit
      process.exit(0);
    }
    console.info("To exit, type quit or press ^C two times");
    this.lastCalled = Date.now();
    return this.prompts[this.prompts.length - 1].run();
  }

  async setPosition(prompt) {
    this.prompts.push(prompt);
    let runNow;
    if (this.siginted && prompt.context === 0) {
      this.siginted = false;
      runNow = true;
    }
    return {
      position: this.prompts.length - 1,
      runNow,
    };
  }
}

module.exports = new SigintManager();
