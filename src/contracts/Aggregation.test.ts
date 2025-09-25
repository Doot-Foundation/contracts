import {
  AggregationProgram20,
  AggregationProgram100,
  AggregationProof20,
  AggregationProof100,
  PriceAggregationArray20,
  PriceAggregationArray100,
  VerifyAggregationProofGenerated,
} from './Aggregation';

import {
  UInt64,
  Mina,
  PublicKey,
  AccountUpdate,
  PrivateKey,
  Proof,
  JsonProof,
  verify,
  Field,
} from 'o1js';

function testJsonRoundtrip<
  P extends Proof<any, any>,
  MyProof extends { fromJSON(jsonProof: JsonProof): Promise<P> }
>(MyProof: MyProof, proof: P) {
  let jsonProof = proof.toJSON();
  return MyProof.fromJSON(jsonProof);
}

function generateRandomPriceArray(
  base: bigint,
  count: number
): [UInt64[], bigint[]] {
  const result: UInt64[] = [];
  const bigResult: bigint[] = [];
  for (let i = 0; i < count; i++) {
    // Generate a random value between 0 and 100
    const randomValue = BigInt(Math.floor(Math.random() * 101));
    const positive = Math.floor(Math.random()) >= 0.5 ? true : false;

    // Add or subtract the random value from the base
    const newValue = positive ? base + randomValue : base - randomValue;
    result.push(UInt64.from(newValue));
    bigResult.push(newValue);
  }
  return [result, bigResult];
}

function generateDummy(count: number) {
  const result: UInt64[] = [];

  for (let i = 0; i < count; i++) {
    result.push(UInt64.from(1));
  }

  return result;
}
interface verificationKey {
  data: string;
  hash: Field;
}

describe('Aggregation.js', () => {
  let verifyAggPK: PrivateKey,
    verifyAgg: PublicKey,
    VerifyAggreagtionProof: VerifyAggregationProofGenerated,
    deployerPK: PrivateKey,
    deployer: PublicKey,
    vk20: verificationKey,
    vk100: verificationKey;

  beforeAll(async () => {
    let Local = await Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);

    verifyAggPK = PrivateKey.random();
    verifyAgg = verifyAggPK.toPublicKey();

    deployerPK = Local.testAccounts[0].key;
    deployer = deployerPK.toPublicKey();

    VerifyAggreagtionProof = new VerifyAggregationProofGenerated(verifyAgg);

    ({ verificationKey: vk20 } = await AggregationProgram20.compile());
    ({ verificationKey: vk100 } = await AggregationProgram100.compile());

    await VerifyAggregationProofGenerated.compile();

    await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await VerifyAggreagtionProof.deploy();
    })
      .sign([deployerPK, verifyAggPK])
      .prove()
      .send();
  });

  describe('Init', () => {
    it('Should complete setup.', async () => {
      console.log('');
    });
  });

  describe('Generate Aggregation Proof(20) off-chain and verify on-chain', () => {
    it('Should succeed with base case and then step case.', async () => {
      // BASE ----------------------
      const dummy20 = generateDummy(20);
      const dummyInput20: PriceAggregationArray20 = new PriceAggregationArray20(
        {
          pricesArray: dummy20,
          count: UInt64.from(20),
        }
      );

      let proof20: AggregationProof20;
      ({ proof: proof20 } = await AggregationProgram20.base(dummyInput20));
      proof20 satisfies AggregationProof20;
      proof20 = await testJsonRoundtrip(AggregationProof20, proof20);
      await verify(proof20.toJSON(), vk20);

      let expected20 = 1n;
      const generatedBaseOutput = proof20.publicOutput;
      expect(expected20.toString()).toEqual(generatedBaseOutput.toString());
      await Mina.transaction(deployer, async () => {
        await VerifyAggreagtionProof.verifyAggregationProof20(proof20);
      })
        .prove()
        .sign([deployerPK])
        .send();

      // STEP ----------------------
      const [stepInput20, stepBigValues20] = generateRandomPriceArray(
        66665248770934n,
        20
      );
      const stepPrices20: PriceAggregationArray20 = new PriceAggregationArray20(
        {
          pricesArray: stepInput20,
          count: UInt64.from(20),
        }
      );

      let stepProof20: AggregationProof20;
      ({ proof: stepProof20 } = await AggregationProgram20.step(
        stepPrices20,
        proof20
      ));
      stepProof20 satisfies AggregationProof20;
      stepProof20 = await testJsonRoundtrip(AggregationProof20, stepProof20);
      await verify(stepProof20.toJSON(), vk20);

      expected20 =
        stepBigValues20.reduce(
          (accumulator: bigint, currentValue) => accumulator + currentValue,
          0n
        ) / 20n;

      const generatedStepOutput = stepProof20.publicOutput;
      expect(expected20.toString()).toEqual(generatedStepOutput.toString());
      await Mina.transaction(deployer, async () => {
        await VerifyAggreagtionProof.verifyAggregationProof20(stepProof20);
      })
        .prove()
        .sign([deployerPK])
        .send();
    });
  });

  describe('Generate Aggregation Proof(100) off-chain and verify on-chain', () => {
    it('Should succeed with base case and then step case.', async () => {
      // BASE ----------------------
      const dummy100 = generateDummy(100);
      const dummyInput100: PriceAggregationArray100 =
        new PriceAggregationArray100({
          pricesArray: dummy100,
          count: UInt64.from(100),
        });

      let proof100: AggregationProof100;
      ({ proof: proof100 } = await AggregationProgram100.base(dummyInput100));
      proof100 satisfies AggregationProof100;
      proof100 = await testJsonRoundtrip(AggregationProof100, proof100);
      await verify(proof100.toJSON(), vk100);

      let expected100 = 1n;
      const generatedBaseOutput = proof100.publicOutput;
      expect(expected100.toString()).toEqual(generatedBaseOutput.toString());
      await Mina.transaction(deployer, async () => {
        await VerifyAggreagtionProof.verifyAggregationProof100(proof100);
      })
        .prove()
        .sign([deployerPK])
        .send();

      // STEP ----------------------
      const [stepInput100, stepBigValues100] = generateRandomPriceArray(
        66665248770934n,
        100
      );
      const stepPrices100: PriceAggregationArray100 =
        new PriceAggregationArray100({
          pricesArray: stepInput100,
          count: UInt64.from(100),
        });

      let stepProof100: AggregationProof100;
      ({ proof: stepProof100 } = await AggregationProgram100.step(
        stepPrices100,
        proof100
      ));
      stepProof100 satisfies AggregationProof100;
      stepProof100 = await testJsonRoundtrip(AggregationProof100, stepProof100);
      await verify(stepProof100.toJSON(), vk100);

      expected100 =
        stepBigValues100.reduce(
          (accumulator: bigint, currentValue) => accumulator + currentValue,
          0n
        ) / 100n;

      const generatedStepOutput = stepProof100.publicOutput;
      expect(expected100.toString()).toEqual(generatedStepOutput.toString());
      await Mina.transaction(deployer, async () => {
        await VerifyAggreagtionProof.verifyAggregationProof100(stepProof100);
      })
        .prove()
        .sign([deployerPK])
        .send();
    });
  });
});
