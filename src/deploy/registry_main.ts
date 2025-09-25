import { Mina, PrivateKey, AccountUpdate, Field } from 'o1js';
import { Registry, SourceCodeGithub, SourceCodeIPFS } from '../contracts/Registry.js';

const doProofs = false;

let Local = await Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);

let deployerPK = Local.testAccounts[0].key;
let deployer = deployerPK.toPublicKey();

let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

let registryZkApp = new Registry(zkappAddress);

console.log('\nDeploying Registry...');

await Registry.compile();

const deployTxn = await Mina.transaction(deployer, async () => {
  AccountUpdate.fundNewAccount(deployer);
  await registryZkApp.deploy();
});
await deployTxn.prove();
await deployTxn.sign([deployerPK, zkappKey]).send();

console.log('\nInit registry...');

await Mina.transaction(deployer, async () => {
  await registryZkApp.initBase();
})
  .prove()
  .sign([deployerPK])
  .send();

console.log('\nUpgrade with implementation...');

let implementationAddress = PrivateKey.random().toPublicKey();

let githubLink = SourceCodeGithub.fromString('https://github.com/Doot/protocol');
let ipfsLink = SourceCodeIPFS.fromString('QmExampleHashForSourceCode123');

await Mina.transaction(deployer, async () => {
  await registryZkApp.upgrade(githubLink, ipfsLink, implementationAddress);
})
  .prove()
  .sign([deployerPK])
  .send();

console.log('Registry deployed and initialized!');
console.log('Registry address:', zkappAddress.toBase58());
console.log('Implementation:', implementationAddress.toBase58());
console.log('GitHub Source:', SourceCodeGithub.unpack(githubLink.packed).map(x => x.toString()).join(''));
console.log('IPFS Source:', SourceCodeIPFS.unpack(ipfsLink.packed).map(x => x.toString()).join(''));
