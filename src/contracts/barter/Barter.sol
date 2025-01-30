// SPDX-License-Identifier:MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

enum TokenType {
  Native,
  WrappedNative
}

enum OrderType {
  Auto, // Based on the current ex rate.
  Precise // Simpy asking for x amount of MINA tokens against the ETH deposited.
}

struct ExternalMinaOrder {
  string creator;
  uint256 orderId;
  TokenType tokenType;
  OrderType orderType;
  uint256 ethereumAsk;
  uint256 depositedMina;
  address counterParty;
  bool fulfilled;
  bytes emoSigned;
}

struct Order {
  address creator;
  uint256 orderId;
  TokenType tokenType;
  OrderType orderType;
  uint256 minaAsk;
  uint256 depositedEthereum;
  address counterParty;
  bool fulfilled;
}

contract DootBarter {
  using SafeERC20 for IERC20;

  IERC20 public immutable I_WRAPPED_NATIVE;
  uint256 public immutable I_WRAPPED_DECIMALS;
  uint256 public constant C_MINA_DECIMALS = 9;

  address public DOOT;
  uint256 public orderCounter;
  mapping(address => string) public EthToMinaAddressBinding;
  mapping(string => address) public MinaToEthAddressBinding;
  mapping(address => Order[]) public userToOrders;
  mapping(uint256 => Order) public orders;
  mapping(bytes => bool) public fulfillmentUsed;
  Order[] public allOrders;

  event OrderStats(uint256 orderId, bool fulfilled);

  constructor(address wrapped, uint256 decimals) {
    I_WRAPPED_NATIVE = IERC20(wrapped);
    I_WRAPPED_DECIMALS = decimals;
  }

  modifier onlyDoot() {
    if (msg.sender != DOOT) revert('');
    _;
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

  function setEthMinaPair(
    address ethAddress,
    string memory minaAddress
  ) external onlyDoot {
    EthToMinaAddressBinding[ethAddress] = minaAddress;
    MinaToEthAddressBinding[minaAddress] = ethAddress;
  }

  /// An ETH sell order. To be fulfilled by sending MINA.
  function open(
    TokenType tokenType,
    OrderType orderType,
    uint256 amount,
    uint256 ask // Scaled to 1e9 cause of MINA having minimum value as NanoMina. 0 when order is set to Auto.
  ) external payable {
    address sender = msg.sender;
    uint256 orderId = orderCounter;
    ++orderCounter;

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
      creator: sender,
      orderId: orderId,
      tokenType: tokenType,
      orderType: orderType,
      depositedEthereum: amount,
      minaAsk: ask,
      fulfilled: false,
      counterParty: address(0)
    });

    orders[orderId] = newOrder;
    userToOrders[sender].push(newOrder);
    allOrders.push(newOrder);
  }

  /// A MINA Sell Order.
  /// If some one is fulfilling an order of type : MINA->ETH.
  function fulfill(
    uint256 nativePrice,
    uint256 nativeTimestamp,
    string memory native,
    bytes memory nativeSignature,
    uint256 minaPrice,
    uint256 minaTimestamp,
    string memory mina,
    bytes memory minaSignature,
    ExternalMinaOrder memory minaOrder
  ) external payable {
    bool validMinaOrder = processSignedExternalMinaOrder(minaOrder);
    if (!validMinaOrder) {
      revert('Mina Order not notarized!');
    }

    if (minaOrder.orderType == OrderType.Auto) {
      require(
        block.timestamp - nativeTimestamp < 120 &&
          block.timestamp - minaTimestamp < 120,
        'Outdated pricing information.'
      );

      bool validEthValue = processPriceSignedData(
        nativePrice,
        nativeTimestamp,
        native,
        nativeSignature
      );
      if (!validEthValue) revert('Invalid native signed information.');

      bool validMinaValue = processPriceSignedData(
        minaPrice,
        minaTimestamp,
        mina,
        minaSignature
      );
      if (!validMinaValue) revert('Invalid mina signed information.');

      uint256 minaPerEth = (nativePrice * 1e18) / minaPrice;
      uint256 requiredEthAmount = (minaOrder.depositedMina * 1e18) / minaPerEth;

      // Check if the fulfiller used ETH or WETH.
      if (msg.value < requiredEthAmount) {
        require(
          I_WRAPPED_NATIVE.allowance(msg.sender, address(this)) >=
            requiredEthAmount,
          'Insufficient WETH allowance.'
        );
        require(
          I_WRAPPED_NATIVE.balanceOf(msg.sender) >= requiredEthAmount,
          'Insufficient WETH balance.'
        );

        I_WRAPPED_NATIVE.transferFrom(
          msg.sender,
          address(this),
          requiredEthAmount
        );
        I_WRAPPED_NATIVE.transfer(
          MinaToEthAddressBinding[minaOrder.creator],
          requiredEthAmount
        );
      } else {
        (bool success, ) = payable(MinaToEthAddressBinding[minaOrder.creator])
          .call{value: requiredEthAmount}('');
        require(success, 'Failed to send ETH');

        uint256 surplus = msg.value - requiredEthAmount;
        if (surplus > 0) {
          (bool refundSuccess, ) = payable(msg.sender).call{value: surplus}('');
          require(refundSuccess, 'Failed to refund surplus');
        }
      }
    } else {
      if (msg.value < minaOrder.ethereumAsk) {
        require(
          I_WRAPPED_NATIVE.allowance(msg.sender, address(this)) >=
            minaOrder.ethereumAsk,
          'Insufficient WETH allowance.'
        );
        require(
          I_WRAPPED_NATIVE.balanceOf(msg.sender) >= minaOrder.ethereumAsk,
          'Insufficient WETH balance.'
        );

        I_WRAPPED_NATIVE.transferFrom(
          msg.sender,
          address(this),
          minaOrder.ethereumAsk
        );

        I_WRAPPED_NATIVE.transfer(
          MinaToEthAddressBinding[minaOrder.creator],
          minaOrder.ethereumAsk
        );
      } else {
        (bool success, ) = payable(MinaToEthAddressBinding[minaOrder.creator])
          .call{value: minaOrder.ethereumAsk}('');
        require(success, 'Failed to send ETH');

        uint256 surplus = msg.value - minaOrder.ethereumAsk;
        if (surplus > 0) {
          (bool refundSuccess, ) = payable(msg.sender).call{value: surplus}('');
          require(refundSuccess, 'Failed to refund surplus');
        }
      }
    }
  }

  /// ETH Sell Order.
  /// If someone has fulfilled an order of type : ETH->MINA. (By sending the order creator MINA.)
  /// Claimable by the person that completed the order.
  function fulfillClaim(
    uint256 orderId,
    uint256 atPrice, // Order of 1e10
    uint256 minaAmountTransferred,
    bytes memory fulfillmentNotarySigned
  ) external {
    address sender = msg.sender;

    if (fulfillmentUsed[fulfillmentNotarySigned]) revert('Already fulfilled.');

    string memory senderMinaBindedAddress = EthToMinaAddressBinding[sender];

    bool notaryVerified = processSignedMinaOrder(
      orderId,
      atPrice,
      minaAmountTransferred,
      senderMinaBindedAddress,
      fulfillmentNotarySigned
    );
    if (!notaryVerified) revert('Notary signature is invalid.');

    Order storage currentOrder = orders[orderId];
    if (currentOrder.tokenType == TokenType.Native)
      payable(sender).transfer(currentOrder.depositedEthereum);
    else {
      I_WRAPPED_NATIVE.safeTransfer(sender, currentOrder.depositedEthereum);
    }

    currentOrder.fulfilled = true;
    currentOrder.counterParty = sender;
  }

  function processSignedExternalMinaOrder(
    ExternalMinaOrder memory minaOrder
  ) public view returns (bool) {
    bytes32 messageHash = keccak256(
      abi.encodePacked(
        minaOrder.orderId,
        minaOrder.orderType,
        minaOrder.ethereumAsk,
        minaOrder.depositedMina
      )
    );

    bytes32 ethSignedMessageHash = keccak256(
      abi.encodePacked('\x19Ethereum Signed Message:\n32', messageHash)
    );
    address recoveredSigner = recoverSigner(
      ethSignedMessageHash,
      minaOrder.emoSigned
    );
    return recoveredSigner == DOOT;
  }

  function processSignedMinaOrder(
    uint256 orderId,
    uint256 atPrice,
    uint256 minaAmountTransferred,
    string memory counterPartyMinaAddress,
    bytes memory signature
  ) public view returns (bool) {
    // Pack the message the same way it was signed.
    bytes32 messageHash = keccak256(
      abi.encodePacked(
        orderId,
        atPrice,
        minaAmountTransferred,
        counterPartyMinaAddress
      )
    );
    bytes32 ethSignedMessageHash = keccak256(
      abi.encodePacked('\x19Ethereum Signed Message:\n32', messageHash)
    );
    address recoveredSigner = recoverSigner(ethSignedMessageHash, signature);
    return recoveredSigner == DOOT;
  }

  function processPriceSignedData(
    uint256 price,
    uint256 timestamp,
    string memory token,
    bytes memory signature
  ) public view returns (bool) {
    bytes32 messageHash = keccak256(abi.encodePacked(price, timestamp, token));
    bytes32 ethSignedMessageHash = keccak256(
      abi.encodePacked('\x19Ethereum Signed Message:\n32', messageHash)
    );
    address recoveredSigner = recoverSigner(ethSignedMessageHash, signature);
    return recoveredSigner == DOOT;
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

  receive() external payable {}
}
