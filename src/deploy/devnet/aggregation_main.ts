import {
  UInt64,
  Mina,
  AccountUpdate,
  PrivateKey,
  Proof,
  JsonProof,
  verify,
} from 'o1js';

import {
  AggregationProgram20,
  AggregationProof20,
  PriceAggregationArray20,
  AggregationProgram100,
  AggregationProof100,
  PriceAggregationArray100,
  VerifyAggregationProofGenerated,
} from '../../Aggregation.js';

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

// SETUP LOCAL
const doProofs = false;
let Local = await Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);

// SETUP ACCOUNTS
const deployerPK = Local.testAccounts[0].key;
const deployer = deployerPK.toPublicKey();
const zkappKey = PrivateKey.random();
const zkapp = zkappKey.toPublicKey();

// COMPILE
const { verificationKey: vk20 } = await AggregationProgram20.compile();
const { verificationKey: vk100 } = await AggregationProgram100.compile();
await VerifyAggregationProofGenerated.compile();

// DEPLOY
const VerifyContract = new VerifyAggregationProofGenerated(zkapp);
await Mina.transaction(deployer, async () => {
  AccountUpdate.fundNewAccount(deployer);
  await VerifyContract.deploy();
})
  .prove()
  .sign([deployerPK, zkappKey])
  .send();

console.log('\n===== Completed Setup =====\n');

// START GENERATING ZKPROGRAM PROOFS

const dummy20 = generateDummy(20);
const dummyInput20: PriceAggregationArray20 = new PriceAggregationArray20({
  pricesArray: dummy20,
  count: UInt64.from(20),
});
const dummy100 = generateDummy(100);
const dummyInput100: PriceAggregationArray100 = new PriceAggregationArray100({
  pricesArray: dummy100,
  count: UInt64.from(100),
});

console.log('Generated dummy input.');

// BASE CASE 10
let proof20 = await AggregationProgram20.base(dummyInput20);
proof20 satisfies AggregationProof20;
proof20 = await testJsonRoundtrip(AggregationProof20, proof20);
await verify(proof20.toJSON(), vk20);

// BASE CASE 100
let proof100 = await AggregationProgram100.base(dummyInput100);
proof100 satisfies AggregationProof100;
proof100 = await testJsonRoundtrip(AggregationProof100, proof100);
await verify(proof100.toJSON(), vk100);

console.log('\nCompleted base proof and validation.');

const [values20, bigValues20] = generateRandomPriceArray(66665248770934n, 20);
const [values100, bigValues100] = generateRandomPriceArray(
  529999487170934n,
  100
);
// const [values1000, bigValues1000] = generateRandomPriceArray(5248770934n, 1000);

const prices20: PriceAggregationArray20 = new PriceAggregationArray20({
  pricesArray: values20,
  count: UInt64.from(20),
});
const prices100: PriceAggregationArray100 = new PriceAggregationArray100({
  pricesArray: values100,
  count: UInt64.from(100),
});

let expected20 =
  bigValues20.reduce(
    (accumulator: bigint, currentValue) => accumulator + currentValue,
    0n
  ) / 20n;
let expected100 =
  bigValues100.reduce(
    (accumulator: bigint, currentValue) => accumulator + currentValue,
    0n
  ) / 100n;

console.log('\nProduced prices array 20 & 100 successfully. \n');

// STEP CASE FOR PROOF 10
const start20 = performance.now();

proof20 = await AggregationProgram20.generateAggregationProof(
  prices20,
  proof20
);
console.log('Step Proof20 Generated.');
proof20 satisfies AggregationProof20;
console.log('Step Proof20 Sanity Check.');
proof20 = await testJsonRoundtrip(AggregationProof20, proof20);

const jsonProof20 = proof20.toJSON();
const jsonString20 = jsonProof20.proof;
const byteArray20 = new TextEncoder().encode(jsonString20);
const sizeInBytes20 = byteArray20.length;
console.log('Total size of Proof20 :', sizeInBytes20 / 1000 + 'KB');

const valid20 = await verify(proof20.toJSON(), vk20);
if (!valid20) {
  console.error('\nERR! VALID 20 FAILED.\n');
  process.exit(1);
}

const end20 = performance.now();

console.log(
  'Expected == Output :',
  expected20.toString() == proof20.publicOutput.toString()
);

console.log('Completed step proof and validation for proof 20.\n');

// STEP CASE FOR PROOF 100
const start100 = performance.now();

proof100 = await AggregationProgram100.generateAggregationProof(
  prices100,
  proof100
);
console.log('Step Proof100 Generated.');
proof100 satisfies AggregationProof100;
console.log('Step Proof100 Sanity Check.');
proof100 = await testJsonRoundtrip(AggregationProof100, proof100);

const jsonProof100 = proof100.toJSON();
const jsonString100 = JSON.stringify(jsonProof100);
const byteArray100 = new TextEncoder().encode(jsonString100);
const sizeInBytes100 = byteArray100.length;
console.log('Total size of Proof100 :', sizeInBytes100 / 1000 + 'KB');

const valid100 = await verify(proof100.toJSON(), vk100);
if (!valid100) {
  console.error('\nERR! VALID 100 FAILED.\n');
  process.exit(1);
}

const end100 = performance.now();

console.log(
  'Expected == Output :',
  expected100.toString() == proof100.publicOutput.toString()
);

console.log('Completed step proof and validation for proof 100.\n');

console.log('Execution time for aggregating 20 :', end20 - start20, 'ms.');
console.log('Execution time for aggregating 100 :', end100 - start100, 'ms.');

// VERIFY THE LATEST PROOF GENERATED USING THE VERIFY SMART CONTRACT
// The call will fail if wrong proof and vk combination.
await Mina.transaction(deployer, async () => {
  await VerifyContract.verifyAggregationProof20(proof20);
})
  .prove()
  .sign([deployerPK])
  .send();

console.log(
  '\nValidated the proof20 generated by ZkProgram inside the Smart Contract.'
);
await Mina.transaction(deployer, async () => {
  await VerifyContract.verifyAggregationProof100(proof100);
})
  .prove()
  .sign([deployerPK])
  .send();

console.log(
  'Validated the proof100 generated by ZkProgram inside the Smart Contract.'
);

console.log('\n============== Completed Successfully ==============\n');
