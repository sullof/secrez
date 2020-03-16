const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')
const Node = require('./Node')
const {config, Entry} = require('@secrez/core')

class Tree {

  constructor(secrez) {

    this.statutes = {
      UNLOADED: 0,
      LOADED: 1,
      BROKEN: 2
    }

    if (secrez && secrez.constructor.name === 'Secrez') {
      this.secrez = secrez
      this.dataPath = secrez.config.dataPath
      this.status = this.statutes.UNLOADED
      this.errors = []
    } else {
      throw new Error('Tree requires a Secrez instance during construction')
    }
  }

  async load() {

    if (this.status === this.statutes.LOADED) {
      return
    }

    let allIndexes = []
    let allFiles = []
    let files = await fs.readdir(this.dataPath)
    let warning = 'The database looks corrupted. Execute `fix tree` to fix it.'

    const setWarning = () => {
      if (!this.errors.length || this.errors[0].message !== warning) {
        this.errors[0].unshift({
          type: 'warning',
          message: warning
        })
      }
    }

    for (let file of files) {
      if (/\./.test(file)) {
        continue
      }
      this.notEmpty = true
      try {
        let entry = new Entry({
          encryptedName: file
        })
        if (file[file.length - 1] === 'O') {
          // there is an extraName
          let content = await fs.readFile(file, 'utf8')
          content = content.split('\n')
          if (!content[1]) {
            throw new Error()
          }
          entry.set({
            encryptedName: file.substring(0, 254) + _.trim(content[1])
          })
        }
        let decryptedEntry = this.secrez.decryptEntry(entry)
        if (decryptedEntry.type === config.types.ROOT) {
          let content = await fs.readFile(file, 'utf8')
          entry.set({
            encryptedContent: content.split('\n')[0]
          })
          decryptedEntry = this.secrez.decryptEntry(entry)
          allIndexes.push(decryptedEntry)
        } else {
          allFiles.push(decryptedEntry)
        }
      } catch (e) {
        setWarning()
      }
    }

    if (this.notEmpty) {

      if (!allIndexes.length) {
        setWarning()
      } else {

        allIndexes.sort(Node.sortEntry)
        allFiles.sort(Node.sortEntry)

        let json = allIndexes[0].decryptedContent
        try {
          this.root = Node.fromJSON(JSON.parse(json), allFiles.map(e => e.encryptedName))
        } catch(e) {
          setWarning()
        }
      }

    } else {
      this.root = new Node(
            new Entry({
              type: config.types.ROOT
            })
        )
    }
    this.workingNode = this.root
    this.status = this.statutes.LOADED
  }

  fileExists(file) {
    if (!file || typeof file !== 'string') {
      throw new Error('A valid file name is required')
    }
    return fs.existsSync(path.join(this.dataPath, file))
  }

}

module.exports = Tree
