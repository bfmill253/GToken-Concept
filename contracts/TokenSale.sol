pragma solidity ^0.4.18;

import "./libs/Owned.sol";
import "./libs/SafeMath.sol";
import "./libs/TokenController.sol";

import "./GToken.sol";

/*    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
/*
    Brandon Miller (bfmill253)

*/

contract TokenSale is Owned {
    //Use safemath to avoid overflow
    using SafeMath for uint;

    // The MiniMe Token contract
    GMBL public gambleToken;

    //vault to store the ether contributed
    address public etherVault;

    // Allow a running state in order to pause the sale 
    bool public running;
    // Determine if the sale is closed for good
    bool public finished;
    // Block or allow tranfers between the end of the sale and launch of the Dapp
    bool public allowTransfer;

    // Store a count for founder tokens
    uint public founderTokenCount = 0;
    // variable exchange rate
    uint exchangeRate = 0;

    // How much to pledge to founders
    // set to 20% 
    uint constant public FOUNDER_EXCHANGE_SHARE = 20;
    // How much to pledge to the caller
    // set to 80% (the rest of the funding)
    uint constant public CALLER_EXCHANGE_SHARE = 80;

    uint256 constant public MAX_GAS_PRICE = 50000000000;

    event LogSaleStart(uint when);
    event LogSaleClosed(uint when);
    event LogTokenPurchase(address who, uint amount);



    modifier isRunning(){
        require(running);
        _;
    }

    modifier isNotFinished(){
        require(!finished);
        _;
    }

    // Set the new exchange rate
    function setExchangeRate(uint newRate) public onlyOwner {
        exchangeRate = newRate;
    }

    // Toggle transfers
    function setAllowTransfer(bool shouldAllowTransfer) public onlyOwner {
        allowTransfer = shouldAllowTransfer;
    }

    /// @notice Allows the owner to manually mint some GMBL to an address if something goes wrong
    /// @param amountTokens the number of tokens to mint
    /// @param sendTo the address to send the tokens to
    function mintTokens(
        uint amountTokens, 
        address sendTo
    ) public onlyOwner 
    {
        gambleToken.generateTokens(sendTo, amountTokens);
    }


    // Execute the token buy, also allocating any reserves specified
    // @param fromAddress -- Address Ether is coming from
    // @param amountEther -- amount of ether being contributed
    function executeBuy(address fromAddress, uint amountEther) internal {
        uint callerRate = exchangeRate.mul(CALLER_EXCHANGE_SHARE).div(100);
        uint founderRate = exchangeRate.mul(FOUNDER_EXCHANGE_SHARE).div(100);

        uint callerTokenAmount = amountEther.mul(callerRate);
        uint finalCallerAmount = applyDiscount(amountEther, callerTokenAmount);

        uint founderTokenAmount = amountEther.mul(founderRate);
        founderTokenCount = founderTokenCount.add(founderTokenAmount);

        gambleToken.generateTokens(fromAddress, finalCallerAmount);

        etherVault.transfer(amountEther);
        LogTokenPurchase(fromAddress, finalCallerAmount);
        updateCounters(amountEther);
    }


    /// @notice Pauses the contribution if there is any issue
    function pauseContribution() public onlyOwner {
        running = false;
    }

    /// @notice Resumes the contribution
    function resumeContribution() public onlyOwner {
        running = true;
    }

    function setGMBL(address gTokenAddress) public onlyOwner {
        gambleToken = GMBL(gTokenAddress);
    }


    /// @notice Applies the discount based on the discount tiers
    /// @param etherAmount The amount of ether used to evaluate the tier the contribution lies within
    /// @param contributorTokens The tokens allocated based on the contribution
    function applyDiscount(uint etherAmount, uint contributorTokens) internal constant returns (uint256);

    /// @notice Updates the counters for the amount of Ether paid
    /// @param etherAmount the amount of Ether paid
    function updateCounters(uint etherAmount) internal;

    /// @notice Parent constructor. This needs to be extended from the child contracts
    /// @param vaultAddress the address that will hold the crowd funded Ether
    /// @param initialExchangeRate the initial GMBL exchange rate
    function TokenSale (
        address vaultAddress,
        uint initialExchangeRate
    ) {
        etherVault = vaultAddress;
        exchangeRate = initialExchangeRate;
        running = false;
        finished = false;
        allowTransfer = false;
    }

    /// @notice Internal function to determine if an address is a contract
    /// @param _caller The address being queried
    /// @return True if `caller` is a contract
    function isContract(address _caller) internal constant returns (bool) {
        uint size;
        assembly { size := extcodesize(_caller) }
        return size > 0;
    }

    /**
    
    MiniMe Controller Interface.

    We can use this to set a no transfer window between ICO and platform launch
    
    */

    function proxyPayment(address) public payable returns (bool) {
        return allowTransfer;
    }

    function onTransfer(address, address, uint256) public returns (bool) {
        return allowTransfer;
    }

    function onApprove(address, address, uint256) public returns (bool) {
        return allowTransfer;
    }

    


}