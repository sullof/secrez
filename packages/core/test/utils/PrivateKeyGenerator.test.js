const chai = require('chai')
const assert = chai.assert
const PrivateKeyGenerator = require('../../src/utils/PrivateKeyGenerator')

describe('#PrivateKeyGenerator', function () {

  describe('#generate', async function () {

    it('should generate a new private key, with mnemonic', async function () {

      let generated = await PrivateKeyGenerator.generate({
        accounts: 1
      })
      assert.equal(generated.privateKeys[0].length, 64)
      assert.equal(generated.mnemonic.split(' ').length, 12)
    })

    it('should recover new private key from the mnemonic', async function () {

      let generated = await PrivateKeyGenerator.generate({
        accounts: 1
      })
      let mnemonic = generated.mnemonic
      let privateKey = generated.privateKeys[0]

      generated = await PrivateKeyGenerator.generate({
        accounts: 1,
        mnemonic
      })

      assert.equal(generated.privateKeys[0], privateKey)
    })

  })


})