# Doot L1 Mina Smart Contract

This repository is responsible for tracking all the smart contracts under Doot - Data Feeds Oracle for Mina Protocol.

## Registry.ts

This contract is used to index the last updated implementation details.
These include -

1. Source code at Github.
2. Source code pinned at IPFS.
3. The address of the latest implementation.

A developer can refer to this contract regular to check for any changes regarding Doot Data Feeds Smart Contracts.

## Doot.ts

This contract is at the heart of the protocol. Responsible for bringing the current exchange rate on-chain. ATM updated every 2 hours.

A developer looking to fetch the exchange rate of one of the tracked cryptocurrencies can call `getPrice(token:CircuitString)` and use it in their smart contracts.

## AggregationProgram.ts

This contract is responsible for creating aggregation proof of each asset updates. which enables the aggregation process to be verifiable by nature. Since its a general ZkProgram we employ this directly in our price generation CRON jobs.

## Barter

There are two parts to the story. One implemented on Mina and other on Ethereum (EVM in general.)
The mina part deals with everything Mina Protocol.
The ethereum part deals with everything EVM.
