import { Doot, IpfsCID } from './contracts/Doot.js';
import { Mina, PublicKey, fetchAccount } from 'o1js';
import * as dotenv from 'dotenv';
dotenv.config();

console.log('Testing Mina L1 on-chain state reads...\n');

// Mina L1 Network
const MinaNetwork = Mina.Network({
  mina: 'https://api.minascan.io/node/devnet/v1/graphql',
  archive: 'https://api.minascan.io/archive/devnet/v1/graphql',
});
Mina.setActiveInstance(MinaNetwork);

// Contract address from deployment
const contractAddress = PublicKey.fromBase58('B62qpc3C3sERykDFCFSnTGWAn1jwr2cbe8YStggMsGn3MhmEW26GSwK');
const doot = new Doot(contractAddress);

try {
  // Test on-chain state reads only
  console.log('Fetching account data...');
  await fetchAccount({ publicKey: contractAddress }, 'https://api.minascan.io/node/devnet/v1/graphql');

  console.log('Reading on-chain state...');
  const commitment = doot.commitment.get();
  console.log(`Commitment: ${commitment.toString()}`);

  const ipfsCID = doot.ipfsCID.get();
  const ipfsHash = IpfsCID.unpack(ipfsCID.packed).map(x => x.toString()).join('');
  console.log(`IPFS Hash: ${ipfsHash}`);

  const owner = doot.owner.get();
  console.log(`Owner: ${owner.toBase58()}`);

  console.log('\n✅ On-chain state reads successful!');

} catch (error) {
  console.error('❌ Error reading on-chain state:', error);
}

try {
  // Test off-chain state (this might fail)
  console.log('\nTesting off-chain state...');
  const prices = await doot.getPrices();
  console.log(`Mina price: ${prices.prices[0].toString()}`);
  console.log('✅ Off-chain state working!');
} catch (error) {
  console.error('❌ Off-chain state failed:', error);
}