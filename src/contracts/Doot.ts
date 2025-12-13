import {
  SmartContract,
  Field,
  method,
  State,
  state,
  PublicKey,
  Signature,
  Struct,
  Provable,
  UInt64,
} from 'o1js';
import { MultiPackedStringFactory } from 'o1js-pack';

// lastUpdatedAt uses wall-clock milliseconds; priceSeq is a strictly increasing counter.
export class TokenInformationArray extends Struct({
  prices: Provable.Array(Field, 10),
  lastUpdatedAt: UInt64,
  priceSeq: UInt64,
}) {}

// Input shape supplied by callers; contract derives sequence internally.
export class TokenInformationArrayInput extends Struct({
  prices: Provable.Array(Field, 10),
  lastUpdatedAt: UInt64,
}) {}

export class IpfsCID extends MultiPackedStringFactory(2) {}

// Tokens is the CircuitString.hash().
export class Doot extends SmartContract {
  @state(Field) commitment = State<Field>();
  @state(IpfsCID) ipfsCID = State<IpfsCID>();
  @state(PublicKey) owner = State<PublicKey>();
  @state(TokenInformationArray) tokenInformation =
    State<TokenInformationArray>();

  init() {
    super.init();
  }

  /// Can only be called once
  @method async initBase(
    updatedCommitment: Field,
    updatedIpfsCID: IpfsCID,
    informationArray: TokenInformationArrayInput
  ) {
    this.commitment.getAndRequireEquals();
    this.ipfsCID.getAndRequireEquals();
    this.owner.getAndRequireEquals();

    this.owner.requireEquals(PublicKey.empty());

    this.commitment.set(updatedCommitment);
    this.ipfsCID.set(updatedIpfsCID);
    this.owner.set(this.sender.getAndRequireSignature());

    const lastPriceInformation = this.tokenInformation.getAndRequireEquals();

    const nextInformation = this.buildTokenInformation(
      informationArray,
      lastPriceInformation
    );

    this.tokenInformation.set(nextInformation);
  }

  @method async update(
    updatedCommitment: Field,
    updatedIpfsCID: IpfsCID,
    informationArray: TokenInformationArrayInput
  ) {
    this.commitment.getAndRequireEquals();
    this.ipfsCID.getAndRequireEquals();
    this.owner.getAndRequireEquals();

    this.owner.requireEquals(this.sender.getAndRequireSignature());

    this.commitment.set(updatedCommitment);
    this.ipfsCID.set(updatedIpfsCID);

    const lastPriceInformation = this.tokenInformation.getAndRequireEquals();

    const nextInformation = this.buildTokenInformation(
      informationArray,
      lastPriceInformation
    );

    this.tokenInformation.set(nextInformation);
  }

  private buildTokenInformation(
    input: TokenInformationArrayInput,
    previous: TokenInformationArray
  ) {
    const previousTimestamp = previous.lastUpdatedAt;
    const previousSeq = previous.priceSeq;

    input.lastUpdatedAt.assertGreaterThan(
      previousTimestamp,
      'timestamp must increase'
    );
    const nextTimestamp = input.lastUpdatedAt;
    const nextSeq = previousSeq.add(UInt64.one);

    nextSeq.assertGreaterThan(previousSeq, 'priceSeq must increase');

    return new TokenInformationArray({
      prices: input.prices,
      lastUpdatedAt: nextTimestamp,
      priceSeq: nextSeq,
    });
  }

  // Off-chain helper: reads the on-chain TokenInformationArray state.
  getPrices() {
    return this.tokenInformation.get();
  }

  @method async verifyPriceBundleSignature(
    signature: Signature,
    payload: TokenInformationArray
  ) {
    const owner = this.owner.getAndRequireEquals();
    const messageFields = [
      payload.priceSeq.value,
      payload.lastUpdatedAt.value,
      ...payload.prices,
    ];
    signature.verify(owner, messageFields).assertTrue();
  }

  @method async verify(
    signature: Signature,
    deployer: PublicKey,
    Price: Field
  ) {
    const validSignature = signature.verify(deployer, [Price]);
    validSignature.assertTrue();
  }
}
