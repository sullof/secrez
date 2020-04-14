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

describe('#Find', function () {

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

  it('should show find a string in the tree', async function () {

    let {internalFs} = prompt
    let {config} = prompt.secrez

    await noPrint(internalFs.make({
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

    await noPrint(internalFs.make({
      path: 'folder2/file3',
      type: config.types.TEXT
    }))

    await noPrint(internalFs.make({
      path: 'folder4/some',
      type: config.types.TEXT
    }))

    await noPrint(internalFs.make({
      path: 'folder3/folder4/folder5/file3',
      type: config.types.TEXT
    }))

    inspect = stdout.inspect()
    await C.find.exec({
      name: 'file'
    })
    inspect.restore()
    assertConsole(inspect, ['/folder1/file2',
      '/folder2/file3',
      '/folder3/folder4/folder5/file3'
    ])

    inspect = stdout.inspect()
    await C.find.exec({
      name: 'der1'
    })
    inspect.restore()
    assertConsole(inspect, ['/folder1'])

    inspect = stdout.inspect()
    await C.find.exec({
      name: '3'
    })
    inspect.restore()
    assertConsole(inspect, [
      '/folder2/file3',
      '/folder3',
      '/folder3/folder4/folder5/file3'
    ])

    inspect = stdout.inspect()
    await C.find.exec({
      name: 'file1',
      all: true
    })
    inspect.restore()
    assertConsole(inspect, [
      'file1',
      'file1'
    ], true)

    inspect = stdout.inspect()
    await C.find.exec({
      name: 'Password',
      content: true
    })
    inspect.restore()
    assertConsole(inspect, [
      '/folder1/file2'
    ])

    inspect = stdout.inspect()
    await C.find.exec({
    })
    inspect.restore()
    assertConsole(inspect, [])

  })


})
