const chai = require('chai')
const assert = chai.assert
const fs = require('fs-extra')
const path = require('path')
const {config, Secrez} = require('@secrez/core')

const ExternalFs = require('../src/ExternalFs')

describe('#ExternalFs', function () {

  let secrez
  let externalFs
  let rootDir = path.resolve(__dirname, '../tmp/test/.secrez')
  let localWorkingDir = path.resolve(__dirname, '.')

  before(async function () {
    await fs.emptyDir(rootDir)
    secrez = new Secrez()
    await secrez.init(rootDir, localWorkingDir)
    externalFs = new ExternalFs()
  })


  describe('getNormalizedPath', async function () {

    let dir

    it('should normalize "~/fileSystems"', async function () {
      dir = '~/fileSystems'
      assert.equal(externalFs.getNormalizedPath(dir), path.join(localWorkingDir, 'fileSystems'))

    })

    it('should normalize "~"', async function () {
      dir = '~'
      assert.equal(externalFs.getNormalizedPath(dir), localWorkingDir)

    })

    it('should normalize "/var"', async function () {
      dir = '/var'
      assert.equal(externalFs.getNormalizedPath(dir), '/var')

    })

  })


  describe('fileCompletion', async function () {

    let files
    let results

    // TODO Put a fixed number of files in /fixtures

    it('should return a list of files', async function () {
      files = './fixtures/tree'
      results = await externalFs.fileCompletion(files)
      assert.equal(results.length, 5)

    })

    it('should return a list of only directories', async function () {
      files = './fixtures/tree'
      results = await externalFs.fileCompletion(files, config.onlyDir)
      assert.equal(results.length, 2)

    })

    it('should return a list of only files', async function () {
      files = './fixtures/tree'
      results = await externalFs.fileCompletion(files, config.onlyFile)
      assert.equal(results.length, 3)

    })

    it('should return the list of the parent folder if files is a file', async function () {
      files = './fixtures/tree/a'
      results = await externalFs.fileCompletion(files)
      assert.equal(results.length, 5)

    })

    it('should return an empty list if the files does not exist', async function () {
      files = 'somefile.txt'
      results = await externalFs.fileCompletion(files)
      assert.equal(results.length, 0)

    })


  })

  describe('isDir', async function () {

    let dir

    it('should confirm that "utils" is a dir', async function () {
      dir = externalFs.getNormalizedPath('fixtures')
      assert.isTrue(externalFs.isDir(dir))

    })

    it('should return that "config.test.js" is not a dir', async function () {
      dir = externalFs.getNormalizedPath('../src/utils/index.js')
      assert.isFalse(externalFs.isDir(dir))
    })

    it('should return that a not-existent file is not a dir', async function () {
      dir = externalFs.getNormalizedPath('jobs.text')
      assert.isFalse(externalFs.isDir(dir))
    })


  })

  describe('isFile', async function () {

    let file

    it('should return that "config.test.js" is a file', async function () {
      file = externalFs.getNormalizedPath('InternalFs.test.js')
      assert.isTrue(externalFs.isFile(file))
    })

    it('should confirm that "utils" is not a file', async function () {
      file = externalFs.getNormalizedPath('utils')
      assert.isFalse(externalFs.isFile(file))

    })

    it('should return that a not-existent file is not a dir', async function () {
      file = externalFs.getNormalizedPath('jobs.text')
      assert.isFalse(externalFs.isFile(file))
    })
  })

  describe('cd', async function () {

    let dir

    it('should change directory', async function () {
      dir = externalFs.getNormalizedPath('fixtures')
      await externalFs.cd(dir)
      assert.equal(config.localWorkingDir, dir)
    })

    it('should throw if the dir is a file', async function () {
      dir = externalFs.getNormalizedPath('ExternalFs.test.js')
      try {
        await externalFs.cd(dir)
        assert.isFalse(true)
      } catch (e) {
        assert.equal(e.message, 'No such directory')
      }
    })

    it('should throw if the dir does not exist', async function () {
      dir = externalFs.getNormalizedPath('gels')
      try {
        await externalFs.cd(dir)
        assert.isFalse(true)
      } catch (e) {
        assert.equal(e.message, 'No such directory')
      }
    })

  })

  describe('ls', async function () {

    let files
    let results

    beforeEach(async function () {
      await externalFs.cd(path.resolve(__dirname,'fixtures/tree'))
    })

    it('should return a list of files as "ls ./"', async function () {
      files = './'
      results = await externalFs.ls(files)
      assert.equal(results.length, 5)

    })

    it('should return a list of files as "ls .."', async function () {
      await externalFs.cd('d')
      files = '..'
      results = await externalFs.ls(files)
      assert.equal(results.length, 5)
    })

    it('should return a single file', async function () {
      files = 'a'
      results = await externalFs.ls(files)
      assert.equal(results[0], files)
      assert.isUndefined(results[1])
    })

    it('should return an empty list if the files does not exist', async function () {
      files = 'somefile.txt'
      results = await externalFs.ls(files)
      assert.equal(results.length, 0)
    })

  })

  describe('pwd', async function () {

    it('should return the current local working dir', async function () {
      assert.equal(await externalFs.pwd(), config.localWorkingDir)
    })
  })

})
