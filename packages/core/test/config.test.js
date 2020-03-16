const chai = require('chai')
const assert = chai.assert
const path = require('path')
const Secrez = require('../src/Secrez')
const fs = require('fs-extra')
const config = require('../src/config')

describe('#config', function () {

  let secrez
  let rootDir = path.resolve(__dirname, '../../tmp/test/.secrez')

  before(async function () {
    await fs.emptyDir(rootDir)
    secrez = new Secrez()
    await secrez.init(rootDir, path.dirname(rootDir))
  })

  it('all field should be correctly configured', async function () {
    let s = secrez.config
    assert.equal(s.root, path.basename(rootDir))
    assert.equal(s.dataPath, path.join(rootDir, 'data'))
    assert.equal(s.tmpPath, path.join(s.dataPath, '.tmp'))
    assert.equal(s.workingDir, '/')
    assert.equal(s.localWorkingDir, path.dirname(rootDir))
    assert.equal(s.envPath, path.join(rootDir, '.env.json'))
    assert.equal(s.confPath, path.join(s.dataPath, 'keys.json'))

  })

})
