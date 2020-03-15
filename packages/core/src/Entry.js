const _ = require('lodash')

class Entry {

  isValid(option) {
    return this.validOptions.includes(option)
  }

  constructor(options) {

    this.validOptions = [
      'type',
      'id',
      'ts',
      'scrambledTs',
      'name',
      'content',
      'encryptedName',
      'encryptedContent',
      'extraName',
      'nameId',
      'nameTs',
      'preserveContent'
    ]

    this.set(options)
  }

  get(options = this.validOptions) {
    let obj = {}
    for (let o of options) {
      if (this.isValid(o) && typeof this[o] !== 'undefined') {
        obj[o] = this[o]
      }
    }
    return obj
  }

  set(options = {}) {
    for (let o in options) {
      if (this.isValid(o) && typeof options[o] !== 'undefined') {
        this[o] = options[o]
      }
    }
  }

  unset(options = []) {
    if (!Array.isArray(options)) {
      options = [options]
    }
    for (let o of options) {
      if (this.isValid(o) && typeof this[o] !== 'undefined') {
        delete this[o]
      }
    }
  }

}


module.exports = Entry
