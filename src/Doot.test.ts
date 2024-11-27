import { Doot, IpfsCID, TokenInformationArray, offchainState } from './Doot';
import {
  PrivateKey,
  PublicKey,
  Field,
  Mina,
  AccountUpdate,
  MerkleMap,
  CircuitString,
} from 'o1js';

describe('Doot.js', () => {
  let oraclePK: PrivateKey,
    oracle: PublicKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    doot: Doot,
    randomPK: PrivateKey,
    random: PublicKey;

  beforeAll(async () => {
    let Local = await Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);

    oraclePK = Local.testAccounts[0].key;
    oracle = oraclePK.toPublicKey();

    randomPK = PrivateKey.random();
    random = randomPK.toPublicKey();

    // zkapp account
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();

    doot = new Doot(zkAppAddress);
    doot.offchainState.setContractInstance(doot);

    await offchainState.compile();
    await Doot.compile();

    await Mina.transaction(oracle, async () => {
      AccountUpdate.fundNewAccount(oracle);
      await doot.deploy();
    })
      .sign([oraclePK, zkAppPrivateKey])
      .prove()
      .send();
  });

  describe('Dummy', () => {
    it('Should init.', async () => {
      console.log('');
    });
  });

  describe('Init', () => {
    it("Should set initial ipfs hash to ''", async () => {
      const onChainIpfsCID = doot.ipfsCID.get();
      const onChainIpfsCid = IpfsCID.fromCharacters(
        IpfsCID.unpack(onChainIpfsCID.packed)
      );
      const expected = '';
      expect(onChainIpfsCid.toString()).toEqual(expected);
    });

    it('Should set initial map root to 0', async () => {
      const onChainCommitment = doot.commitment.get();
      const expected = Field.from(0);

      expect(onChainCommitment).toEqual(expected);
    });

    it(`Should set inital owner to empty()`, async () => {
      const onChainSecret = doot.owner.get();
      const expected = PublicKey.empty();

      expect(onChainSecret).toEqual(expected);
    });
  });

  describe('Add/Update', () => {
    const map: MerkleMap = new MerkleMap();

    let minaKey: Field;
    let bitcoinKey: Field;
    let chainlinkKey: Field;
    let solanaKey: Field;
    let ethereumKey: Field;
    let cardanoKey: Field;
    let avalancheKey: Field;
    let rippleKey: Field;
    let dogeKey: Field;
    let polygonKey: Field;

    let minaPrice: Field;
    let bitcoinPrice: Field;
    let ethereumPrice: Field;
    let solanaPrice: Field;
    let chainlinkPrice: Field;
    let cardanoPrice: Field;
    let avalanchePrice: Field;
    let ripplePrice: Field;
    let polygonPrice: Field;
    let dogePrice: Field;

    let tokenInformation: TokenInformationArray;

    beforeAll(async () => {
      minaKey = CircuitString.fromString('Mina').hash();
      bitcoinKey = CircuitString.fromString('Bitcoin').hash();
      chainlinkKey = CircuitString.fromString('Chainlink').hash();
      solanaKey = CircuitString.fromString('Solana').hash();
      ethereumKey = CircuitString.fromString('Ethereum').hash();
      cardanoKey = CircuitString.fromString('Cardano').hash();
      avalancheKey = CircuitString.fromString('Avalanche').hash();
      rippleKey = CircuitString.fromString('Ripple').hash();
      dogeKey = CircuitString.fromString('Dogecoin').hash();
      polygonKey = CircuitString.fromString('Polygon').hash();

      minaPrice = Field.from(5248770935);
      bitcoinPrice = Field.from(615439169547040);
      ethereumPrice = Field.from(34421115510507);
      solanaPrice = Field.from(1481398311039);
      chainlinkPrice = Field.from(143095980879);
      cardanoPrice = Field.from(3907233838);
      avalanchePrice = Field.from(278604715977);
      ripplePrice = Field.from(4749419511);
      polygonPrice = Field.from(5645415935);
      dogePrice = Field.from(1261024335);

      map.set(minaKey, minaPrice);
      map.set(bitcoinKey, bitcoinPrice);
      map.set(chainlinkKey, chainlinkPrice);
      map.set(solanaKey, solanaPrice);
      map.set(ethereumKey, ethereumPrice);
      map.set(cardanoKey, cardanoPrice);
      map.set(avalancheKey, avalanchePrice);
      map.set(rippleKey, ripplePrice);
      map.set(dogeKey, dogePrice);
      map.set(polygonKey, polygonPrice);

      tokenInformation = new TokenInformationArray({
        prices: [
          minaPrice,
          bitcoinPrice,
          ethereumPrice,
          solanaPrice,
          ripplePrice,
          cardanoPrice,
          avalanchePrice,
          polygonPrice,
          chainlinkPrice,
          dogePrice,
        ],
      });
    });

    it('Should init the (BASE) commitment, IPFS hash, secret and prices. Fail the next time irrespective of the inputs/caller.', async () => {
      let updatedCommitment = map.getRoot();
      let updatedIPFS = IpfsCID.fromString('init_IPFS');

      await Mina.transaction(oracle, async () => {
        await doot.initBase(updatedCommitment, updatedIPFS, tokenInformation);
      })
        .sign([oraclePK])
        .prove()
        .send();

      const proof = await doot.offchainState.createSettlementProof();
      await Mina.transaction(oracle, async () => {
        await doot.settle(proof);
      })
        .prove()
        .sign([oraclePK])
        .send();

      const values = await doot.offchainState.fields.tokenInformation.get(
        Field(0)
      );
      const anotherValue = await doot.getPrices();

      expect(Field.from(values.value.prices[0]).toString()).toEqual(
        Field.from(anotherValue.prices[0]).toString()
      );

      try {
        map.set(minaKey, Field.from(5248770931));
        updatedCommitment = map.getRoot();
        updatedIPFS = IpfsCID.fromString('updated_IPFS');

        tokenInformation = new TokenInformationArray({
          prices: [
            Field.from(5248770931),
            bitcoinPrice,
            ethereumPrice,
            solanaPrice,
            ripplePrice,
            cardanoPrice,
            avalanchePrice,
            polygonPrice,
            chainlinkPrice,
            dogePrice,
          ],
        });

        await Mina.transaction(oracle, async () => {
          await doot.initBase(updatedCommitment, updatedIPFS, tokenInformation);
        })
          .prove()
          .sign([oraclePK])
          .send();

        throw new Error('Expected_transaction_to_fail');
      } catch (err: unknown) {
        console.log('');
      }
    });

    it('Should update the storage only if the caller is known.', async () => {
      map.set(minaKey, Field.from(6048770935));
      let updatedCommitment = map.getRoot();
      let updatedIPFS = IpfsCID.fromString(
        'QmQy34PrqnoCBZySFAkRsC9q5BSFESGUxX6X8CQtr11110'
      );

      tokenInformation = new TokenInformationArray({
        prices: [
          Field.from(6048770935),
          bitcoinPrice,
          ethereumPrice,
          solanaPrice,
          ripplePrice,
          cardanoPrice,
          avalanchePrice,
          polygonPrice,
          chainlinkPrice,
          dogePrice,
        ],
      });

      let onChainCommitment = doot.commitment.get();
      expect(onChainCommitment != updatedCommitment);

      await Mina.transaction(oracle, async () => {
        await doot.update(updatedCommitment, updatedIPFS, tokenInformation);
      })
        .prove()
        .sign([oraclePK])
        .send();

      const proof = await doot.offchainState.createSettlementProof();
      await Mina.transaction(oracle, async () => {
        await doot.settle(proof);
      })
        .prove()
        .sign([oraclePK])
        .send();

      map.set(minaKey, Field.from(6048770912));
      updatedIPFS = IpfsCID.fromString(
        'QmQy34PrqnoCBZySFAkRsC9q5BSFESGUxX6X8CQtr11111'
      );
      updatedCommitment = map.getRoot();

      tokenInformation = new TokenInformationArray({
        prices: [
          Field.from(6048770912),
          bitcoinPrice,
          ethereumPrice,
          solanaPrice,
          ripplePrice,
          cardanoPrice,
          avalanchePrice,
          polygonPrice,
          chainlinkPrice,
          dogePrice,
        ],
      });

      onChainCommitment = doot.commitment.get();
      expect(onChainCommitment != updatedCommitment);

      try {
        await Mina.transaction(random, async () => {
          await doot.update(updatedCommitment, updatedIPFS, tokenInformation);
        })
          .prove()
          .sign([randomPK])
          .send();

        throw new Error('Expected_transaction_to_fail');
      } catch (err: unknown) {
        console.log();
      }
    });
  });
});
