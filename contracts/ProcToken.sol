// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProcToken — ERC-20 governance token for the procurement ecosystem
/// @notice Used for DAO voting weight, whistleblower rewards, and citizen participation incentives
contract ProcToken {

    string public constant name = "Procurement Token";
    string public constant symbol = "PROC";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // Cap: 1,000,000 tokens
    uint256 public constant MAX_SUPPLY = 1_000_000 * 1e18;

    // Faucet: max 1000 tokens per claim, once per 24h
    uint256 public constant FAUCET_AMOUNT = 1000 * 1e18;
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    mapping(address => uint256) public lastFaucetClaim;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event FaucetClaim(address indexed claimer, uint256 amount);
    event RewardPaid(address indexed recipient, uint256 amount, string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        // Mint initial supply to deployer (100,000 tokens for rewards pool)
        uint256 initial = 100_000 * 1e18;
        balanceOf[msg.sender] = initial;
        totalSupply = initial;
        emit Transfer(address(0), msg.sender, initial);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Insufficient allowance");
        balanceOf[from] -= value;
        allowance[from][msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }

    /// @notice Free testnet token faucet — anyone can claim once per 24h
    function claimFromFaucet() external {
        require(block.timestamp >= lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN, "Cooldown active");
        require(totalSupply + FAUCET_AMOUNT <= MAX_SUPPLY, "Max supply reached");

        lastFaucetClaim[msg.sender] = block.timestamp;
        balanceOf[msg.sender] += FAUCET_AMOUNT;
        totalSupply += FAUCET_AMOUNT;

        emit Transfer(address(0), msg.sender, FAUCET_AMOUNT);
        emit FaucetClaim(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Owner pays reward to a recipient (e.g., whistleblower, citizen verifier)
    function payReward(address recipient, uint256 amount, string calldata reason) external onlyOwner {
        require(balanceOf[owner] >= amount, "Insufficient reward pool");
        balanceOf[owner] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(owner, recipient, amount);
        emit RewardPaid(recipient, amount, reason);
    }
}
