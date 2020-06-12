class Ls extends require('../Command') {

  setHelpAndCompletion() {
    this.cliConfig.completion.ls = {
      _func: this.pseudoFileCompletion(this),
      _self: this
    }
    this.cliConfig.completion.help.ls = true
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
        name: 'list',
        alias: 'l',
        type: Boolean
      },
      {
        name: 'all',
        alias: 'a',
        type: Boolean
      },
      {
        name: 'datasets',
        alias: 'd',
        type: Boolean
      }
    ]
  }

  help() {
    return {
      description: ['Browses the directories.'],
      examples: [
        'ls coin',
        'ls ../passwords',
        'ls ~',
        ['ls -al', 'Includes hidden files'],
        ['ls -d', 'Lists the existent datasets']
      ]
    }
  }

  async ls(options) {
    if (options.datasets) {
      let datasetInfo = await this.internalFs.getDatasetsInfo()
      return datasetInfo.map(e => e.name)
    } else {
      return await this.internalFs.pseudoFileCompletion(options.path || '.', true)
    }
  }

  async exec(options = {}) {
    if (options.help) {
      return this.showHelp()
    }
    try {
      let list = await this.ls(options)
      list = list.filter(e => !/^\./.test(e) || options.all)
      if (list.length) {
        this.Logger.reset(options.list
            ? list.join('\n')
            : this.prompt.commandPrompt.formatList(list, 26, true, this.threeRedDots())
        )
      } else {
        this.Logger.grey('No files found.')
      }
    } catch (e) {
      this.Logger.red(e.message)
    }
    this.prompt.run()
  }
}

module.exports = Ls


