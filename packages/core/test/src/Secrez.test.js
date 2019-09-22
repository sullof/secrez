const chai = require('chai')
const assert = chai.assert
const path = require('path')
const homedir = require('homedir')
const Secrez = require('../../src/Secrez')
const Crypto = require('../../src/utils/Crypto')
const fs = require('fs-extra')
const config = require('../../src/config')
const helpers = require('../helpers')

describe('#Secrez', function () {

  let password = 'unaSTRANA342'
  let iterations = 23456
  let hash23456iterations = '2hy1HzfcCCoNacowjY67LvgPXUyNFwjAGuuMcieVcAJY'
  let rootDir = path.resolve(__dirname, '../../tmp/test/.secrez')

  let secrez
  let masterKey

  describe('default secrez dir', function () {

    before(async function () {
      await fs.emptyDir(rootDir)
      secrez = new Secrez()
      await secrez.init()
    })

    it('should use the default ~/.secrez folder', async function () {

      assert.equal(config.secrez.dataPath, homedir() +'/.secrez/data')
      assert.equal(config.secrez.localWorkingDir, homedir())
    })


  })

  describe('custom (testing) secrez dir', function () {

    before(async function () {
      await fs.emptyDir(rootDir)
      secrez = new Secrez()
      await secrez.init(rootDir)
    })

    describe('derivePassword', async function () {

      it('should derive a password and obtain a predeterminded hash', async function () {
        let derivedPassword = await secrez.derivePassword(password, 23456)
        assert.equal(Crypto.b58Hash(derivedPassword), hash23456iterations)
      })

    })

    describe('signup and signin', async function () {

      beforeEach(async function () {
        await fs.emptyDir(rootDir)
        config.secrez = {}
        secrez = new Secrez()
      })

      it('should signup the user and signin without saving the iterations', async function () {
        await secrez.init(rootDir)
        await secrez.signup(password, iterations)
        assert.isTrue(fs.existsSync(config.secrez.confPath))
        masterKey = secrez.masterKey
        secrez.signout()
        assert.isUndefined(secrez.masterKey)
        await secrez.signin(password, iterations)
        assert.isTrue(helpers.bufferEquals(masterKey, secrez.masterKey))
      })

      it('should signup the user and signin saved the iterations', async function () {
        await secrez.init(rootDir)
        await secrez.signup(password, iterations, true)
        assert.isTrue(fs.existsSync(config.secrez.confPath))
        assert.isTrue(fs.existsSync(config.secrez.envPath))
        let masterKey = secrez.masterKey
        secrez.signout()
        assert.isUndefined(secrez.masterKey)
        await secrez.signin(password)
        assert.isTrue(helpers.bufferEquals(masterKey, secrez.masterKey))

      })

      describe('should throw an error', async function () {

        it('trying to signup if Secrez has not been initiated', async function () {
          try {
            await secrez.signup(password, iterations)
          } catch (e) {
            assert.equal(e.message, 'Secrez not initiated')
          }
        })

        it('trying to signin if Secrez has not been initiated', async function () {
          try {
            await secrez.signin(password, iterations)
          } catch (e) {
            assert.equal(e.message, 'Secrez not initiated')
          }
        })

        it('trying to signup if account already exists', async function () {
          await secrez.init(rootDir)
          await secrez.signup(password, iterations)
          try {
            await secrez.signup(password, iterations)
          } catch (e) {
            assert.equal(e.message, 'An account already exists. Please, signin or chose a different container directory')
          }
        })

        it('trying to signin if account is not set yet', async function () {
          await secrez.init(rootDir)
          try {
            await secrez.signin(password, iterations)
          } catch (e) {
            assert.equal(e.message, 'Account not set yet')
          }
        })

        it('trying to signin with missed iterations', async function () {
          await secrez.init(rootDir)
          await secrez.signup(password, iterations)
          try {
            await secrez.signin(password)
          } catch (e) {
            assert.equal(e.message, 'Iterations is missed')
          }
        })

        it('trying to signin with the wrong password', async function () {
          await secrez.init(rootDir)
          await secrez.signup(password, iterations)
          try {
            await secrez.signin('wrongPassword', iterations)
          } catch (e) {
            assert.equal(e.message, 'Wrong password or wrong number of iterations')
          }
        })

        it('trying to signin with the right password but wrong number of iterations', async function () {
          await secrez.init(rootDir)
          await secrez.signup(password, iterations)
          try {
            await secrez.signin(password, iterations - 1)
          } catch (e) {
            assert.equal(e.message, 'Wrong password or wrong number of iterations')
          }
        })

        it('trying to signin with the right password but using a wrong hash on file', async function () {
          await secrez.init(rootDir)
          await secrez.signup(password, iterations)
          let conf = require(config.secrez.confPath)
          conf.hash = hash23456iterations
          await fs.writeFile(config.secrez.confPath, JSON.stringify(conf))
          try {
            await secrez.signin(password, iterations)
          } catch (e) {
            assert.equal(e.message, 'Hash on file does not match the master key')
          }
        })

        it('trying to sign out if never signed-in', async function () {
          await secrez.init(rootDir)
          try {
            secrez.signout()
          } catch (e) {
            assert.equal(e.message, 'User not logged')
          }
        })
      })
    })

    describe('encryptItem and decryptItem', async function () {

      beforeEach(async function () {
        await fs.emptyDir(rootDir)
        config.secrez = {}
        secrez = new Secrez()
        await secrez.init(rootDir)
      })

      it('should encrypt an item and decrypt it', async function () {
        await secrez.signup(password, iterations)
        let data = 'some random data'
        let encryptedData = secrez.encryptItem(data)
        assert.equal(data, secrez.decryptItem(encryptedData))
      })

      it('should throw if the user is not logged in', async function () {
        try {
          let data = 'some random data'
          secrez.encryptItem(data)
        } catch (e) {
          assert.equal(e.message, 'User not logged')
        }

        try {
          secrez.decryptItem('some encrypted data')
        } catch (e) {
          assert.equal(e.message, 'User not logged')
        }
      })
    })
  })

})