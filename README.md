# Doot L1 Mina Smart Contract

Doot Oracle provides cryptographically verified price feeds on Mina. The active surface area of this repo is the Doot contract and its deployment scripts; the legacy Registry and Aggregation components have been parked under `extras/` for reference.

## Doot.ts
- Stores a `TokenInformationArray` with `prices[10]`, `lastUpdatedAt` (wall-clock ms), and `priceSeq` (strictly increasing, +1 per update).
- Callers supply `lastUpdatedAt`; the contract enforces monotonicity and bumps `priceSeq` on-chain.
- `getPrices()` returns the full struct so downstream consumers can gate settlement on both freshness and monotonic sequence.
- Off-chain rollups enforce `lastUpdatedAt` and `priceSeq` growth; stale updates or proofs are rejected.
- Helper `verifyPriceBundleSignature` verifies an owner signature over `(priceSeq, lastUpdatedAt, prices[])`.
- Recommended settlement pattern: require `priceSeq > lastSeqUsed` and `lastUpdatedAt >= marketEndTime` before accepting prices.

## Archived components
- Registry and Aggregation code, tests, and deploy scripts now live in `extras/` and are no longer part of the active build.

## Barter

There are two parts to the story. One implemented on Mina and other on Ethereum (EVM in general.)
The mina part deals with everything Mina Protocol.
The ethereum part deals with everything EVM.
