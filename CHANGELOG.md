# Changelog

## Doot contract infrastructure
- Doot oracle zkApp and off-chain rollup plumbing that power the L1 price feed.
- Tracks `TokenInformationArray` updates, settlement proofs, and deployment tooling.

## [0.3.1] - 2025-11-23
### Changed
- Removed on-chain network timestamp/slot reads; callers continue to supply `lastUpdatedAt`, contract auto-increments `priceSeq`.
- Deploy scripts now set `lastUpdatedAt` via `Date.now()` (no network fetch); tests/docs aligned to the simplified API.

### Added
- Optional slot helper (`src/utils/slot.ts`) for off-chain timestamp derivation from runtimeConfig (not used by default).

### Fixed
- Deployment resilience on Zeko by avoiding network precondition calls for time/slot.

## [0.3.0] - 2025-11-23
### Added
- `lastUpdatedAt` (ms) and `priceSeq` in `TokenInformationArray`; `getPrices()` returns the full bundle for freshness-aware consumers.
- Helper `verifyPriceBundleSignature` to validate owner signatures over `(priceSeq, lastUpdatedAt, prices[])`.
- Config metadata describing timestamp unit and sequence meaning.

### Changed
- `TokenInformationArrayInput` carries prices + caller-provided `lastUpdatedAt`; contract enforces monotonic timestamp and auto-increments `priceSeq` on-chain.
- Updated tests and deployment scripts to the new API and auto-seq/timestamp behavior; docs refreshed to explain the pattern.
- `index.ts` exports adjusted to match the pared-down surface.

### Removed
- Registry and Aggregation contracts, tests, deploy scripts, and exports moved to `extras/`; package scripts pruned accordingly.

## [0.2.0]
- Previous release with price array storage and off-chain settlement without timestamp/sequence hardening; Registry/Aggregation shipped as active modules.
