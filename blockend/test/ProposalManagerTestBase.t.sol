// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;


// import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Test, console2} from "forge-std/Test.sol";
import {ProposalManager} from "../src/ProposalManager.sol";
import {MarketToken} from "../src/MarketToken.sol";
import {MockToken} from "./mocks/TestERC20.sol";

contract ProposalManagerTestBase is Test{

    address admin;
    address deployer;
    address user1;
    address user2;

    ProposalManager proposalManager;
    MockToken collateralToken;



    function setUp() public virtual {
        admin = makeAddr("admin");
        deployer = makeAddr("deployer");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        startHoax(deployer);
        proposalManager = new ProposalManager();
        collateralToken = new MockToken();

        collateralToken.transfer(admin, 1000 ether);
        collateralToken.transfer(user1, 1000 ether);
        collateralToken.transfer(user2, 1000 ether);
        vm.stopPrank();

    }
    

}

