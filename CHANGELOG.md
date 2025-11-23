# Changelog

## Doot contract infrastructure
- Doot oracle zkApp and off-chain rollup plumbing that power the L1 price feed.
- Tracks `TokenInformationArray` updates, settlement proofs, and deployment tooling.

## [0.3.0] - 2025-11-23
### Added
- `lastUpdatedAt` (ms) and `priceSeq` counters now derived on-chain in `initBase`/`update`; `getPrices()` returns the full bundle for freshness-aware consumers.
- Helper `verifyPriceBundleSignature` to validate owner signatures over `(priceSeq, lastUpdatedAt, prices[])`.
- Config metadata describing timestamp unit and sequence meaning.

### Changed
- `TokenInformationArrayInput` lets callers submit prices only; contract enforces monotonic timestamp/seq using `this.network.timestamp` and `globalSlotSinceGenesis` preconditions.
- Updated tests and deployment scripts to the new API and auto-seq/timestamp behavior; docs refreshed to explain the pattern.
- `index.ts` exports adjusted to match the pared-down surface.

### Removed
- Registry and Aggregation contracts, tests, deploy scripts, and exports moved to `extras/`; package scripts pruned accordingly.

## [0.2.0]
- Previous release with price array storage and off-chain settlement without timestamp/sequence hardening; Registry/Aggregation shipped as active modules.
