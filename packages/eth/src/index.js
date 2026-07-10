const ethers = require("ethers");
const bip39 = require("bip39");
const hdkey = require("hdkey");

class Eth {
  static newWallet() {
    return ethers.Wallet.createRandom();
  }

  static getWalletFromMnemonic(
    mnemonic,
    derivedPath = "m/44'/60'/0'/0",
    walletListIndex = 0
  ) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdNode = hdkey.fromMasterSeed(seed);
    const privateKey = hdNode
      .derive(derivedPath)
      .deriveChild(walletListIndex)
      .privateKey.toString("hex");
    return Eth.getWalletFromPrivateKey(privateKey);
  }

  static getWalletFromPrivateKey(privateKey) {
    return new ethers.Wallet(privateKey);
  }

  static async getWalletFromEncryptedJson(json, password) {
    return ethers.Wallet.fromEncryptedJson(json, password);
  }

  static async encryptWalletAsKeystoreJson(wallet, password) {
    return wallet.encrypt(password);
  }

  static async encryptPrivateKeyAsKeystoreJson(privateKey, password) {
    if (!privateKey.startsWith("0x")) {
      privateKey = "0x" + privateKey;
    }
    return Eth.encryptWalletAsKeystoreJson(
      await Eth.getWalletFromPrivateKey(privateKey),
      password
    );
  }

  static equals(address1, address2) {
    return ethers.getAddress(address1) === ethers.getAddress(address2);
  }
}

module.exports = Eth;
