const {execSync} = require('child_process')

class Bash extends require('../Command') {

  setHelpAndCompletion() {
    this.cliConfig.completion.bash = {
      _self: this
    }
    this.cliConfig.completion.help.bash = true
    this.optionDefinitions = [
      {
        name: 'help',
        alias: 'h',
        type: Boolean
      },
      {
        name: 'command',
        alias: 'c',
        type: String,
        defaultOption: true
      }
    ]
  }

  help() {
    return {
      description: ['Execute a bash command in the current disk folder.'],
      examples: [
        'bash "ls"',
        ['bash "mv wallet1 wallet2"', 'renames an external file'],
        ['bash', 'asks to type the command to execute']
      ]
    }
  }

  async bash(options) {
    let pwd = await this.prompt.commands.lpwd.lpwd()
    if (!options.command) {
      options.command = await this.useInput(Object.assign(options, {
        message: 'Type the command'
      }))
    }
    return execSync(`cd ${pwd} && ${options.command}`).toString()
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp()
    }
    try {
      this.validate(options)
      this.Logger.reset(await this.bash(options))
    } catch (e) {
      this.Logger.red(e.message)
    }
    await this.prompt.run()
  }
}

module.exports = Bash


