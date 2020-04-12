const stdout = require('test-console').stdout

const fs = require('fs-extra')
const path = require('path')
const Prompt = require('../mocks/PromptMock')
const {assertConsole, noPrint} = require('../helpers')

const {
  password,
  iterations
} = require('../fixtures')

// eslint-disable-next-line no-unused-vars
const jlog = require('../helpers/jlog')

describe('#Cat', function () {

  let prompt
  let rootDir = path.resolve(__dirname, '../../tmp/test/.secrez')
  let inspect, C

  let options = {
    container: rootDir,
    localDir: path.resolve(__dirname, '../fixtures/files')
  }

  beforeEach(async function () {
    await fs.emptyDir(path.resolve(__dirname, '../../tmp/test'))
    prompt = new Prompt
    await prompt.init(options)
    C = prompt.commands
    await prompt.secrez.signup(password, iterations)
    await prompt.internalFs.init()
  })

  it('should show the content of a file', async function () {

    await noPrint(C.touch.exec({path: '/dir1/file1', content: 'Some password'}))

    let node = prompt.internalFs.tree.root.getChildFromPath('/dir1/file1')
    let formattedDate = C.cat.formatTs(node.lastTs)

    inspect = stdout.inspect()
    await C.cat.exec({path: '/dir1/file1', metadata: true})
    inspect.restore()
    assertConsole(inspect, [formattedDate, 'Some password'])

    let dir1 = prompt.internalFs.tree.root.getChildFromPath('/dir1')
    prompt.internalFs.tree.workingNode = dir1

    inspect = stdout.inspect()
    await C.cat.exec({path: 'file1'})
    inspect.restore()
    assertConsole(inspect, ['Some password'])

  })


  it('should show either one or all the versions of a file', async function () {

    let {internalFs} = prompt
    let {config} = prompt.secrez

    let file1 = await noPrint(internalFs.make({
      path: 'folder1/file1',
      type: config.types.TEXT
    }))

    await noPrint(internalFs.change({
      path: '/folder1/file1',
      content: 'Password 2'
    }))

    await noPrint(internalFs.change({
      path: '/folder1/file1',
      newPath: '/folder1/file2',
      content: 'Password 3'
    }))

    let versions = file1.getVersions()

    inspect = stdout.inspect()
    await C.cat.exec({path: '/folder1/file2', all: true})
    inspect.restore()
    assertConsole(inspect, [
      C.cat.formatTs(versions[0]),
      'Password 3',
      C.cat.formatTs(versions[1]) + ' (file1)',
      'Password 2',
      C.cat.formatTs(versions[2]) + ' (file1)',
      '-- this version is empty --'
    ])
  })

  it('should throw if entry is not a file or file does not exist', async function () {
    await noPrint(C.mkdir.exec({path: '/dir1/dir2'}))

    inspect = stdout.inspect()
    await C.cat.exec({path: '/dir1/dir2'})
    inspect.restore()
    assertConsole(inspect, 'Cat requires a valid file')

    inspect = stdout.inspect()
    await C.cat.exec({path: '/dir1/file1'})
    inspect.restore()
    assertConsole(inspect, 'Path does not exist')

    await noPrint(C.touch.exec({
      path: 'folder1'
    }))

    inspect = stdout.inspect()
    await C.cat.exec({path: '/folder1', version: ['aass']})
    inspect.restore()
    assertConsole(inspect, [])


  })

  it('should throw if trying to cat a binary file', async function () {

    await noPrint(C.import.exec({
      path: 'folder1',
      binarytoo: true
    }))

    inspect = stdout.inspect()
    await C.cat.exec({path: '/file1.tar.gz'})
    inspect.restore()
    assertConsole(inspect, ['-- this is a binary file --'])

  })

})
