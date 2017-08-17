/* globals Promise */


const _ = require('lodash')
const chalk = require('chalk')

const pkg = require('../../package')
const Secrez = require('../../lib/Secrez')
const Welcome = require('./Welcome')
const Home = require('./Home')

class Commands {

  constructor() {
    let datadir
    this.secrez = new Secrez(datadir)
  }

  start() {
    console.log(
        chalk.bold(
            '\n\nsecrez v' + pkg.version
        )
    )
    return this.secrez.init()
        .then(() => new Welcome(this.secrez).start(this.home))
        .then(() => new Home(this.secrez).menu())

  }

}

module.exports = new Commands