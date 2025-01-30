import { PrivateKey } from 'o1js';

const generated = PrivateKey.random();
console.log(generated.toBase58());
console.log(generated.toPublicKey().toBase58());
