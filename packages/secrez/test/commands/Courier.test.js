const chai = require('chai')
const assert = chai.assert
const stdout = require('test-console').stdout
const fs = require('fs-extra')
const path = require('path')
const {ConfigUtils} = require('@secrez/core')
const {sleep} = require('@secrez/utils')
const {createServer, utils: hubUtils} = require('@secrez/hub')
const {Config, Server} = require('@secrez/courier')

const ContactManager = require('../../src/Managers/ContactManager')

const MainPrompt = require('../mocks/MainPromptMock')
const {assertConsole, noPrint, decolorize} = require('../helpers')

const {
  password,
  iterations
} = require('../fixtures')

// eslint-disable-next-line no-unused-vars
const jlog = require('../helpers/jlog')

describe('#Courier', function () {

  // process.env.AS_DEV = true

  let prompt
  let hubPort = 4433
  let testDir = path.resolve(__dirname, '../../tmp/test')
  let rootDir = path.resolve(testDir, 'secrez')
  let courierRoot = path.resolve(testDir, 'secrez-courier')
  let localDomain = '127zero0one.com'
  let inspect
  let C
  let config
  let server
  let secrez

  let options = {
    container: rootDir,
    localDir: __dirname
  }

  const startHub = async () => {
    hubServer = createServer({
      secure: false,
      domain: localDomain,
      max_tcp_sockets: 4,
      port: hubPort
    })
    await new Promise(resolve => {
      hubServer.listen(hubPort, () => {
        resolve()
      })
    })
  }

  beforeEach(async function () {
    ContactManager.getCache().reset()
    await fs.emptyDir(testDir)
    await startHub()
    config = new Config({root: courierRoot, hub: `http://${localDomain}:${hubPort}`})
    server = new Server(config)
    await server.start()
    prompt = new MainPrompt
    await prompt.init(options)
    C = prompt.commands
    await prompt.secrez.signup(password, iterations)
    secrez = prompt.secrez
  })

  afterEach(async function () {
    await server.close()
    await new Promise(resolve => hubServer.close(resolve))
    await sleep(10)
  })

  it('should return the help', async function () {

    inspect = stdout.inspect()
    await C.courier.exec({help: true})
    inspect.restore()
    let output = inspect.output.map(e => decolorize(e))
    assert.isTrue(/-h, --help/.test(output[4]))

  })

  it('should check if it is ready', async function () {

    try {
      await C.courier.isCourierReady({})
      assert.isTrue(false)
    } catch(e) {
      assert.equal(e.message, 'No courier set up yet.')
    }

  })

  it('should set up the courier', async function () {

    inspect = stdout.inspect()
    await C.courier.courier({
      authCode: server.authCode,
      port: server.port
    })
    inspect.restore()
    let output = inspect.output.map(e => decolorize(e))

    const env = await ConfigUtils.getEnv(secrez.config)
    assert.equal(output[1], `Connected with the courier listening on port ${env.courier.port}`)

    assert.isTrue((await C.courier.isCourierReady({})).success)

  })

  it('should set up the courier and get the default message when is already set up', async function () {

    await noPrint(C.courier.courier({
      authCode: server.authCode,
      port: server.port
    }))
    const options = {
      env: await ConfigUtils.getEnv(secrez.config)
    }
    await C.courier.preInit(options)
    assert.isTrue(options.ready)

  })


})

