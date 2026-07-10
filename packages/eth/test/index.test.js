const chai = require("chai");
const expect = chai.expect;
const Eth = require("../src"); // import the Eth class from the file

describe("#Eth", async () => {
  let wallet;

  // from hardhat
  const mnemonic =
    "test test test test test test test test test test test junk";

  const bob = {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privatekey:
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  };

  const alice = {
    address: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    privatekey:
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  };

  const joe = {
    address: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
    privatekey:
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  };

  before(async () => {});

  describe("#newWallet()", async () => {
    it("should create a new random wallet", async () => {
      wallet = Eth.newWallet();
      expect(wallet.address).to.exist;
      expect(wallet.privateKey).to.exist;
    });
  });

  describe("#getWalletFromMnemonic()", async () => {
    it("should create a wallet from a mnemonic", async () => {
      let walletFromMnemonic = Eth.getWalletFromMnemonic(mnemonic);
      expect(walletFromMnemonic.address).equal(bob.address);
      expect(walletFromMnemonic.privateKey).equal(bob.privatekey);
      expect(
        Eth.equals(
          Eth.getWalletFromMnemonic(mnemonic, undefined, 1).address,
          alice.address
        )
      ).to.be.true;
      expect(
        Eth.equals(
          Eth.getWalletFromMnemonic(mnemonic, undefined, 2).address,
          joe.address
        )
      ).to.be.true;
    });
  });

  describe("#getWalletFromPrivateKey()", async () => {
    it("should create a wallet from a private key", async () => {
      wallet = Eth.newWallet();
      const privateKey = wallet.privateKey;
      const walletFromPrivateKey = Eth.getWalletFromPrivateKey(privateKey);
      expect(walletFromPrivateKey.address).to.exist;
      expect(walletFromPrivateKey.privateKey).to.exist;
      expect(walletFromPrivateKey.privateKey).to.equal(privateKey);
    });
  });

  describe("#encryptWalletAsKeystoreJson()", async () => {
    it("should encrypt a wallet as a keystore JSON", async () => {
      wallet = Eth.newWallet();
      const password = "test";
      const json = await Eth.encryptWalletAsKeystoreJson(wallet, password);
      expect(json).to.exist;
    });
  });

  describe("#getWalletFromEncryptedJson()", async () => {
    it("should create a wallet from an encrypted JSON", async () => {
      wallet = Eth.newWallet();
      const password = "test";
      const json = await Eth.encryptPrivateKeyAsKeystoreJson(
        wallet.privateKey,
        password
      );
      const walletFromEncryptedJson = await Eth.getWalletFromEncryptedJson(
        json,
        password
      );
      expect(walletFromEncryptedJson.address).to.exist;
      expect(walletFromEncryptedJson.privateKey).to.exist;
      expect(walletFromEncryptedJson.privateKey).to.equal(wallet.privateKey);
    });

    it("should create a wallet from an encrypted JSON if private keys misses initial 0x", async () => {
      wallet = Eth.newWallet();
      const password = "test";
      const json = await Eth.encryptPrivateKeyAsKeystoreJson(
        wallet.privateKey.substring(2),
        password
      );
      const walletFromEncryptedJson = await Eth.getWalletFromEncryptedJson(
        json,
        password
      );
      expect(walletFromEncryptedJson.address).to.exist;
      expect(walletFromEncryptedJson.privateKey).to.exist;
      expect(walletFromEncryptedJson.privateKey).to.equal(wallet.privateKey);
    });
  });
});
