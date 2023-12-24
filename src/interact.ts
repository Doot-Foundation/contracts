import dotenv from 'dotenv';
dotenv.config();

import { Doot, IpfsCID } from './Doot.js';

import {
  Mina,
  PrivateKey,
  AccountUpdate,
  MerkleMap,
  Poseidon,
  CircuitString,
  Field,
  MerkleMapWitness,
} from 'o1js';

async function frameKey(key: CircuitString) {
  return Poseidon.hash(key.toFields());
}

// async function getAndUpdateIPFSData() {
//   try {
//     const response = await axios.get(url);
//     const data = response.data; // Assuming the fetched data is in the form of an object

//     // Append fetched data to the end of 'historical'
//     data.historical = {
//       ...data.historical,
//       ...data.latest,
//     };

//     data.latest = {
//       currentTimestamp: {
//         price,
//         decimal,
//         lastUpdated,
//         signature,
//         active,
//         urls,
//         prices,
//         signatures,
//         tlsnProofs,
//         l1MerkleMapWitness,
//       },
//     };

//     console.log('Updated data:', data);
//   } catch (error) {
//     console.error('Error fetching data:', error);
//   }
// }

const doProofs = false;

let Local = Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);
// let initialBalance = 10_000_000_000;

let oraclePK = Local.testAccounts[0].privateKey;
let oracle = oraclePK.toPublicKey();

let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

// let lighouseKey = process.env.LIGHTHOUSE_KEY;

let minaKey = await frameKey(CircuitString.fromString('Mina'));
let bitcoinKey = await frameKey(CircuitString.fromString('Bitcoin'));
let chainlinkKey = await frameKey(CircuitString.fromString('Chainlink'));
let solanaKey = await frameKey(CircuitString.fromString('Solana'));
let ethereumKey = await frameKey(CircuitString.fromString('Ethereum'));

console.log('\nKEYS ->');
console.log(minaKey.toString());
console.log(bitcoinKey.toString());
console.log(chainlinkKey.toString());
console.log(solanaKey.toString());
console.log(ethereumKey.toString());

const Map = new MerkleMap();

let minaPrice = Field.from(7500000000);
let chainlinkPrice = Field.from(146100000000);
let solanaPrice = Field.from(778100000000);
let ethereumPrice = Field.from(22414900000000);
let bitcoinPrice = Field.from(435180100000000);

Map.set(minaKey, minaPrice);
Map.set(bitcoinKey, bitcoinPrice);
Map.set(chainlinkKey, chainlinkPrice);
Map.set(solanaKey, solanaPrice);
Map.set(ethereumKey, ethereumPrice);

let dootZkApp = new Doot(zkappAddress);

console.log('\nDeploying Doot...');

if (doProofs) {
  await Doot.compile();
}

/*
`txn.send()` returns a promise with two closures - `.wait()` and `.hash()`
`.hash()` returns the transaction hash, as the name might indicate
`.wait()` automatically resolves once the transaction has been included in a block. this is redundant for the LocalBlockchain, but very helpful for live testnets
*/

let tx = await Mina.transaction(oracle, () => {
  AccountUpdate.fundNewAccount(oracle);
  dootZkApp.deploy({ zkappKey: zkappKey });
});

await tx.prove();
await tx.sign([oraclePK, zkappKey]).send();

console.log('\nUpdating base values...');

let latestCommitment: Field = Map.getRoot();
let latestIPFSHash: IpfsCID = IpfsCID.fromString(
  'QmcNLBRwSQZDcdRe9uKUXZoLgnvTgAxx47Wfhod4JjYHTi'
);

tx = await Mina.transaction(oracle, () => {
  dootZkApp.setBase(latestCommitment, latestIPFSHash);
});

await tx.prove();
await tx.sign([oraclePK]).send();

const onChainIpfsCID = dootZkApp.ipfsCID.get();
const ipfsHash = IpfsCID.unpack(onChainIpfsCID.packed)
  .map((x) => x.toString())
  .join('');

console.log(`
  Review the latest/historical data at: https://ipfs.io/ipfs/${ipfsHash}`);

const minaWitness: MerkleMapWitness = Map.getWitness(minaKey);
const chainlinkWitness: MerkleMapWitness = Map.getWitness(chainlinkKey);
const solanaWitness: MerkleMapWitness = Map.getWitness(solanaKey);
const ethereumWitness: MerkleMapWitness = Map.getWitness(ethereumKey);
const bitcoinWitness: MerkleMapWitness = Map.getWitness(bitcoinKey);

const [rootMina] = minaWitness.computeRootAndKey(minaPrice);
const [rootChainlink] = chainlinkWitness.computeRootAndKey(chainlinkPrice);
const [rootSolana] = solanaWitness.computeRootAndKey(solanaPrice);
const [rootEthereum] = ethereumWitness.computeRootAndKey(ethereumPrice);
const [rootBitcoin] = bitcoinWitness.computeRootAndKey(bitcoinPrice);

console.log('\nROOTS ->');
console.log(latestCommitment.toString());
console.log(rootMina.toString());
console.log(rootChainlink.toString());
console.log(rootSolana.toString());
console.log(rootEthereum.toString());
console.log(rootBitcoin.toString());

console.log('\nVALUES ->');
console.log(Map.get(minaKey).toBigInt());
console.log(Map.get(chainlinkKey).toBigInt());
console.log(Map.get(solanaKey).toBigInt());
console.log(Map.get(ethereumKey).toBigInt());
console.log(Map.get(bitcoinKey).toBigInt());
