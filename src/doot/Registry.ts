import { SmartContract, method, State, state, PublicKey, Field } from 'o1js';
import { MultiPackedStringFactory } from 'o1js-pack';

// 32 - 1chars, 2 - 64chars
export class SourceCodeGithub extends MultiPackedStringFactory(2) {}
export class SourceCodeIPFS extends MultiPackedStringFactory(2) {}

export class Registry extends SmartContract {
  @state(SourceCodeGithub) githubSourceLink = State<SourceCodeGithub>();
  @state(SourceCodeIPFS) ipfsSourceLink = State<SourceCodeIPFS>();
  @state(PublicKey) implementation = State<PublicKey>();
  @state(PublicKey) owner = State<PublicKey>();

  init() {
    super.init();
  }

  // Can only be called once.
  @method async initBase() {
    this.githubSourceLink.getAndRequireEquals();
    this.ipfsSourceLink.getAndRequireEquals();
    this.implementation.getAndRequireEquals();
    this.owner.getAndRequireEquals();

    this.owner.requireEquals(PublicKey.empty());

    this.owner.set(this.sender.getAndRequireSignatureV2());
  }

  @method async upgrade(
    updatedGithubLink: SourceCodeGithub,
    updatedIPFSLink: SourceCodeIPFS,
    updatedImplementation: PublicKey
  ) {
    this.githubSourceLink.getAndRequireEquals();
    this.ipfsSourceLink.getAndRequireEquals();
    this.implementation.getAndRequireEquals();
    this.owner.getAndRequireEquals();

    this.owner.requireEquals(this.sender.getAndRequireSignatureV2());

    this.githubSourceLink.set(updatedGithubLink);
    this.ipfsSourceLink.set(updatedIPFSLink);
    this.implementation.set(updatedImplementation);
  }
}
