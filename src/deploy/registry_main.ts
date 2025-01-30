import * as dotenv from 'dotenv';
dotenv.config();

import { Mina, PublicKey, PrivateKey } from 'o1js';
import { MultiPackedStringFactory } from 'o1js-pack';

import { Registry } from '../contracts/Registry';

import registryObj from '@/keys/registry.json';
import dootObj from '@/keys/doot.json';

const DEPLOYER = process.env.DEPLOYER_PK;

const registryPK = PrivateKey.fromBase58(registryObj.privateKey);
const deployerPK = PrivateKey.fromBase58(DEPLOYER ? DEPLOYER : '');

const registry = registryPK.toPublicKey();
const deployer = deployerPK.toPublicKey();
const doot = PublicKey.fromBase58(dootObj.publicKey);

const ENDPOINT = 'https://proxy.devnet.minaexplorer.com/graphql';
const Devnet = Mina.Network(ENDPOINT);
Mina.setActiveInstance(Devnet);

const sourceCodeGit =
  'https://github.com/Doot-Foundation/Doot_L1Contracts/blob/main/src/Doot.ts';
const sourceCodeIPFS = 'CID';
