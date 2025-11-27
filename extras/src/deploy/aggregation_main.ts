import {
  UInt64,
  Mina,
  AccountUpdate,
  PrivateKey,
  verify,
} from 'o1js';

import {
  AggregationProgram20,
  AggregationProof20,
  PriceAggregationArray20,
  VerifyAggregationProofGenerated,
} from '../contracts/Aggregation.js';

function generateDummy(count: number) {
  const result: UInt64[] = [];
  for (let i = 0; i < count; i++) {
    result.push(UInt64.from(1));
  }
  return result;
}

const doProofs = false;
let Local = await Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);

const deployerPK = Local.testAccounts[0].key;
const deployer = deployerPK.toPublicKey();
const zkappKey = PrivateKey.random();
const zkapp = zkappKey.toPublicKey();

console.log('\nCompiling...');
const { verificationKey: vk20 } = await AggregationProgram20.compile();
await VerifyAggregationProofGenerated.compile();

console.log('\nDeploying...');
const VerifyContract = new VerifyAggregationProofGenerated(zkapp);
await Mina.transaction(deployer, async () => {
  AccountUpdate.fundNewAccount(deployer);
  await VerifyContract.deploy();
})
  .prove()
  .sign([deployerPK, zkappKey])
  .send();

console.log('\nGenerating proof...');
const dummy20 = generateDummy(20);
const dummyInput20: PriceAggregationArray20 = new PriceAggregationArray20({
  pricesArray: dummy20,
  count: UInt64.from(20),
});

let proof20: AggregationProof20;
({ proof: proof20 } = await AggregationProgram20.base(dummyInput20));

const valid20 = await verify(proof20.toJSON(), vk20);
if (!valid20) {
  console.error('Proof verification failed');
  process.exit(1);
}

console.log('\nVerifying in contract...');
await Mina.transaction(deployer, async () => {
  await VerifyContract.verifyAggregationProof20(proof20);
})
  .prove()
  .sign([deployerPK])
  .send();

console.log('\n✅ Aggregation contract deployed and tested successfully!');
console.log('Contract address:', zkapp.toBase58());
console.log('Proof output:', proof20.publicOutput.toString());
