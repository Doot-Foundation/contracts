import { Mina, PrivateKey, AccountUpdate, Field } from 'o1js';
import {
  Registry,
  SourceCodeGithub,
  SourceCodeIPFS,
} from '../contracts/Registry.js';

const doProofs = false;

let Local = await Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);

let deployerPK = Local.testAccounts[0].key;
let deployer = deployerPK.toPublicKey();

let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

let registryZkApp = new Registry(zkappAddress);

console.log('Starting Registry deployment on Zeko L2...\n');
console.log('Deployer:', deployer.toBase58());
console.log('Registry address:', zkappAddress.toBase58());

console.log('\nCompiling Registry...');
await Registry.compile();

console.log('Deploying...');
const deployTxn = await Mina.transaction(deployer, async () => {
  AccountUpdate.fundNewAccount(deployer);
  await registryZkApp.deploy();
});
await deployTxn.prove();
await deployTxn.sign([deployerPK, zkappKey]).send();

console.log('🔧 Initializing registry...');
await Mina.transaction(deployer, async () => {
  await registryZkApp.initBase();
})
  .prove()
  .sign([deployerPK])
  .send();

console.log('Upgrading with implementation...');
let implementationAddress = PrivateKey.random().toPublicKey();
let githubLink = SourceCodeGithub.fromString(
  'https://github.com/Doot/protocol'
);
let ipfsLink = SourceCodeIPFS.fromString('QmZekoSourceCodeHash123456789');

await Mina.transaction(deployer, async () => {
  await registryZkApp.upgrade(githubLink, ipfsLink, implementationAddress);
})
  .prove()
  .sign([deployerPK])
  .send();

console.log('\nRegistry deployed successfully on Zeko L2!');
console.log('Registry address:', zkappAddress.toBase58());
console.log('Implementation:', implementationAddress.toBase58());
console.log(
  'GitHub Source:',
  SourceCodeGithub.unpack(githubLink.packed)
    .map((x) => x.toString())
    .join('')
);
console.log(
  'IPFS Source:',
  SourceCodeIPFS.unpack(ipfsLink.packed)
    .map((x) => x.toString())
    .join('')
);
