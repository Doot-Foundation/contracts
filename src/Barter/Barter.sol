// SPDX-License-Identifier:MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

enum TokenType {
  Native,
  WrappedNative
}

enum OrderType {
  General, // Based on the current ex rate.
  Precise // Simpy asking for x amount of MINA tokens against the ETH deposited.
}

struct Order {
  uint256 selfId;
  TokenType tokenType;
  OrderType orderType;
  uint256 ask;
  uint256 depositedAmount;
  bool fulfilled;
  address counterParty;
}

contract DootBarter {
  using SafeERC20 for IERC20;

  IERC20 public immutable I_WRAPPED_NATIVE;
  uint256 public immutable I_WRAPPED_DECIMALS;
  uint256 public constant C_MINA_DECIMALS = 9;

  address public Doot;
  mapping(address => string) public EthToMinaAddressBinding;
  mapping(address => Order[]) public userOrders;
  mapping(uint256 => Order) public order;
  mapping(bytes => bool) public fulfillmentUsed;
  Order[] public allOrders;

  constructor(address wrapped, uint256 decimals) {
    I_WRAPPED_NATIVE = IERC20(wrapped);
    I_WRAPPED_DECIMALS = decimals;
  }

  modifier onlyDoot() {
    if (msg.sender != Doot) revert('');
    _;
  }

  function setEthMinaPair(
    address ethAddress,
    string calldata minaAddress
  ) external onlyDoot {
    EthToMinaAddressBinding[ethAddress] = minaAddress;
  }

  function _bytesToUint(
    bytes memory b
  ) internal pure virtual returns (uint256) {
    require(b.length <= 32, 'Bytes length exceeds 32.');
    return abi.decode(abi.encodePacked(new bytes(32 - b.length), b), (uint256));
  }

  function _generateOrderId(address sender) internal view returns (uint256) {
    return _bytesToUint(abi.encodePacked(sender, block.timestamp));
  }

  function open(
    TokenType tokenType,
    OrderType orderType,
    uint256 amount,
    uint256 ask // Scaled to 1e9 cause of MINA having minimum value as NanoMina.
  ) external payable {
    address sender = msg.sender;
    uint256 orderId = _generateOrderId(sender);

    if (tokenType == TokenType.Native) {
      if (msg.value == 0) revert('ERR! ETH sent can not be 0.');
    } else {
      if (amount > I_WRAPPED_NATIVE.allowance(sender, address(this)))
        revert('Amount mistmatch with the value approved.');
      else {
        I_WRAPPED_NATIVE.safeTransferFrom(sender, address(this), amount);
      }
    }
    if (orderType == OrderType.Precise && ask == 0)
      revert('Ask can not be zero.');

    Order memory newOrder = Order({
      selfId: orderId,
      tokenType: tokenType,
      orderType: orderType,
      depositedAmount: amount,
      ask: ask,
      fulfilled: false,
      counterParty: address(0)
    });

    order[orderId] = newOrder;
    userOrders[sender].push(newOrder);
    allOrders.push(newOrder);
  }

  function fulfillClaim(
    uint256 orderId,
    uint256 minaAmountTransferred,
    bytes memory fulfillmentNotarySigned
  ) external {
    address sender = msg.sender;

    if (fulfillmentUsed[fulfillmentNotarySigned]) revert('Already fulfilled.');

    string memory senderMinaBindedAddress = EthToMinaAddressBinding[sender];

    bool notaryVerified = processSignedMinaOrder(
      orderId,
      minaAmountTransferred,
      senderMinaBindedAddress,
      fulfillmentNotarySigned
    );
    if (!notaryVerified) revert('Notary signature is invalid.');

    Order storage currentOrder = order[orderId];
    if (currentOrder.tokenType == TokenType.Native)
      payable(sender).transfer(currentOrder.depositedAmount);
    else {
      I_WRAPPED_NATIVE.safeTransfer(sender, currentOrder.depositedAmount);
    }

    currentOrder.fulfilled = true;
    currentOrder.counterParty = sender;
  }

  function processSignedMinaOrder(
    uint256 orderId,
    uint256 minaAmountTransferred,
    string memory counterPartyMinaAddress,
    bytes memory signature
  ) public view returns (bool) {
    // Pack the message the same way it was signed
    bytes32 messageHash = keccak256(
      abi.encodePacked(orderId, minaAmountTransferred, counterPartyMinaAddress)
    );
    bytes32 ethSignedMessageHash = keccak256(
      abi.encodePacked('\x19Ethereum Signed Message:\n32', messageHash)
    );
    address recoveredSigner = recoverSigner(ethSignedMessageHash, signature);
    return recoveredSigner == Doot;
  }

  function recoverSigner(
    bytes32 ethSignedMessageHash,
    bytes memory signature
  ) internal pure returns (address) {
    require(signature.length == 65, 'Invalid signature length');
    bytes32 r;
    bytes32 s;
    uint8 v;
    assembly {
      r := mload(add(signature, 32))
      s := mload(add(signature, 64))
      v := byte(0, mload(add(signature, 96)))
    }
    if (v < 27) {
      v += 27;
    }
    require(v == 27 || v == 28, "Invalid signature 'v' value");
    return ecrecover(ethSignedMessageHash, v, r, s);
  }

  fallback() external payable {
    revert();
  }

  receive() external payable {
    revert();
  }
}
