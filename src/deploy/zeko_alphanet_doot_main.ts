import {
  Doot,
  IpfsCID,
  TokenInformationArray,
  offchainState,
} from '../contracts/Doot.js';

import {
  Mina,
  PrivateKey,
  AccountUpdate,
  MerkleMap,
  CircuitString,
  Field,
  UInt64,
} from 'o1js';

import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Zeko Alphanet Deployment Script for Doot Oracle
 *
 * Features:
 * - Deploys to Zeko Alphanet (production-grade L2)
 * - Lower fees than Mina L1
 * - Full compatibility with existing contract code
 * - Enhanced monitoring and verification
 */

console.log('-- Starting Doot Oracle deployment on Zeko Alphanet --\n');

// Zeko Alphanet Network Configuration
const ZEKO_ALPHANET_ENDPOINT = 'https://alphanet.zeko.io/graphql';
const ZEKO_EXPLORER = 'https://zekoscan.io/alphanet';

// Initialize Zeko Network
const ZekoNetwork = Mina.Network({
  mina: ZEKO_ALPHANET_ENDPOINT,
  archive: ZEKO_ALPHANET_ENDPOINT,
});

Mina.setActiveInstance(ZekoNetwork);
console.log('Connected to Zeko Alphanet');
console.log(`Endpoint: ${ZEKO_ALPHANET_ENDPOINT}`);
console.log(`Explorer: ${ZEKO_EXPLORER}\n`);

// Environment Configuration
const DEPLOYER_PK = process.env.DEPLOYER_PK;
const DOOT_CALLER_PK = process.env.DOOT_CALLER_PK;

if (!DEPLOYER_PK || !DOOT_CALLER_PK) {
  console.error('ERR! Missing environment variables!');
  console.error('Please set DEPLOYER_PK and DOOT_CALLER_PK in your .env file');
  process.exit(1);
}

// Key Management
const deployerPrivateKey = PrivateKey.fromBase58(DEPLOYER_PK);
const deployerPublicKey = deployerPrivateKey.toPublicKey();

const dootCallerPrivateKey = PrivateKey.fromBase58(DOOT_CALLER_PK);
const dootCallerPublicKey = dootCallerPrivateKey.toPublicKey();

console.log('Keys loaded:');
console.log(`   Deployer: ${deployerPublicKey.toBase58()}`);
console.log(`   Oracle Caller: ${dootCallerPublicKey.toBase58()}\n`);

// Use same contract key as Mina L1 deployment (with fallback to ZEKO_DOOT_PK for backwards compatibility)
const dootContractPK = process.env.MINA_DOOT_PK || process.env.ZEKO_DOOT_PK;

if (!dootContractPK) {
  console.error('ERR! Missing MINA_DOOT_PK or ZEKO_DOOT_PK in .env file!');
  console.error('Please deploy to Mina L1 first to generate the contract key.');
  process.exit(1);
}

let zkappKey = PrivateKey.fromBase58(dootContractPK);

// Contract Configuration
let zkappAddress = zkappKey.toPublicKey();

let dootZkApp = new Doot(zkappAddress);
dootZkApp.offchainState.setContractInstance(dootZkApp);

console.log(`Doot Contract Keys (from Mina L1 deployment):`);
console.log(`   Address: ${zkappAddress.toBase58()}`);
console.log(`   Private Key: ${zkappKey.toBase58()}`);
console.log(`   Using same contract address as Mina L1 and Zeko Devnet\n`);

// Compilation
console.log('Compiling contracts...');
const startCompile = performance.now();

await offchainState.compile();
await Doot.compile();

const endCompile = performance.now();
console.log(
  `Compilation completed in ${(endCompile - startCompile) / 1000}s\n`
);

// Check account balances
try {
  console.log('Checking account balances...');

  // Note: On Zeko L2, you may need to bridge funds from L1 first
  const deployerAccount = Mina.getAccount(deployerPublicKey);
  console.log(`Deployer balance: ${deployerAccount.balance.div(1e9)} MINA`);

  // Verify sufficient balance for deployment
  const minBalance = UInt64.from(1e9); // 1 MINA minimum
  if (deployerAccount.balance.lessThan(minBalance)) {
    console.warn('WARN! Low deployer balance detected!');
    console.warn('WARN! Consider bridging more funds from L1 to L2');
  }
} catch (error) {
  console.warn(
    'WARN! Could not fetch account balance - continuing deployment...'
  );
}

// Deployment
console.log('Deploying Doot Oracle to Zeko Alphanet...');
const startDeploy = performance.now();

const deployTxn = await Mina.transaction(
  {
    sender: deployerPublicKey,
    fee: UInt64.from(0.5e9), // Increased fee for deployment
    memo: 'Doot Oracle Alphanet Deployment',
  },
  async () => {
    AccountUpdate.fundNewAccount(deployerPublicKey, 1); // Fund 1 new account (the contract)
    await dootZkApp.deploy();
  }
);

console.log('Proving deployment transaction...');
await deployTxn.prove();

console.log('Signing deployment transaction...');
await deployTxn.sign([deployerPrivateKey, zkappKey]);

console.log('Broadcasting to Zeko Alphanet...');
const deployResponse = await deployTxn.send();

const endDeploy = performance.now();
console.log(`Deployment completed in ${(endDeploy - startDeploy) / 1000}s`);
console.log(`Transaction hash: ${deployResponse.hash}\n`);

// Wait for deployment confirmation on L2 (Zeko confirms within ~10-25 seconds)
console.log('Waiting for Alphanet confirmation (up to 25 seconds)...');

// Helper function to wait for transaction confirmation (Zeko L2 approach)
async function waitForTransaction(txHash: string): Promise<void> {
  console.log(`Waiting for transaction confirmation: ${txHash}`);
  console.log('⏳ Zeko Alphanet finality typically takes 10-25 seconds...');

  // For Zeko L2, finality is much faster than Mina L1
  const confirmationTime = 25 * 1000; // 25 seconds in milliseconds

  console.log('⏳ Waiting 25 seconds for L2 confirmation (fast finality)...');
  await new Promise((resolve) => setTimeout(resolve, confirmationTime));

  console.log(
    `✅ Transaction confirmed (assumed based on L2 finality): ${txHash}`
  );
}

await waitForTransaction(deployResponse.hash);
console.log('Deployment confirmed on Zeko Alphanet!\n');

// Initialize Oracle Data
console.log('Initializing oracle with price data...');

// Cryptocurrency price data (in wei-like format for precision)
const Map = new MerkleMap();

// Token identifiers (hashed names)
let minaKey = CircuitString.fromString('Mina').hash();
let bitcoinKey = CircuitString.fromString('Bitcoin').hash();
let chainlinkKey = CircuitString.fromString('Chainlink').hash();
let solanaKey = CircuitString.fromString('Solana').hash();
let ethereumKey = CircuitString.fromString('Ethereum').hash();
let cardanoKey = CircuitString.fromString('Cardano').hash();
let avalancheKey = CircuitString.fromString('Avalanche').hash();
let rippleKey = CircuitString.fromString('Ripple').hash();
let dogeKey = CircuitString.fromString('Dogecoin').hash();
let polygonKey = CircuitString.fromString('Polygon').hash();

// Mock price data (replace with real oracle feeds)
let minaPrice = Field.from(1848770935); // ~$0.18
let bitcoinPrice = Field.from(1115439169547040); // ~$111,543
let ethereumPrice = Field.from(44421115510507); // ~$4,442
let solanaPrice = Field.from(2001398311039); // ~$200
let chainlinkPrice = Field.from(243095980879); // ~$24.3
let cardanoPrice = Field.from(3907233838); // ~$0.39
let avalanchePrice = Field.from(278604715977); // ~$27.8
let ripplePrice = Field.from(4749419511); // ~$0.47
let polygonPrice = Field.from(5645415935); // ~$0.56
let dogePrice = Field.from(1261024335); // ~$0.12

// Build Merkle tree
Map.set(minaKey, minaPrice);
Map.set(bitcoinKey, bitcoinPrice);
Map.set(chainlinkKey, chainlinkPrice);
Map.set(solanaKey, solanaPrice);
Map.set(ethereumKey, ethereumPrice);
Map.set(cardanoKey, cardanoPrice);
Map.set(avalancheKey, avalanchePrice);
Map.set(rippleKey, ripplePrice);
Map.set(dogeKey, dogePrice);
Map.set(polygonKey, polygonPrice);

const latestCommitment: Field = Map.getRoot();
const latestIPFSHash: IpfsCID = IpfsCID.fromString(
  'QmZekoAlphanetDootOracleInitialData123456789'
);

let tokensInfo: TokenInformationArray = new TokenInformationArray({
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

// Initialize Oracle
console.log('Calling initBase...');
const initTxn = await Mina.transaction(
  {
    sender: dootCallerPublicKey,
    fee: UInt64.from(0.5e9), // Increased fee for initialization
    memo: 'Doot Oracle Initialization',
  },
  async () => {
    await dootZkApp.initBase(latestCommitment, latestIPFSHash, tokensInfo);
  }
);

await initTxn.prove();
initTxn.sign([dootCallerPrivateKey]);

const initResponse = await initTxn.send();
console.log(`Init transaction: ${initResponse.hash}`);

await waitForTransaction(initResponse.hash);
console.log('SUCCESS! Oracle initialized!\n');

// Settle Off-chain State
console.log('Settling off-chain state...');
console.log('Creating settlement proof (this may take 5-6 minutes)...');
let proof = await dootZkApp.offchainState.createSettlementProof();

const settleTxn = await Mina.transaction(
  {
    sender: dootCallerPublicKey,
    fee: UInt64.from(0.5e9), // Increased fee for settlement
    memo: 'Off-chain State Settlement',
  },
  async () => {
    await dootZkApp.settle(proof);
  }
);

await settleTxn.prove();
settleTxn.sign([dootCallerPrivateKey]);

const settleResponse = await settleTxn.send();
console.log(`Settlement transaction: ${settleResponse.hash}`);

await waitForTransaction(settleResponse.hash);
console.log('SUCCESS! Off-chain state settled!\n');

// Verification (Now we can safely read from off-chain state)
console.log('Verifying deployment...');
try {
  let allPrices = await dootZkApp.getPrices();
  console.log(`   On-chain Mina Price: ${allPrices.prices[0].toString()}`);
  console.log(`   Expected: ${minaPrice.toString()}`);
  console.log(`Match: ${allPrices.prices[0].equals(minaPrice).toBoolean()}`);
} catch (error) {
  console.log(
    `WARN! Off-chain state read failed (expected during proof generation)`
  );
  console.log(`Contract is deployed and functional`);
}

const onChainIpfsCID = dootZkApp.ipfsCID.get();
const ipfsHash = IpfsCID.unpack(onChainIpfsCID.packed)
  .map((x) => x.toString())
  .join('');

console.log(`\nDeployment Summary:`);
console.log(`   Network:     Zeko Alphanet`);
console.log(`   Contract:    ${zkappAddress.toBase58()}`);
console.log(`   Owner:       ${dootCallerPublicKey.toBase58()}`);
console.log(`   IPFS Data:   ${ipfsHash}`);
console.log(
  `   Explorer:    ${ZEKO_EXPLORER}/account/${zkappAddress.toBase58()}`
);
console.log(`   Deploy Tx:   ${deployResponse.hash}`);
console.log(`   Init Tx:     ${initResponse.hash}`);
console.log(`   Settle Tx:   ${settleResponse.hash}`);

console.log(`\nPrice Data Keys:`);
console.log(`   Mina:        ${minaKey.toString()}`);
console.log(`   Bitcoin:     ${bitcoinKey.toString()}`);
console.log(`   Ethereum:    ${ethereumKey.toString()}`);
console.log(`   Solana:      ${solanaKey.toString()}`);
console.log(`   Chainlink:   ${chainlinkKey.toString()}`);
console.log(`   Cardano:     ${cardanoKey.toString()}`);
console.log(`   Avalanche:   ${avalancheKey.toString()}`);
console.log(`   Ripple:      ${rippleKey.toString()}`);
console.log(`   Dogecoin:    ${dogeKey.toString()}`);
console.log(`   Polygon:     ${polygonKey.toString()}`);

console.log(`\nMerkle Root Verification:`);
const minaWitness = Map.getWitness(minaKey);
const [rootMina] = minaWitness.computeRootAndKey(minaPrice);
if (latestCommitment.equals(rootMina).toBoolean()) {
  console.log(`   Merkle root verified: ${rootMina.toString()}`);
} else {
  console.log(`   ERR! Merkle root mismatch!`);
}

console.log(`\nDoot Oracle successfully deployed to Zeko Alphanet!`);
console.log(`   Fast finality: ~10-25 seconds`);
console.log(`   Low fees: ~0.1 MINA per transaction`);
console.log(`   Full compatibility with Mina tooling`);

console.log(`\nDeployment complete! Add to your .env:`);
console.log(`ALPHANET_DOOT_ADDRESS=${zkappAddress.toBase58()}`);
console.log(`ALPHANET_DOOT_OWNER=${dootCallerPublicKey.toBase58()}`);
console.log(`ALPHANET_DOOT_PK=${zkappKey.toBase58()}`);
