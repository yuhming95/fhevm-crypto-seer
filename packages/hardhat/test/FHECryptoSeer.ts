import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHECryptoSeer, FHECryptoSeer__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHECryptoSeer")) as FHECryptoSeer__factory;
  const cryptoSeer = (await factory.deploy()) as FHECryptoSeer;
  const cryptoSeerAddress = await cryptoSeer.getAddress();
  return { cryptoSeer, cryptoSeerAddress };
}

describe("FHECryptoSeer", function () {
  let signers: Signers;
  let cryptoSeer: FHECryptoSeer;
  let cryptoSeerAddress: string;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This hardhat test suite cannot run on Sepolia Testnet");
      this.skip();
    }
    ({ cryptoSeer, cryptoSeerAddress } = await deployFixture());
  });

  it("should indicate that users haven't predicted initially", async function () {
    expect(await cryptoSeer.hasPredicted(signers.alice.address)).to.eq(false);
    expect(await cryptoSeer.hasPredicted(signers.bob.address)).to.eq(false);
  });

  it("should allow a user to submit a prediction and prevent double predictions", async function () {
    const choice = 3;
    const encrypted = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.alice.address).add32(choice).encrypt();

    await (await cryptoSeer.connect(signers.alice).predict(encrypted.handles[0], encrypted.inputProof)).wait();
    expect(await cryptoSeer.hasPredicted(signers.alice.address)).to.eq(true);

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await cryptoSeer.getUserPrediction(signers.alice.address),
      cryptoSeerAddress,
      signers.alice
    );
    expect(decrypted).to.eq(choice);

    const encrypted2 = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.alice.address).add32(choice + 1).encrypt();
    await expect(
      cryptoSeer.connect(signers.alice).predict(encrypted2.handles[0], encrypted2.inputProof)
    ).to.be.revertedWith("Already predicted");
  });

  it("should allow multiple users to predict independently", async function () {
    const aliceChoice = 2;
    const bobChoice = 5;

    const aliceEncrypted = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.alice.address).add32(aliceChoice).encrypt();
    const bobEncrypted = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.bob.address).add32(bobChoice).encrypt();

    await (await cryptoSeer.connect(signers.alice).predict(aliceEncrypted.handles[0], aliceEncrypted.inputProof)).wait();
    await (await cryptoSeer.connect(signers.bob).predict(bobEncrypted.handles[0], bobEncrypted.inputProof)).wait();

    const aliceDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await cryptoSeer.getUserPrediction(signers.alice.address),
      cryptoSeerAddress,
      signers.alice
    );
    const bobDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await cryptoSeer.getUserPrediction(signers.bob.address),
      cryptoSeerAddress,
      signers.bob
    );

    expect(aliceDecrypted).to.eq(aliceChoice);
    expect(bobDecrypted).to.eq(bobChoice);
  });

  it("should allow a user to update their prediction", async function () {
    const initial = 1;
    const updated = 6;

    const encryptedInitial = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.alice.address).add32(initial).encrypt();
    await (await cryptoSeer.connect(signers.alice).predict(encryptedInitial.handles[0], encryptedInitial.inputProof)).wait();

    const encryptedUpdated = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.alice.address).add32(updated).encrypt();
    await (await cryptoSeer.connect(signers.alice).updatePrediction(encryptedUpdated.handles[0], encryptedUpdated.inputProof)).wait();

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await cryptoSeer.getUserPrediction(signers.alice.address),
      cryptoSeerAddress,
      signers.alice
    );
    expect(decrypted).to.eq(updated);
  });

  it("should revert updatePrediction if user has not predicted before", async function () {
    const encrypted = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.bob.address).add32(2).encrypt();
    await expect(
      cryptoSeer.connect(signers.bob).updatePrediction(encrypted.handles[0], encrypted.inputProof)
    ).to.be.revertedWith("No prediction found");
  });

  it("should return zero/empty encrypted value for users who haven't predicted", async function () {
    const encrypted = await cryptoSeer.getUserPrediction(signers.bob.address);
    expect(encrypted).to.eq(ethers.ZeroHash);
  });

  it("should allow multiple users to update predictions independently and decrypt correctly", async function () {
    const aliceInitial = 2, aliceUpdated = 5;
    const bobInitial = 1, bobUpdated = 6;

    const aliceEncrypted1 = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.alice.address).add32(aliceInitial).encrypt();
    const bobEncrypted1 = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.bob.address).add32(bobInitial).encrypt();

    await (await cryptoSeer.connect(signers.alice).predict(aliceEncrypted1.handles[0], aliceEncrypted1.inputProof)).wait();
    await (await cryptoSeer.connect(signers.bob).predict(bobEncrypted1.handles[0], bobEncrypted1.inputProof)).wait();

    const aliceEncrypted2 = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.alice.address).add32(aliceUpdated).encrypt();
    const bobEncrypted2 = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.bob.address).add32(bobUpdated).encrypt();

    await (await cryptoSeer.connect(signers.alice).updatePrediction(aliceEncrypted2.handles[0], aliceEncrypted2.inputProof)).wait();
    await (await cryptoSeer.connect(signers.bob).updatePrediction(bobEncrypted2.handles[0], bobEncrypted2.inputProof)).wait();

    const aliceDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await cryptoSeer.getUserPrediction(signers.alice.address),
      cryptoSeerAddress,
      signers.alice
    );
    const bobDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await cryptoSeer.getUserPrediction(signers.bob.address),
      cryptoSeerAddress,
      signers.bob
    );

    expect(aliceDecrypted).to.eq(aliceUpdated);
    expect(bobDecrypted).to.eq(bobUpdated);
  });

  it("should allow predictions outside the 1–6 range", async function () {
    const aliceChoice = 0, bobChoice = 10;

    const aliceEncrypted = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.alice.address).add32(aliceChoice).encrypt();
    const bobEncrypted = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.bob.address).add32(bobChoice).encrypt();

    await (await cryptoSeer.connect(signers.alice).predict(aliceEncrypted.handles[0], aliceEncrypted.inputProof)).wait();
    await (await cryptoSeer.connect(signers.bob).predict(bobEncrypted.handles[0], bobEncrypted.inputProof)).wait();

    const aliceDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await cryptoSeer.getUserPrediction(signers.alice.address),
      cryptoSeerAddress,
      signers.alice
    );
    const bobDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await cryptoSeer.getUserPrediction(signers.bob.address),
      cryptoSeerAddress,
      signers.bob
    );

    expect(aliceDecrypted).to.eq(aliceChoice);
    expect(bobDecrypted).to.eq(bobChoice);
  });

  it("should prevent double predictions consecutively", async function () {
    const choice = 4;
    const encrypted1 = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.alice.address).add32(choice).encrypt();
    await (await cryptoSeer.connect(signers.alice).predict(encrypted1.handles[0], encrypted1.inputProof)).wait();

    const encrypted2 = await fhevm.createEncryptedInput(cryptoSeerAddress, signers.alice.address).add32(choice + 1).encrypt();
    await expect(
      cryptoSeer.connect(signers.alice).predict(encrypted2.handles[0], encrypted2.inputProof)
    ).to.be.revertedWith("Already predicted");
  });
});
