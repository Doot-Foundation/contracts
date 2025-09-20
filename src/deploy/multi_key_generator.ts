import { PrivateKey } from 'o1js';

/**
 * Multi-Key Generator for Doot Oracle
 * Generates multiple keypairs for .env configuration
 */

const keyCount = process.argv[2] ? parseInt(process.argv[2]) : 2;

console.log(`🔑 Generating ${keyCount} keypairs for Doot Oracle...\n`);

for (let i = 1; i <= keyCount; i++) {
  const privateKey = PrivateKey.random();
  const publicKey = privateKey.toPublicKey();

  console.log(`📋 Keypair ${i}:`);
  console.log(`Private Key: ${privateKey.toBase58()}`);
  console.log(`Public Key:  ${publicKey.toBase58()}`);
  console.log('');
}

console.log('💡 Usage in .env file:');
console.log('DEPLOYER_PK=<private-key-1>');
console.log('ORACLE_PK=<private-key-2>');
console.log('');
console.log('⚠️  SECURITY: Keep private keys secure and never commit to version control!');