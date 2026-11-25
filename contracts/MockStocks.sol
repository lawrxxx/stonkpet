// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 * Testnet stand-ins for Coinbase tokenized stocks on Base, which only exist on mainnet.
 *
 * MockStockToken mirrors the parts of a B20 stock token the app uses: 8 decimals,
 * a WAD multiplier and balanceOfUI(). MockStockExchange buys and sells them against
 * USDC at prices pushed by an updater that copies the real mainnet prices (Chainlink
 * NAV feeds, or DEX pools for stocks without a feed). Like a Chainlink NAV feed, a
 * price is per token, already including the multiplier, so the exchange never
 * applies the multiplier again.
 *
 * Safety rule carried over from the app: never settle on a stale price. A trade
 * reverts if the token's price is older than maxPriceAge.
 *
 * Mainnet swaps don't go through this contract: they use the real tokens and a DEX
 * route. Only addresses and the swap call change; the app's rules are the same.
 */

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract MockStockToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 8;
    uint256 public totalSupply;
    /// WAD (1e18 = 1 share per token), as on B20 tokens.
    uint256 public immutable multiplier;
    address public immutable exchange;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error OnlyExchange();
    error Insufficient();

    constructor(string memory name_, string memory symbol_, uint256 multiplier_) {
        name = name_;
        symbol = symbol_;
        multiplier = multiplier_;
        exchange = msg.sender;
    }

    /// Shares represented by an account's tokens (ERC-8056 style).
    function balanceOfUI(address account) external view returns (uint256) {
        return (balanceOf[account] * multiplier) / 1e18;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _move(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            if (a < value) revert Insufficient();
            allowance[from][msg.sender] = a - value;
        }
        _move(from, to, value);
        return true;
    }

    function mint(address to, uint256 value) external {
        if (msg.sender != exchange) revert OnlyExchange();
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function burn(address from, uint256 value) external {
        if (msg.sender != exchange) revert OnlyExchange();
        if (balanceOf[from] < value) revert Insufficient();
        balanceOf[from] -= value;
        totalSupply -= value;
        emit Transfer(from, address(0), value);
    }

    function _move(address from, address to, uint256 value) internal {
        if (balanceOf[from] < value) revert Insufficient();
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}

contract MockStockExchange {
    IERC20 public immutable usdc; // 6 decimals
    address public owner;
    address public updater;
    uint256 public maxPriceAge = 1 hours;

    struct Quote {
        uint128 price; // USD per token, 8 decimals (like Chainlink)
        uint64 updatedAt;
    }

    mapping(address => Quote) public quotes;
    mapping(address => bool) public listed;
    mapping(bytes32 => address) internal _byTicker;
    address[] public tokens;

    event Listed(string ticker, address token);
    event PriceSet(address indexed token, uint256 price, uint256 updatedAt);
    event Bought(address indexed buyer, address indexed token, uint256 usdcIn, uint256 tokensOut);
    event Sold(address indexed seller, address indexed token, uint256 tokensIn, uint256 usdcOut);

    error NotOwner();
    error NotUpdater();
    error NotListed();
    error AlreadyListed();
    error StalePrice(address token);
    error Slippage();
    error BadInput();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address usdc_, address updater_) {
        usdc = IERC20(usdc_);
        owner = msg.sender;
        updater = updater_;
    }

    // ---------- admin ----------

    function list(string calldata ticker, string calldata name_, uint256 multiplier) external onlyOwner returns (address token) {
        bytes32 k = keccak256(bytes(ticker));
        if (_byTicker[k] != address(0)) revert AlreadyListed();
        token = address(new MockStockToken(name_, string.concat(ticker, "c"), multiplier));
        _byTicker[k] = token;
        listed[token] = true;
        tokens.push(token);
        emit Listed(ticker, token);
    }

    function setUpdater(address u) external onlyOwner { updater = u; }
    function setMaxPriceAge(uint256 s) external onlyOwner { maxPriceAge = s; }
    function transferOwnership(address o) external onlyOwner { owner = o; }

    function setPrices(address[] calldata toks, uint256[] calldata prices) external {
        if (msg.sender != updater && msg.sender != owner) revert NotUpdater();
        if (toks.length != prices.length) revert BadInput();
        for (uint256 i; i < toks.length; i++) {
            if (!listed[toks[i]] || prices[i] == 0) revert BadInput();
            quotes[toks[i]] = Quote(uint128(prices[i]), uint64(block.timestamp));
            emit PriceSet(toks[i], prices[i], block.timestamp);
        }
    }

    // ---------- views ----------

    function tokenOf(string calldata ticker) external view returns (address) { return _byTicker[keccak256(bytes(ticker))]; }
    function tokenCount() external view returns (uint256) { return tokens.length; }

    function freshPrice(address token) public view returns (uint256) {
        if (!listed[token]) revert NotListed();
        Quote memory q = quotes[token];
        if (q.price == 0 || block.timestamp - q.updatedAt > maxPriceAge) revert StalePrice(token);
        return q.price;
    }

    /// tokens(8dp) = usdc(6dp) * 1e2 * 1e8 / price(8dp)
    function quoteBuy(address token, uint256 usdcIn) public view returns (uint256) {
        return (usdcIn * 1e10) / freshPrice(token);
    }

    function quoteSell(address token, uint256 tokensIn) public view returns (uint256) {
        return (tokensIn * freshPrice(token)) / 1e10;
    }

    // ---------- trading ----------

    function buy(address token, uint256 usdcIn, uint256 minOut) public returns (uint256 out) {
        if (usdcIn == 0) revert BadInput();
        out = quoteBuy(token, usdcIn);
        if (out < minOut || out == 0) revert Slippage();
        if (!usdc.transferFrom(msg.sender, address(this), usdcIn)) revert TransferFailed();
        MockStockToken(token).mint(msg.sender, out);
        emit Bought(msg.sender, token, usdcIn, out);
    }

    /// Buy several stocks in one call: a whole feed split across the plan.
    function buyMany(address[] calldata toks, uint256[] calldata usdcIns, uint256[] calldata minOuts) external {
        if (toks.length != usdcIns.length || toks.length != minOuts.length || toks.length == 0) revert BadInput();
        for (uint256 i; i < toks.length; i++) buy(toks[i], usdcIns[i], minOuts[i]);
    }

    function sell(address token, uint256 tokensIn, uint256 minUsdcOut) external returns (uint256 out) {
        if (tokensIn == 0) revert BadInput();
        out = quoteSell(token, tokensIn);
        if (out < minUsdcOut || out == 0) revert Slippage();
        MockStockToken(token).burn(msg.sender, tokensIn);
        if (!usdc.transfer(msg.sender, out)) revert TransferFailed();
        emit Sold(msg.sender, token, tokensIn, out);
    }
}

/// Faucet-style USDC for the contract's own integration test (not used by the app).
contract TestUSDC {
    string public constant name = "Test USDC";
    string public constant symbol = "tUSDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 v) external { totalSupply += v; balanceOf[to] += v; }
    function approve(address s, uint256 v) external returns (bool) { allowance[msg.sender][s] = v; return true; }
    function transfer(address to, uint256 v) external returns (bool) { require(balanceOf[msg.sender] >= v); balanceOf[msg.sender] -= v; balanceOf[to] += v; return true; }
    function transferFrom(address f, address t, uint256 v) external returns (bool) {
        require(balanceOf[f] >= v && allowance[f][msg.sender] >= v);
        allowance[f][msg.sender] -= v; balanceOf[f] -= v; balanceOf[t] += v; return true;
    }
}
