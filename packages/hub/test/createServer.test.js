const request = require('supertest')
const path = require('path')
const fs = require('fs-extra')
const chai = require('chai')
const assert = chai.assert
const {Server} = require('ws')
const WebSocketServer = Server
const WebSocket = require('ws')
const net = require('net')
const {getRandomId, setPayloadAndSignIt} = require('../src/utils')
const {Crypto} = require('@secrez/core')
const Secrez = require('@secrez/core').Secrez(Math.random())

const createServer = require('../src/createServer')

describe.only('Server', () => {

  let rootDir = path.resolve(__dirname, '../tmp/test/.secrez')
  let secrez = new Secrez()

  function setPayloadAndSignature(id = 0) {
    return setPayloadAndSignIt(secrez, {
      id
    })
  }

  before(async function () {
    await fs.emptyDir(rootDir)
    await secrez.init(rootDir)
    await secrez.signup('password', 1000)
  })

  it('server starts and stops', async () => {
    const server = createServer()
    await new Promise(resolve => server.listen(resolve))
    await new Promise(resolve => server.close(resolve))
  })

  it('should show the welcome json', async () => {
    const server = createServer()
    const res = await request(server).get('/')
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.welcome_to, 'This is a Secrez hub')
  })

  it('should upgrade websocket requests', async () => {

    // process.env.AS_DEV = true

    const hostname = 'uzcmscmbx5y9j61k94r66akycscjbepzwyz9aam7dn4gqmwkyi60c3uc9urw'
    const server = createServer({
      domain: 'example.com',
      port: 9699,
    })
    await new Promise(resolve => server.listen(resolve))

    const res = await request(server).get(`/${hostname}`)

    const localTunnelPort = res.body.port

    const wss = await new Promise((resolve) => {
      const wsServer = new WebSocketServer({port: 0}, () => {
        resolve(wsServer)
      })
    })

    const websocketServerPort = wss.address().port

    const ltSocket = net.createConnection({port: localTunnelPort})
    const wsSocket = net.createConnection({port: websocketServerPort})
    ltSocket.pipe(wsSocket).pipe(ltSocket)

    wss.once('connection', (ws) => {
      ws.once('message', (message) => {
        ws.send(message)
      })
    })

    const ws = new WebSocket('http://localhost:' + server.address().port, {
      headers: {
        host: hostname + '.example.com',
      }
    })

    ws.on('open', () => {
      ws.send('something')
    })

    await new Promise((resolve) => {
      ws.once('message', (msg) => {
        assert.equal(msg, 'something')
        resolve()
      })
    })

    wss.close()
    await new Promise(resolve => server.close(resolve))
  })

  it('should support the /api/v1/tunnels/:id/status endpoint', async () => {
    const server = createServer()
    await new Promise(resolve => server.listen(resolve))

    // no such tunnel yet
    let res = await request(server).get('/api/v1/tunnels/foobar-test/status')
    assert.equal(res.statusCode, 404)

    const {payload, signature} = setPayloadAndSignature()
    res = await request(server).get('/api/v1/tunnel/new').query({
      payload,
      signature
    })

    let {short_url, id, url} = res.body

    assert.equal(id.substring(0, 4), Crypto.b32Hash(Secrez.getSignPublicKey(secrez.getPublicKey())).substring(0, 4))

    res = await request(server).get(`/api/v1/tunnels/${id}/status`)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, {
      connected_sockets: 0,
    })

    let parsedUrl = new URL(short_url)

    res = await request(server).get(parsedUrl.pathname)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, {
      publicKey: secrez.getPublicKey(),
      url
    })

    await new Promise(resolve => server.close(resolve))
  })

  it('should support the /api/v1/tunnels/:id/status endpoint with fixed reqId', async () => {
    const server = createServer()
    await new Promise(resolve => server.listen(resolve))

    // no such tunnel yet
    let res = await request(server).get('/api/v1/tunnels/foobar-test/status')
    assert.equal(res.statusCode, 404)

    // request a new client called foobar-test
    const publicKeyId = getRandomId(secrez.getPublicKey())
    const {payload, signature} = setPayloadAndSignature(publicKeyId)

    res = await request(server).get('/api/v1/tunnel/new').query({
      payload,
      signature
    })
    let {id, short_url: shortUrl} = res.body

    assert.equal(id, publicKeyId)

    res = await request(server).get(`/api/v1/tunnels/${id}/status`)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, {
      connected_sockets: 0,
    })

    const {payload: payload2, signature: signature2} = setPayloadAndSignature(publicKeyId)

    res = await request(server).get('/api/v1/tunnel/new').query({
      payload: payload2,
      signature: signature2,
      keepShortUrl: true
    })
    assert.equal(res.body.short_url, shortUrl)
    assert.equal(res.body.id, id)

    res = await request(server).get('/api/v1/tunnel/new').query({
      payload,
      signature
    })
    assert.notEqual(res.body.short_url, shortUrl)

    try {
      // reusing the same payload is not allowed
      res = await request(server).get('/api/v1/tunnel/new').query({
        payload: payload2,
        signature: signature2,
        keepShortUrl: true
      })
      assert.isTrue(false)
    } catch(e) {
      assert.isTrue(!!e.message)
    }


    await new Promise(resolve => server.close(resolve))
  })
})
