const chai = require('chai')
const assert = chai.assert
const fs = require('fs-extra')
const path = require('path')
const {Secrez} = require('@secrez/core')
const Node = require('../src/Node')
const Tree = require('../src/Tree')
const InternalFs = require('../src/InternalFs')

// eslint-disable-next-line no-unused-vars
const jlog = require('./helpers/jlog')

const {
  password,
  iterations
} = require('./fixtures')

describe('#Tree', function () {

  let secrez
  let rootDir = path.resolve(__dirname, '../tmp/test/.secrez')
  let tree
  let internalFs

  describe('#constructor', async function () {

    before(async function () {
      await fs.emptyDir(path.resolve(__dirname, '../tmp/test'))
      secrez = new Secrez()
      await secrez.init(rootDir)
    })

    it('should instantiate the Tree', async function () {

      tree = new Tree(secrez)
      assert.equal(tree.status, Tree.statutes.UNLOADED)

    })

    it('should throw if passing not an Secrez instance', async function () {

      try {
        new Tree(new Object())
        assert.isFalse(true)
      } catch (e) {
        assert.equal(e.message, 'Tree requires a Secrez instance during construction')
      }

    })

  })

  describe('#load', async function () {

    before(async function () {
      await fs.emptyDir(path.resolve(__dirname, '../tmp/test'))
      secrez = new Secrez()
      await secrez.init(rootDir)
    })

    it('should load an empty Tree', async function () {

      tree = new Tree(secrez)
      await tree.load()
      assert.equal(tree.status, Tree.statutes.LOADED)
      assert.equal(Node.isRoot(tree.root), true)

    })

    it('should do nothing if already loaded', async function () {

      tree = new Tree(secrez)
      await tree.load(rootDir)
      await tree.load(rootDir)
      assert.equal(tree.status, Tree.statutes.LOADED)

    })

  })

  describe('getEntryDetails', async function () {

    beforeEach(async function () {
      await fs.emptyDir(path.resolve(__dirname, '../tmp/test'))
      secrez = new Secrez()
      await secrez.init(rootDir)
      await secrez.signup(password, iterations)
      internalFs = new InternalFs(secrez)
      await internalFs.init()
    })

    it('should return the entry details of a node', async function () {
      let content = 'PIN: 1234'
      let file2 = await internalFs.make({
        path: 'file2',
        type: secrez.config.types.TEXT,
        content
      })

      let id = file2.id
      let file2Entry = await internalFs.tree.getEntryDetails(file2)
      assert.equal(file2Entry.content, content)

      internalFs = new InternalFs(secrez)
      await internalFs.init()

      file2 = internalFs.tree.root.findChildById(id)
      file2Entry = await internalFs.tree.getEntryDetails(file2)
      assert.equal(file2Entry.content, content)
    })

  })


  describe('#Fix', function () {

    let rootDir = path.resolve(__dirname, '../tmp/test/.secrez')
    let internalFs

    beforeEach(async function () {
      await fs.emptyDir(path.resolve(__dirname, '../tmp/test'))
    })

    let signedUp = false

    async function startTree() {
      secrez = new Secrez()
      await secrez.init(rootDir)
      if (signedUp) {
        await secrez.signin(password, iterations)
      } else {
        await secrez.signup(password, iterations)
        signedUp = true
      }
      internalFs = new InternalFs(secrez)
      await internalFs.init()
      tree = internalFs.tree
    }

    it('should simulate a conflict in the repo and recover lost entries', async function () {

      await startTree()

      let files0 = await fs.readdir(`${rootDir}/data`)
      assert.equal(files0.length, 0)

      let backup = path.resolve(__dirname, '../../tmp/test/backup')
      await fs.emptyDir(backup)

      await internalFs.make({
        path: '/A/M',
        type: secrez.config.types.DIR
      })
      await internalFs.make({
        path: '/A/C',
        type: secrez.config.types.DIR
      })

      await internalFs.make({
        path: '/A/a',
        type: secrez.config.types.TEXT,
        content: 'some a'
      })

      await internalFs.make({
        path: '/B/b',
        type: secrez.config.types.TEXT,
        content: 'some b'
      })

      let files1 = await fs.readdir(`${rootDir}/data`)
      assert.equal(files1.length, 7)

      await startTree()

      await internalFs.make({
        path: '/B/D/g',
        type: secrez.config.types.TEXT,
        content: 'some g'
      })

      await internalFs.make({
        path: '/E/c',
        type: secrez.config.types.TEXT,
        content: 'some c'
      })

      await internalFs.make({
        path: '/E/L/N',
        type: secrez.config.types.DIR
      })

      let files2 = await fs.readdir(`${rootDir}/data`)
      assert.equal(files2.length, 14)

      let files3 = []

      for (let f of files2) {
        if (!files1.includes(f)) {
          files3.push(f)
          await fs.move(`${rootDir}/data/${f}`, `${backup}/${f}`)
        }
      }

      await startTree()

      await internalFs.make({
        path: '/B/D/g',
        type: secrez.config.types.TEXT,
        content: 'some g2'
      })

      await internalFs.make({
        path: '/E/F/d',
        type: secrez.config.types.TEXT,
        content: 'some d'
      })

      await internalFs.make({
        path: '/E/c',
        type: secrez.config.types.TEXT,
        content: 'some c'
      })

      for (let f of files3) {
        await fs.move(`${backup}/${f}`, `${rootDir}/data/${f}`)
      }

      await startTree()
      // jlog(tree.alerts)

      assert.equal(tree.alerts.length, 4)
      assert.equal(tree.alerts[1], '/B/D/g')
      assert.equal(tree.alerts[2], '/E/L')
      assert.equal(tree.alerts[3], '/E/L/N')

      const deleteds = Node.getTrash(tree.root).children
      assert.equal(Object.keys(deleteds).length, 3)

    })

    it('should simulate a lost index in the repo and recover the entries', async function () {

      signedUp = false

      await startTree()

      await internalFs.make({
        path: '/A/M',
        type: secrez.config.types.DIR
      })
      await internalFs.make({
        path: '/A/C',
        type: secrez.config.types.DIR
      })

      await internalFs.make({
        path: '/A/a',
        type: secrez.config.types.TEXT,
        content: 'some a'
      })

      await internalFs.make({
        path: '/B/b',
        type: secrez.config.types.TEXT,
        content: 'some b'
      })

      let files1 = await fs.readdir(`${rootDir}/data`)
      for (let file of files1) {
        if (/^0/.test(file)) {
          await fs.unlink(path.join(tree.dataPath, file))
        }
      }

      await startTree()

      assert.equal(tree.alerts.length, 7)
      assert.equal(tree.alerts[1], 'b')
      assert.equal(tree.alerts[2], 'B')
      assert.equal(tree.alerts[3], 'a')
      assert.equal(tree.alerts[4], 'C')
      assert.equal(tree.alerts[5], 'M')
      assert.equal(tree.alerts[6], 'A')

      let json = tree.root.toJSON()
      assert.equal(Object.keys(json.children).length, 7)
    })

  })

})
