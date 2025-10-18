// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockObjectiveContract {
    
    // State variables that can be modified
    uint256 public constant1 = 100;
    uint256 public constant2 = 500;
    uint256 public dynamicValue = 42;
    string public message = "Initial message";
    bool public isActive = false;
    address public admin;
    mapping(address => uint256) public balances;
    
    // Events to track state changes
    event ValueChanged(uint256 oldValue, uint256 newValue);
    event MessageChanged(string oldMessage, string newMessage);
    event StatusChanged(bool oldStatus, bool newStatus);
    event AdminChanged(address oldAdmin, address newAdmin);
    event BalanceUpdated(address indexed user, uint256 oldBalance, uint256 newBalance);
    
    constructor() {
        admin = msg.sender;
    }
    
    function changeDynamicValue(uint256 newValue) external {
        uint256 oldValue = dynamicValue;
        dynamicValue = newValue;
        emit ValueChanged(oldValue, newValue);
    }
    
    function updateMessage(string memory newMessage) external {
        string memory oldMessage = message;
        message = newMessage;
        emit MessageChanged(oldMessage, newMessage);
    }
    
    function changeAdmin(address newAdmin) external {
        address oldAdmin = admin;
        admin = newAdmin;
        emit AdminChanged(oldAdmin, newAdmin);
    }
    
    function updateBalance(address user, uint256 amount) external {
        uint256 oldBalance = balances[user];
        balances[user] = amount;
        emit BalanceUpdated(user, oldBalance, amount);
    }
    
    function incrementValue(uint256 increment) external {
        uint256 oldValue = dynamicValue;
        dynamicValue += increment;
        emit ValueChanged(oldValue, dynamicValue);
    }
    

    
    function adminOnlyFunction(uint256 secretValue) external {
        require(msg.sender == admin, "Only admin can call this function");
        dynamicValue = secretValue;
        emit ValueChanged(dynamicValue, secretValue);
    }

    function getCurrentState() external view returns (
        uint256 _dynamicValue,
        string memory _message,
        bool _isActive,
        address _admin
    ) {
        return (dynamicValue, message, isActive, admin);
    }
    
    function executeGovernanceAction(
        uint256 parameter1,
        uint256 parameter2,
        string memory description
    ) external {
  
        dynamicValue = parameter1 + parameter2;
        message = description;
        isActive = true;
        
        emit ValueChanged(0, dynamicValue);
        emit MessageChanged("", description);
        emit StatusChanged(false, true);
    }
}
