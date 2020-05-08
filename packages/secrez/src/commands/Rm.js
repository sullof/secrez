const chalk = require('chalk')

class Rm extends require('../Command') {

  setHelpAndCompletion() {
    this.cliConfig.completion.rm = {
      _func: this.pseudoFileCompletion(this),
      _self: this
    }
    this.cliConfig.completion.help.rm = true
    this.optionDefinitions = [
      {
        name: 'help',
        alias: 'h',
        type: Boolean
      },
      {
        name: 'path',
        alias: 'p',
        defaultOption: true,
        type: String
      },
      {
        name: 'version',
        alias: 'v',
        multiple: true,
        type: String
      }
    ]
  }

  help() {
    return {
      description: ['Removes a file or a single version of a file.',
        'Since in Secrez files are immutable, the file is not deleted,',
        'it is move to the hidden folder .trash, where it remains visible.',
        'Wildcards are not supported with rm to limit involuntary deletes.'
      ],
      examples: [
        'rm secret1',
        'rm secret2 -v 9Gcp,8hYU'
      ]
    }
  }

  async rm(options) {
    let nodes = await this.internalFs.pseudoFileCompletion(options.path, null, true)
    let deleted = []
    this.tree.disableSave()
    for (let node of nodes) {
      let result = await this.internalFs.remove(options, node)
      if (result.length) {
        deleted = deleted.concat(result)
      }
    }
    this.tree.enableSave()
    if (deleted.length) {
      this.tree.save()
    }
    return deleted
  }

  formatResult(item) {
    return [chalk.yellow(item.version), item.name].join(' ')
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp()
    }
    if (!options.path) {
      this.Logger.red('File path not specified.')
    } else if (options.version && /\?|\*/.test(options.path)) {
      this.Logger.red('Wildcards not supported when version is specified.')
    } else {
      try {
        let deleted = await this.rm(options)
        if (deleted.length) {
          this.Logger.agua('Deleted entries:')
          this.Logger.grey(deleted.map(e => this.formatResult(e)).join('\n'))
        } else {
          this.Logger.red('Target files not found.')
        }
      } catch (e) {
        this.Logger.red(e.message)
      }
    }
    this.prompt.run()
  }
}

module.exports = Rm


