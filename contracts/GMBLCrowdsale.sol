pragma solidity ^0.4.18;


import "./TokenSale.sol";
import "./libs/SafeMath.sol";

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

contract GMBLCrowdsale is TokenSale {
    using SafeMath for uint;

    // keep track of the important totals
    uint public totalEther = 0;
    uint public totalContributors = 0;

    // Declare the discount tiers
    uint constant public FIRST_TIER_DISCOUNT = 5;
    uint constant public SECOND_TIER_DISCOUNT = 10;
    uint constant public THIRD_TIER_DISCOUNT = 20;
    uint constant public FOURTH_TIER_DISCOUNT = 30;

    // These values are set at contract creation
    uint public minContributionEther;
    uint public maxContributionEther;
    uint public minDiscountEther;
    uint public firstTierDiscountUpperLimitEther;
    uint public secondTierDiscountUpperLimitEther;
    uint public thirdTierDiscountUpperLimitEther;

    modifier isValidContribution() {
        require(validContribution());
        _;
    }

    modifier isValidated() {
        require(msg.sender != 0x0);
        require(msg.value > 0);
        require(!isContract(msg.sender)); 
        //require(tx.gasprice <= MAX_GAS_PRICE);
        _;
    }

    event LogContribRecieved(address fromWho, uint amount);
    event LogContractCreated(uint min, uint max);


    /// @notice called only once when the contract is initialized
    /// @param vaultAddress the address that will hold the crowd funded Ether
    /// @param _minDiscountEther Lower discount limit (WEI)
    /// @param _firstTierDiscountUpperLimitEther First discount limits (WEI)
    /// @param _secondTierDiscountUpperLimitEther Second discount limits (WEI)
    /// @param _thirdTierDiscountUpperLimitEther Third discount limits (WEI)
    /// @param _minContributionEther Lower contribution range (WEI)
    /// @param _maxContributionEther Upper contribution range (WEI)
    /// @param exchangeRate The initial GMBL exchange rate
    function GMBLCrowdsale(
        address vaultAddress,
        uint _minDiscountEther,
        uint _firstTierDiscountUpperLimitEther,
        uint _secondTierDiscountUpperLimitEther,
        uint _thirdTierDiscountUpperLimitEther,
        uint _minContributionEther,
        uint _maxContributionEther,
        uint exchangeRate)
        TokenSale (
            vaultAddress,
            exchangeRate
        )
    {
        pegEtherValues(
            _minDiscountEther,
            _firstTierDiscountUpperLimitEther,
            _secondTierDiscountUpperLimitEther,
            _thirdTierDiscountUpperLimitEther,
            _minContributionEther,
            _maxContributionEther
        );
        LogContractCreated(_minContributionEther, _maxContributionEther);
    }




    /// @notice Allows the owner to peg Ether values
    /// @param _minDiscountEther Lower discount limit (WEI)
    /// @param _firstTierDiscountUpperLimitEther First discount limits (WEI)
    /// @param _secondTierDiscountUpperLimitEther Second discount limits (WEI)
    /// @param _thirdTierDiscountUpperLimitEther Third discount limits (WEI)
    /// @param _minContributionEther Lower contribution range (WEI)
    /// @param _maxContributionEther Upper contribution range (WEI)
    function pegEtherValues(
        uint256 _minDiscountEther,
        uint256 _firstTierDiscountUpperLimitEther,
        uint256 _secondTierDiscountUpperLimitEther,
        uint256 _thirdTierDiscountUpperLimitEther,
        uint256 _minContributionEther,
        uint256 _maxContributionEther
    ) 
        onlyOwner
    {
        minDiscountEther = _minDiscountEther;
        firstTierDiscountUpperLimitEther = _firstTierDiscountUpperLimitEther;
        secondTierDiscountUpperLimitEther = _secondTierDiscountUpperLimitEther;
        thirdTierDiscountUpperLimitEther = _thirdTierDiscountUpperLimitEther;
        minContributionEther = _minContributionEther;
        maxContributionEther = _maxContributionEther;
    }

    /// @notice Ensure the contribution is valid
    /// @return Returns whether the contribution is valid or not
    function validContribution() private returns (bool) {
        bool isContributionValid = msg.value >= minContributionEther && msg.value <= maxContributionEther;
        return isContributionValid;
    }

    /// @notice Applies the discount based on the discount tiers
    /// @param _etherAmount The amount of ether used to evaluate the tier the contribution lies within
    /// @param _contributorTokens The tokens allocated based on the contribution
    function applyDiscount(
        uint256 _etherAmount, 
        uint256 _contributorTokens
    )
        internal
        constant
        returns (uint256)
    {

        uint256 discount = 0;

        if (_etherAmount >= minDiscountEther && _etherAmount < firstTierDiscountUpperLimitEther) {
            discount = _contributorTokens.mul(FIRST_TIER_DISCOUNT).div(100); // 5%
        } else if (_etherAmount >= firstTierDiscountUpperLimitEther && _etherAmount < secondTierDiscountUpperLimitEther) {
            discount = _contributorTokens.mul(SECOND_TIER_DISCOUNT).div(100); // 10%
        } else if (_etherAmount >= secondTierDiscountUpperLimitEther && _etherAmount < thirdTierDiscountUpperLimitEther) {
            discount = _contributorTokens.mul(THIRD_TIER_DISCOUNT).div(100); // 20%
        } else if (_etherAmount >= thirdTierDiscountUpperLimitEther) {
            discount = _contributorTokens.mul(FOURTH_TIER_DISCOUNT).div(100); // 30%
        }

        return discount.add(_contributorTokens);
    }

    /// @notice Updates the counters for the amount of Ether paid
    /// @param _etherAmount the amount of Ether paid
    function updateCounters(uint _etherAmount) internal {
        totalEther = totalEther.add(_etherAmount);
        totalContributors = totalContributors.add(1);
    }

    /// @notice This function fires when someone sends Ether to the address of this contract.
    /// The ETH will be exchanged for SHP and it ensures contributions cannot be made from known addresses.
    function ()
        public
        payable
        isValidated
        isNotFinished
        isRunning
        isValidContribution
    {
        require(msg.value > 0);
        LogContribRecieved(msg.sender, msg.value);
        executeBuy(msg.sender, msg.value);
    }


}