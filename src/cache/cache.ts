import { Doot } from '../contracts/Doot.js';
import { Cache, PublicKey } from 'o1js';

// Uploads the cached files to the set folder.
const cache: Cache = Cache.FileSystem('./doot_cache_files');

// let zkappKey = PrivateKey.random();
// let zkappAddress = zkappKey.toPublicKey();
let zkappAddress = PublicKey.fromBase58(
  'B62qrbDCjDYEypocUpG3m6eL62zcvexsaRjhSJp5JWUQeny1qVEKbyP'
);

let dootZkApp = new Doot(zkappAddress);
await Doot.compile({ cache: cache });
