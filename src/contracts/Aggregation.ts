import {
  UInt64,
  Provable,
  Struct,
  ZkProgram,
  SelfProof,
  SmartContract,
  method,
} from 'o1js';

export class PriceAggregationArray20 extends Struct({
  pricesArray: Provable.Array(UInt64, 20),
  count: UInt64,
}) {
  constructor(value: { pricesArray: UInt64[]; count: UInt64 }) {
    super(value);
    // Ensure the array has exactly 20 elements
    while (value.pricesArray.length < 20) {
      value.pricesArray.push(UInt64.from(0));
    }
    if (value.pricesArray.length > 20) {
      value.pricesArray = value.pricesArray.slice(0, 20);
    }
  }
}

export const AggregationProgram20 = ZkProgram({
  name: 'doot-prices-aggregation-program20',
  publicInput: PriceAggregationArray20,
  publicOutput: UInt64,

  methods: {
    base: {
      privateInputs: [],

      async method(publicInput: PriceAggregationArray20) {
        let currentSum: UInt64 = UInt64.from(0);
        for (let i = 0; i < 20; i++) {
          currentSum = currentSum.add(publicInput.pricesArray[i]);
        }

        return {
          publicOutput: currentSum.div(publicInput.count),
        };
      },
    },
    step: {
      privateInputs: [SelfProof],

      async method(
        publicInput: PriceAggregationArray20,
        privateInput: SelfProof<PriceAggregationArray20, UInt64>
      ) {
        privateInput.verify();

        let currentSum: UInt64 = UInt64.from(0);
        for (let i = 0; i < 20; i++) {
          currentSum = currentSum.add(publicInput.pricesArray[i]);
        }

        return {
          publicOutput: currentSum.div(publicInput.count),
        };
      },
    },
  },
});

export class PriceAggregationArray100 extends Struct({
  pricesArray: Provable.Array(UInt64, 100),
  count: UInt64,
}) {}

export const AggregationProgram100 = ZkProgram({
  name: 'doot-prices-aggregation-program100',
  publicInput: PriceAggregationArray100,
  publicOutput: UInt64,

  methods: {
    base: {
      privateInputs: [],

      async method(publicInput: PriceAggregationArray100) {
        let currentSum: UInt64 = UInt64.from(0);
        for (let i = 0; i < 100; i++) {
          currentSum = currentSum.add(publicInput.pricesArray[i]);
        }

        return {
          publicOutput: currentSum.div(publicInput.count),
        };
      },
    },
    step: {
      privateInputs: [SelfProof],

      async method(
        publicInput: PriceAggregationArray100,
        privateInput: SelfProof<PriceAggregationArray100, UInt64>
      ) {
        privateInput.verify();

        let currentSum: UInt64 = UInt64.from(0);
        for (let i = 0; i < 100; i++) {
          currentSum = currentSum.add(publicInput.pricesArray[i]);
        }

        return {
          publicOutput: currentSum.div(publicInput.count),
        };
      },
    },
  },
});

export class AggregationProof20 extends ZkProgram.Proof(AggregationProgram20) {}
export class AggregationProof100 extends ZkProgram.Proof(
  AggregationProgram100
) {}

await AggregationProgram100.compile();
await AggregationProgram20.compile();

export class VerifyAggregationProofGenerated extends SmartContract {
  init() {
    super.init();
  }

  @method async verifyAggregationProof20(proof: AggregationProof20) {
    proof.verify();
  }
  @method async verifyAggregationProof100(proof: AggregationProof100) {
    proof.verify();
  }
}
