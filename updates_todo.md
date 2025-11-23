# Doot Contract Hardening – Timestamp + Sequence for Prices

Goal: expose objective freshness in Doot so downstream contracts (prediction markets, etc.) can enforce post‑end settlement without trusting an admin’s timing.

## Target State
- `TokenInformationArray` includes:
  - `prices: Field[10]`
  - `lastUpdatedAt: UInt64` (wall-clock ms or slot/height; pick and document)
  - `priceSeq: UInt64` (monotone counter, increments on every update)
- `getPrices()` returns the full struct (prices + timestamp + seq).
- OffchainState proofs enforce monotonicity; no rewinds.
- Markets can require `lastUpdatedAt >= endTime` and `priceSeq > lastSeqUsed` in `settle`.

## Contract Changes (Doot.ts)
1) **Struct update**
   - Extend `TokenInformationArray` with `lastUpdatedAt: UInt64`, `priceSeq: UInt64`.
   - Ensure OffchainState definition matches the new struct shape.
2) **Monotonicity**
   - In `initBase`/`update`, fetch previous value from `offchainState.fields.tokenInformation.get(Field(0))`.
   - Enforce `new.lastUpdatedAt > prev.lastUpdatedAt`.
   - Enforce `new.priceSeq > prev.priceSeq`.
   - Optionally sanity‑check `priceSeq` increments by +1 (not strictly required, but helpful for audits).
3) **getPrices**
   - Return the full struct (not just prices array).
   - Update any call sites/tests expecting only `prices`.
4) **OffchainState settle path**
   - No change in mechanics; ensure `createSettlementProof` works with the new struct.
5) **Optional authenticity helper**
   - If useful, add a helper method that verifies a signature over `(priceSeq, lastUpdatedAt, prices[])` by `owner`, so consumers can prove the tuple came from the oracle key (not strictly needed if they already trust OffchainState).

## Off-chain Pipeline Changes
1) **Data producer**
   - When building the map and `TokenInformationArray`, set:
     - `lastUpdatedAt`: timestamp of the price snapshot used.
     - `priceSeq`: previous seq + 1.
   - Persist the same values into any cached JSON/IPFS artifacts for reproducibility.
2) **Proof generation**
   - Regenerate the Prover/Verifier keys if struct hashing changes impact cached keys (likely yes). Clear `aggregation_cache_files` if necessary.
3) **Actions/CRON**
   - Ensure the update job writes the new fields and bumps seq every run.
4) **Backfill**
   - If migrating existing deployments, plan a one-time `initBase`/`update` that seeds correct `lastUpdatedAt` and `priceSeq` (e.g., start seq at 1).

## Tests to Update
- `Doot.test.ts`
  - Adjust fixtures to include `lastUpdatedAt`, `priceSeq`.
  - Add cases:
    - Reject update with same or lower `lastUpdatedAt`.
    - Reject update with same or lower `priceSeq`.
    - `getPrices` returns the timestamp/seq and they match the committed data after `settle`.
- Add a regression test proving a stale proof (older seq) cannot be re‑applied.

## Docs/Config
- `README.md`: document new fields, meaning of `lastUpdatedAt` (unit/source) and `priceSeq` (monotone counter).
- `config.json` / any sample configs: include the fields.
- If deploy scripts serialize the struct, update them.

## Integration Guidance (for prediction markets)
- Markets should:
  - Store `lastSeqUsed`.
  - In `settle`, call `getPrices()`, assert `priceSeq > lastSeqUsed`, `lastUpdatedAt >= endTime`, then record `priceReported`, `settlementTimestamp = lastUpdatedAt`, `lastSeqUsed = priceSeq`.
  - This enables permissionless, stale‑proof settlement.

## Open Decisions
- Choose time basis: wall‑clock ms vs. block height/slot. Wall‑clock aligns with existing code; block height is chain‑objective. Document the choice.
- Require `priceSeq` to increment by exactly +1, or just strictly greater? (Recommend +1 for deterministic audits.)
