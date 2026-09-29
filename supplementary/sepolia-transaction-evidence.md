# Sepolia Transaction Evidence

Source data: `blockchainRecords` collection in the app's shared Firebase Realtime Database
(`https://blockchain-based-procurement-default-rtdb.firebaseio.com/procurement/blockchainRecords.json`).

**Important caveat:** this database is unauthenticated and publicly writable (`src/utils/sharedStorage.ts`
performs plain `fetch()` GET/PUT with no auth). The `onChain: true` field in a record is a claim written by
the client, not independently trustworthy. Every hash listed below was therefore re-verified directly against
live Sepolia chain state via `eth_getTransactionByHash` on a public RPC endpoint before being included here —
do not cite an `onChain: true` record from the app database as evidence without this independent check.

## Verified real transactions (as of 2026-09-28)

| Type | Tx hash | Chain-confirmed | To address | Notes |
|---|---|---|---|---|
| `whistleblower_report` | `0xa7831a9e7f6c46e34158ef014aa29ac36210c2f93b33dd57c62ce1d1980c2c07` | Yes — `chainId 0xaa36a7` (Sepolia), block `0xb13a2e` | `0xf3fc3eb93e38f3be978da0e5f1a24fd7fdb0e309` (matches `WhistleblowerVerifier` in README) | ZKP report submission, real on-chain execution |
| `tender_created` | `0xec5c240d375344c736357605a922657d3f2060bb082fd8e1ac4226388aae4b15` | Yes — `chainId 0xaa36a7` (Sepolia), block `0xb40aa0` | `0xdb9b1e94b5b69df7e401ddbede43491141047db3` (relayed call embedding `ProcurementSystem` address `0x5d8ca4b7...` in calldata — appears to route through a smart-account/relayer, not a direct EOA→contract call) | Tender creation, real on-chain execution |

## Not found in the current data snapshot

The shared database's 58 records include 6 with `onChain: true` + a transaction hash, but at the time of this
export none were tagged `dao_vote`/`dao_resolution` or `payment`. If the manuscript needs a DAO-voting or
payment-workflow transaction hash specifically, someone must connect a funded Sepolia wallet and exercise those
flows live (DAO tab → cast a vote; Post-Tendering → process a milestone payment) to generate fresh on-chain
records, then re-run the same RPC verification shown above before citing the resulting hash.

## Reproduction

```bash
curl -s "https://blockchain-based-procurement-default-rtdb.firebaseio.com/procurement/blockchainRecords.json" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print([r for r in d.values() if r and r.get('onChain') and r.get('transactionHash')])"

curl -s -X POST https://ethereum-sepolia-rpc.publicnode.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getTransactionByHash","params":["<HASH>"],"id":1}'
```
