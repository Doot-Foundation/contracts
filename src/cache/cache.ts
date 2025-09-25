import { Doot, offchainState } from '../contracts/Doot.js';
import { AggregationProgram20 } from '../contracts/Aggregation.js';
import { Cache, PrivateKey, PublicKey } from 'o1js';

// Uploads the cached files to the set folder.
const cache: Cache = Cache.FileSystem('./doot_cache_files');
const aggregationCache: Cache = Cache.FileSystem('./aggregation_cache_files');

// let zkappKey = PrivateKey.random();
// let zkappAddress = zkappKey.toPublicKey();
let zkappAddress = PublicKey.fromBase58(
  'B62qrMZXUtHh9TDEoQRmse8mct1LEjMsirdXLrQxpoo92xsWC285TEn'
);

let dootZkApp = new Doot(zkappAddress);
dootZkApp.offchainState.setContractInstance(dootZkApp);
await offchainState.compile();

await AggregationProgram20.compile({ cache: aggregationCache });
await Doot.compile({ cache: cache });
