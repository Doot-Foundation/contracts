import { Doot, IpfsCID, TokenInformationArrayInput } from './Doot';
import {
  PrivateKey,
  PublicKey,
  Field,
  Mina,
  AccountUpdate,
  MerkleMap,
  CircuitString,
  UInt64,
  Signature,
} from 'o1js';

describe('Doot.js', () => {
  let oraclePK: PrivateKey;
  let oracle: PublicKey;
  let zkAppAddress: PublicKey;
  let zkAppPrivateKey: PrivateKey;
  let doot: Doot;
  let randomPK: PrivateKey;
  let random: PublicKey;

  const map: MerkleMap = new MerkleMap();
  const tokenKeys: Field[] = [];
  let prices: Field[] = [];
  let timestampCursor = UInt64.from(1_700_000_000_000n);
  const timestampStep = UInt64.from(60_000);
  let expectedSeq = 0n;

  const buildPayload = (priceList: Field[]): TokenInformationArrayInput => {
    timestampCursor = timestampCursor.add(timestampStep);
    return new TokenInformationArrayInput({
      prices: [...priceList],
      lastUpdatedAt: timestampCursor,
    });
  };

  const setPrice = (index: number, value: Field) => {
    prices[index] = value;
    map.set(tokenKeys[index], value);
  };

  beforeAll(async () => {
    const Local = await Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);

    oraclePK = Local.testAccounts[0].key;
    oracle = oraclePK.toPublicKey();

    randomPK = Local.testAccounts[1].key;
    random = randomPK.toPublicKey();

    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();

    doot = new Doot(zkAppAddress);

    await Doot.compile();

    await Mina.transaction(oracle, async () => {
      AccountUpdate.fundNewAccount(oracle);
      await doot.deploy();
    })
      .sign([oraclePK, zkAppPrivateKey])
      .prove()
      .send();

    const symbols = [
      'Mina',
      'Bitcoin',
      'Ethereum',
      'Solana',
      'Ripple',
      'Cardano',
      'Avalanche',
      'Polygon',
      'Chainlink',
      'Dogecoin',
    ];

    symbols.forEach((symbol) => {
      tokenKeys.push(CircuitString.fromString(symbol).hash());
    });

    prices = [
      Field.from(5248770935),
      Field.from(615439169547040),
      Field.from(34421115510507),
      Field.from(1481398311039),
      Field.from(4749419511),
      Field.from(3907233838),
      Field.from(278604715977),
      Field.from(5645415935),
      Field.from(143095980879),
      Field.from(1261024335),
    ];

    tokenKeys.forEach((key, idx) => map.set(key, prices[idx]));
  });

  describe('Init', () => {
    it('starts with empty owner, commitment and ipfs cid', () => {
      const onChainIpfsCID = doot.ipfsCID.get();
      const onChainIpfsCid = IpfsCID.fromCharacters(
        IpfsCID.unpack(onChainIpfsCID.packed)
      );
      expect(onChainIpfsCid.toString()).toEqual('');

      expect(doot.commitment.get()).toEqual(Field.from(0));
      expect(doot.owner.get()).toEqual(PublicKey.empty());
    });

    it('bootstraps commitment, timestamp and sequence once', async () => {
      const updatedCommitment = map.getRoot();
      const updatedIPFS = IpfsCID.fromString('init_IPFS');
      const payload = buildPayload(prices);

      await Mina.transaction(oracle, async () => {
        await doot.initBase(updatedCommitment, updatedIPFS, payload);
      })
        .sign([oraclePK])
        .prove()
        .send();

      expectedSeq += 1n;

      const latest = await doot.getPrices();
      expect(latest.prices[0].toString()).toEqual(prices[0].toString());
      expect(latest.priceSeq.toBigInt()).toEqual(expectedSeq);
      expect(latest.lastUpdatedAt.toBigInt()).toEqual(timestampCursor.toBigInt());

      const secondInit = (async () => {
        await Mina.transaction(oracle, async () => {
          await doot.initBase(
            map.getRoot(),
            IpfsCID.fromString('init_IPFS_again'),
            buildPayload(prices)
          );
        })
          .sign([oraclePK])
          .prove()
          .send();
      })();

      await expect(secondInit).rejects.toThrow();
    });
  });

  describe('Updates', () => {
    it('allows owner updates and rejects others', async () => {
      setPrice(0, Field.from(6048770935));

      const updatedCommitment = map.getRoot();
      const updatedIPFS = IpfsCID.fromString('QmOwnerUpdate');
      const ownerPayload = buildPayload(prices);

      await Mina.transaction(oracle, async () => {
        await doot.update(updatedCommitment, updatedIPFS, ownerPayload);
      })
        .sign([oraclePK])
        .prove()
        .send();

      expectedSeq += 1n;

      const afterOwnerUpdate = await doot.getPrices();
      expect(afterOwnerUpdate.priceSeq.toBigInt()).toEqual(expectedSeq);
      expect(afterOwnerUpdate.lastUpdatedAt.toBigInt()).toBeGreaterThan(0n);
      expect(afterOwnerUpdate.prices[0].toString()).toEqual(prices[0].toString());

      const outsiderPayload = buildPayload(
        prices
      );
      const outsiderAttempt = (async () => {
        await Mina.transaction(random, async () => {
          await doot.update(
            map.getRoot(),
            IpfsCID.fromString('QmBadCaller'),
            outsiderPayload
          );
        })
          .sign([randomPK])
          .prove()
          .send();
      })();

      await expect(outsiderAttempt).rejects.toThrow();

      const unchanged = await doot.getPrices();
      expect(unchanged.priceSeq.toBigInt()).toEqual(expectedSeq);
    });

    it('rejects stale timestamps', async () => {
      const before = await doot.getPrices();
      setPrice(1, prices[1].add(Field.from(10)));

      const stalePayload = new TokenInformationArrayInput({
        prices: [...prices],
        lastUpdatedAt: before.lastUpdatedAt,
      });

      const staleAttempt = (async () => {
        await Mina.transaction(oracle, async () => {
          await doot.update(
            map.getRoot(),
            IpfsCID.fromString('QmMonotonicTimestamp'),
            stalePayload
          );
        })
          .sign([oraclePK])
          .prove()
          .send();
      })();

      await expect(staleAttempt).rejects.toThrow();

      const updatedIPFS = IpfsCID.fromString('QmMonotonicTimestampFresh');
      await Mina.transaction(oracle, async () => {
        await doot.update(map.getRoot(), updatedIPFS, buildPayload(prices));
      })
        .sign([oraclePK])
        .prove()
        .send();

      expectedSeq += 1n;

      const latest = await doot.getPrices();
      expect(latest.lastUpdatedAt.toBigInt()).toBeGreaterThan(
        before.lastUpdatedAt.toBigInt()
      );
    });

    it('rejects non-incrementing price sequences', async () => {
      const before = await doot.getPrices();
      setPrice(2, prices[2].add(Field.from(10)));

      const updatedIPFS = IpfsCID.fromString('QmAutoSeq');
      await Mina.transaction(oracle, async () => {
        await doot.update(map.getRoot(), updatedIPFS, buildPayload(prices));
      })
        .sign([oraclePK])
        .prove()
        .send();

      expectedSeq += 1n;

      const latest = await doot.getPrices();
      expect(latest.priceSeq.toBigInt()).toEqual(before.priceSeq.toBigInt() + 1n);
    });

    it('verifies tuple signatures from the owner key', async () => {
      const latest = await doot.getPrices();
      const messageFields = [
        latest.priceSeq.value,
        latest.lastUpdatedAt.value,
        ...latest.prices,
      ];
      const signature = Signature.create(oraclePK, messageFields);

      await Mina.transaction(oracle, async () => {
        await doot.verifyPriceBundleSignature(signature, latest);
      })
        .sign([oraclePK])
        .prove()
        .send();
    });
  });
});
