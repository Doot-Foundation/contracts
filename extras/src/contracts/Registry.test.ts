import { Mina, PrivateKey, PublicKey, AccountUpdate } from 'o1js';
import { Registry, SourceCodeIPFS, SourceCodeGithub } from './Registry';

describe('Registry', () => {
  let deployer: PublicKey;
  let deployerPK: PrivateKey;
  let zkAppAddress: PublicKey;
  let zkAppPrivateKey: PrivateKey;
  let registry: Registry;

  beforeAll(async () => {
    const Local = await Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);

    deployerPK = Local.testAccounts[0].key;
    deployer = deployerPK.toPublicKey();

    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();

    registry = new Registry(zkAppAddress);
    await Registry.compile();

    let txn = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await registry.deploy();
    });
    await txn.prove();
    await txn.sign([deployerPK, zkAppPrivateKey]).send();
  });

  describe('Init.', () => {
    it("Should set the Source Github to ''.", async () => {
      const expectedOutput = '';
      const onchainGithub = registry.githubSourceLink.get();
      const onChainGithub = SourceCodeGithub.fromCharacters(
        SourceCodeGithub.unpack(onchainGithub.packed)
      );

      expect(onChainGithub.toString()).toEqual(expectedOutput);
    });
    it("Should set the Source IPFS to ''.", async () => {
      const expectedOutput = '';
      const onchainIPFS = registry.ipfsSourceLink.get();
      const onChainIPFS = SourceCodeIPFS.fromCharacters(
        SourceCodeIPFS.unpack(onchainIPFS.packed)
      );

      expect(onChainIPFS.toString()).toEqual(expectedOutput);
    });
    it("Should set the implementation to ''.", async () => {
      const expectedOutput = PublicKey.empty();
      const onChainImplementation = registry.implementation.get();

      expect(onChainImplementation).toEqual(expectedOutput);
    });
  });

  describe('Update Base.', () => {
    const implementation = PrivateKey.random().toPublicKey();

    beforeAll(async () => {
      const updatedGithub = SourceCodeGithub.fromString(
        'https://github.com/Doot-Foundation/Doot_L1Contracts/'
      );
      const updatedIpfs = SourceCodeIPFS.fromString(
        'Qweoptiasnlkcmasxlkpokaqpofdjqpiewojfpoiaewjo'
      );

      await Mina.transaction(deployer, async () => {
        await registry.initBase();
      })
        .prove()
        .sign([deployerPK])
        .send();

      await Mina.transaction(deployer, async () => {
        await registry.upgrade(updatedGithub, updatedIpfs, implementation);
      })
        .prove()
        .sign([deployerPK])
        .send();
    });

    it('Should update the Source Github to https://github.com/Doot-Foundation/Doot_L1Contracts/', async () => {
      const expectedOutput =
        'https://github.com/Doot-Foundation/Doot_L1Contracts/';

      const onchainGithub = registry.githubSourceLink.get();
      const onChainGithub = SourceCodeGithub.fromCharacters(
        SourceCodeGithub.unpack(onchainGithub.packed)
      );

      expect(onChainGithub.toString()).toEqual(expectedOutput);
    });
    it('Should update the Source IPFS to Qweoptiasnlkcmasxlkpokaqpofdjqpiewojfpoiaewjo', async () => {
      const expectedOutput = 'Qweoptiasnlkcmasxlkpokaqpofdjqpiewojfpoiaewjo';

      const onchainIPFS = registry.ipfsSourceLink.get();
      const onChainIPFS = SourceCodeIPFS.fromCharacters(
        SourceCodeIPFS.unpack(onchainIPFS.packed)
      );

      expect(onChainIPFS.toString()).toEqual(expectedOutput);
    });
    it(`Should update the implementation to ${implementation.toBase58()}`, async () => {
      const expectedOutput = implementation.toBase58();
      const onChainImplementation = registry.implementation.get().toBase58();

      expect(onChainImplementation).toEqual(expectedOutput);
    });
  });
});
