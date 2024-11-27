import { Doot, offchainState } from '../doot/Doot.js';
import { AggregationProgram20 } from '../doot/Aggregation.js';
import { Cache, PrivateKey } from 'o1js';

// Uploads the cached files to the set folder.
const cache: Cache = Cache.FileSystem('./doot_cache_files');
const aggregationCache: Cache = Cache.FileSystem('./aggregation_cache_files');

let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

let dootZkApp = new Doot(zkappAddress);
dootZkApp.offchainState.setContractInstance(dootZkApp);
await offchainState.compile();

await AggregationProgram20.compile({ cache: aggregationCache });
await Doot.compile({ cache: cache });
