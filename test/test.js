var GMBL = artifacts.require("GMBL");
var crowdSale = artifacts.require("GMBLCrowdsale");
var tokenFactory = artifacts.require("MiniMeTokenFactory");


contract('Crowdsale tests', function(accounts) {


    //Run the set up before we run our tests
    before(async function(){

        console.log('running before');
        this.owner = accounts[0]
        this.contributor_1 = accounts[1];
        this.contributor_2 = accounts[2];
        this.contributor_3 = accounts[5];
        this.contributor_4 = accounts[6];
        this.contributor_5 = accounts[7];
        this.founder = accounts[3];
        this.vault = accounts[4];

        this.tFactory = await tokenFactory.new();

        this.gambleT = await GMBL.new(this.tFactory.address);

        this.minDiscount = web3.toBigNumber(web3.toWei(10));
        this.firstTierDiscountUpperLimit = web3.toBigNumber(web3.toWei(20));
        this.secondTierDiscountUpperLimit = web3.toBigNumber(web3.toWei(30));
        this.thirdTierDiscountUpperLimit = web3.toBigNumber(web3.toWei(40));
        this.minContribution = web3.toBigNumber(web3.toWei(5));
        this.maxContribution = web3.toBigNumber(web3.toWei(45));
        this.exchangeRate = 1000;

        console.log("ownerAddress: " + this.owner);
        console.log("contributorOneAddress: " + this.contributor_1);
        console.log("contributorTwoAddress: " + this.contributor_2);
        
        this.sale = await crowdSale.new(
            this.vault,
            this.minDiscount,
            this.firstTierDiscountUpperLimit,
            this.secondTierDiscountUpperLimit,
            this.thirdTierDiscountUpperLimit,
            this.minContribution,
            this.maxContribution,
            this.exchangeRate
        )

        await this.gambleT.changeController(this.sale.address);
        await this.sale.setGMBL(this.gambleT.address);

    })

    // Lets make sure we deploy and can accept a contribution
    it('we can toggle the status of the sale', async function () {
        //Token sale should be paused at launch
        let isRunning = await this.sale.running();
        assert.equal(isRunning, false, "sale initiated in the wrong state");

        //The owner should be able to start the sale
        await this.sale.resumeContribution({
            from: this.owner
        });
        isRunning = await this.sale.running();
        assert.equal(isRunning, true, "unable to start the sale");
        //we will leave the sale running for the rest of the tests
    })

    it('contributions under the minimum should fail', async function (){
        // lets contribute under the minimum with contributor_1
        
        let initialContributorBalanace = (await web3.eth.getBalance(this.contributor_1)).toNumber();
        let initialSaleTotal = (await this.sale.totalEther()).toNumber();
        let initialContributorAmount = (await this.sale.totalContributors()).toNumber();
        // contribution is min - 3 eth
        let contribAmount = this.minContribution.minus(web3.toWei(3));
        try{
            await this.sale.sendTransaction({
                value: contribAmount,
                from: this.contributor_1
            });
            assert.equal(true, false, "Error not thrown when submitting min - 3 eth");
        }catch (e){
            // The transaction should not go through
            let finalContributorBalanace = (await web3.eth.getBalance(this.contributor_1)).toNumber();
            let finalSaleTotal = (await this.sale.totalEther()).toNumber();
            let finalContributorAmount = (await this.sale.totalContributors()).toNumber();

            assert.equal(initialSaleTotal, finalSaleTotal, "Sale total went up, it should have failed");
            assert.equal(initialContributorAmount, finalContributorAmount, "Contributor count went up, should have failed");
            assert.isBelow(initialContributorBalanace - contribAmount, finalContributorBalanace, "Contributor lost ether (more then just gas)");
        }
    })

    it('contributions over the max should fail', async function (){
        // lets contribute over the maximum with contributor_1

        let initialContributorBalanace = (await web3.eth.getBalance(this.contributor_1)).toNumber();
        let initialSaleTotal = (await this.sale.totalEther()).toNumber();
        let initialContributorAmount = (await this.sale.totalContributors()).toNumber();
        // contribution is max + 3 eth
        let contribAmount = this.maxContribution.plus(web3.toWei(3));
        try{
            await this.sale.sendTransaction({
                value: contribAmount,
                from: this.contributor_1
            });
            assert.equal(true, false, "Error not thrown when submitting max + 3 eth");
        }catch (e){
            // The transaction should not go through
            let finalContributorBalanace = (await web3.eth.getBalance(this.contributor_1)).toNumber();
            let finalSaleTotal = (await this.sale.totalEther()).toNumber();
            let finalContributorAmount = (await this.sale.totalContributors()).toNumber();

            assert.equal(initialSaleTotal, finalSaleTotal, "Sale total went up, it should have failed");
            assert.equal(initialContributorAmount, finalContributorAmount, "Contributor count went up, should have failed");
            assert.isBelow(initialContributorBalanace - contribAmount, finalContributorBalanace, "Contributor lost ether (more then just gas)");
        }
    })

    it('contributions at the minimum should pass without discount', async function(){
        // lets contribute with contributor_1

        let initialContributorBalanace = (await web3.eth.getBalance(this.contributor_1)).toNumber();
        let initialVaultBalanace = (await web3.eth.getBalance(this.vault)).toNumber();
        let initialSaleTotal = (await this.sale.totalEther()).toNumber();
        let initialContributorAmount = (await this.sale.totalContributors()).toNumber();
        // contribution is min
        let contribAmount = this.minContribution.plus(web3.toWei(1));
        //console.log(web3.fromWei(contribAmount, 'ether').toNumber());
        try{
            await this.sale.sendTransaction({
                value: contribAmount,
                from: this.contributor_1
            });
        }catch (e){
            //console.log(e);
            assert.equal(true, false, "Error thrown when submitting min");
        }
        //contribution went through, lets make sure all allocations are ok
        let finalContributorBalanace = (await web3.eth.getBalance(this.contributor_1)).toNumber();
        let finalSaleTotal = (await this.sale.totalEther()).toNumber();
        let finalContributorAmount = (await this.sale.totalContributors()).toNumber();
        let finalVaultBalanace = (await web3.eth.getBalance(this.vault)).toNumber();

        assert.equal(contribAmount, finalSaleTotal, "Sale total failed to increase");
        assert.equal(initialContributorAmount+1, finalContributorAmount, "Contributor amount did not increment correctly");
        assert.isAbove(initialContributorBalanace - contribAmount, finalContributorBalanace, "Contributor account was not debted");
        assert.equal(web3.toBigNumber(initialVaultBalanace).plus(contribAmount), finalVaultBalanace, "Vault did not recieve correct amount of ether");

        //Lets make sure no discount was applied
        // same logic that is found in executeBuy 
        let tokensRedeemed = web3.toBigNumber(contribAmount).times(web3.toBigNumber(this.exchangeRate).times(80).dividedBy(100)).toNumber();
        let acutalTokens = (await this.gambleT.balanceOf(this.contributor_1)).toNumber();
        assert.equal(acutalTokens, tokensRedeemed, "The caller did not get the correct amount of tokens");
    })

    it('Teir 1 contributions should get the proper amount of tokens', async function(){
        // lets contribute with contributor_2

        let initialContributorBalanace = (await web3.eth.getBalance(this.contributor_2)).toNumber();
        let initialVaultBalanace = (await web3.eth.getBalance(this.vault)).toNumber();
        let initialSaleTotal = (await this.sale.totalEther()).toNumber();
        let initialContributorAmount = (await this.sale.totalContributors()).toNumber();
        // contribution is min
        let contribAmount = this.minDiscount.plus(web3.toWei(1));
        //console.log(web3.fromWei(contribAmount, 'ether').toNumber());
        try{
            await this.sale.sendTransaction({
                value: contribAmount,
                from: this.contributor_2
            });
        }catch (e){
            //console.log(e);
            assert.equal(true, false, "Error thrown when submitting min");
        }
        //contribution went through, lets make sure all allocations are ok
        let finalContributorBalanace = (await web3.eth.getBalance(this.contributor_2)).toNumber();
        let finalSaleTotal = (await this.sale.totalEther()).toNumber();
        let finalContributorAmount = (await this.sale.totalContributors()).toNumber();
        let finalVaultBalanace = (await web3.eth.getBalance(this.vault)).toNumber();

        assert.equal(web3.toBigNumber(initialSaleTotal).plus(contribAmount), finalSaleTotal, "Sale total failed to increase");
        assert.equal(initialContributorAmount+1, finalContributorAmount, "Contributor amount did not increment correctly");
        assert.isAbove(initialContributorBalanace - contribAmount, finalContributorBalanace, "Contributor account was not debted");
        assert.equal(web3.toBigNumber(initialVaultBalanace).plus(contribAmount), finalVaultBalanace, "Vault did not recieve correct amount of ether");

        //Lets make sure no discount was applied
        // same logic that is found in executeBuy 
        let tokensRedeemed = web3.toBigNumber(contribAmount).times(web3.toBigNumber(this.exchangeRate).times(80).dividedBy(100));
        // Lets add the t1 discount and check, we should see a 5% increase in tokens given to the caller
        tokensRedeemed = tokensRedeemed.plus(tokensRedeemed.times(0.05)).toNumber();

        let acutalTokens = (await this.gambleT.balanceOf(this.contributor_2)).toNumber();
        assert.equal(acutalTokens, tokensRedeemed, "The caller did not get the correct amount of tokens");

    })

    it('Teir 2 contributions should get the proper amount of tokens', async function(){
        // lets contribute with contributor_3

        let initialContributorBalanace = (await web3.eth.getBalance(this.contributor_3)).toNumber();
        let initialVaultBalanace = (await web3.eth.getBalance(this.vault)).toNumber();
        let initialSaleTotal = (await this.sale.totalEther()).toNumber();
        let initialContributorAmount = (await this.sale.totalContributors()).toNumber();
        // contribution is min
        let contribAmount = this.firstTierDiscountUpperLimit.plus(web3.toWei(1));
        //console.log(web3.fromWei(contribAmount, 'ether').toNumber());
        try{
            await this.sale.sendTransaction({
                value: contribAmount,
                from: this.contributor_3
            });
        }catch (e){
            //console.log(e);
            assert.equal(true, false, "Error thrown when submitting min");
        }
        //contribution went through, lets make sure all allocations are ok
        let finalContributorBalanace = (await web3.eth.getBalance(this.contributor_3)).toNumber();
        let finalSaleTotal = (await this.sale.totalEther()).toNumber();
        let finalContributorAmount = (await this.sale.totalContributors()).toNumber();
        let finalVaultBalanace = (await web3.eth.getBalance(this.vault)).toNumber();

        assert.equal(web3.toBigNumber(initialSaleTotal).plus(contribAmount), finalSaleTotal, "Sale total failed to increase");
        assert.equal(initialContributorAmount+1, finalContributorAmount, "Contributor amount did not increment correctly");
        assert.isAbove(initialContributorBalanace - contribAmount, finalContributorBalanace, "Contributor account was not debted");
        assert.equal(web3.toBigNumber(initialVaultBalanace).plus(contribAmount), finalVaultBalanace, "Vault did not recieve correct amount of ether");

        //Lets make sure no discount was applied
        // same logic that is found in executeBuy 
        let tokensRedeemed = web3.toBigNumber(contribAmount).times(web3.toBigNumber(this.exchangeRate).times(80).dividedBy(100));
        // Lets add the t2 discount and check, we should see a 10% increase in tokens given to the caller
        tokensRedeemed = tokensRedeemed.plus(tokensRedeemed.times(0.10)).toNumber();

        let acutalTokens = (await this.gambleT.balanceOf(this.contributor_3)).toNumber();
        assert.equal(acutalTokens, tokensRedeemed, "The caller did not get the correct amount of tokens");

    })

    it('Teir 3 contributions should get the proper amount of tokens', async function(){
        // lets contribute with contributor_4

        let initialContributorBalanace = (await web3.eth.getBalance(this.contributor_4)).toNumber();
        let initialVaultBalanace = (await web3.eth.getBalance(this.vault)).toNumber();
        let initialSaleTotal = (await this.sale.totalEther()).toNumber();
        let initialContributorAmount = (await this.sale.totalContributors()).toNumber();
        // contribution is min
        let contribAmount = this.secondTierDiscountUpperLimit.plus(web3.toWei(1));
        //console.log(web3.fromWei(contribAmount, 'ether').toNumber());
        try{
            await this.sale.sendTransaction({
                value: contribAmount,
                from: this.contributor_4
            });
        }catch (e){
            //console.log(e);
            assert.equal(true, false, "Error thrown when submitting");
        }
        //contribution went through, lets make sure all allocations are ok
        let finalContributorBalanace = (await web3.eth.getBalance(this.contributor_4)).toNumber();
        let finalSaleTotal = (await this.sale.totalEther()).toNumber();
        let finalContributorAmount = (await this.sale.totalContributors()).toNumber();
        let finalVaultBalanace = (await web3.eth.getBalance(this.vault)).toNumber();

        assert.equal(web3.toBigNumber(initialSaleTotal).plus(contribAmount), finalSaleTotal, "Sale total failed to increase");
        assert.equal(initialContributorAmount+1, finalContributorAmount, "Contributor amount did not increment correctly");
        assert.isAbove(initialContributorBalanace - contribAmount, finalContributorBalanace, "Contributor account was not debted");
        assert.equal(web3.toBigNumber(initialVaultBalanace).plus(contribAmount), finalVaultBalanace, "Vault did not recieve correct amount of ether");

        //Lets make sure no discount was applied
        // same logic that is found in executeBuy 
        let tokensRedeemed = web3.toBigNumber(contribAmount).times(web3.toBigNumber(this.exchangeRate).times(80).dividedBy(100));
        // Lets add the t3 discount and check, we should see a 20% increase in tokens given to the caller
        tokensRedeemed = tokensRedeemed.plus(tokensRedeemed.times(0.20)).toNumber();

        let acutalTokens = (await this.gambleT.balanceOf(this.contributor_4)).toNumber();
        assert.equal(acutalTokens, tokensRedeemed, "The caller did not get the correct amount of tokens");

    })

    it('Teir 4 contributions should get the proper amount of tokens', async function(){
        // lets contribute with contributor_5

        let initialContributorBalanace = (await web3.eth.getBalance(this.contributor_5)).toNumber();
        let initialVaultBalanace = (await web3.eth.getBalance(this.vault)).toNumber();
        let initialSaleTotal = (await this.sale.totalEther()).toNumber();
        let initialContributorAmount = (await this.sale.totalContributors()).toNumber();
        // contribution is min
        let contribAmount = this.thirdTierDiscountUpperLimit.plus(web3.toWei(1));
        //console.log(web3.fromWei(contribAmount, 'ether').toNumber());
        try{
            await this.sale.sendTransaction({
                value: contribAmount,
                from: this.contributor_5
            });
        }catch (e){
            //console.log(e);
            assert.equal(true, false, "Error thrown when submitting");
        }
        //contribution went through, lets make sure all allocations are ok
        let finalContributorBalanace = (await web3.eth.getBalance(this.contributor_5)).toNumber();
        let finalSaleTotal = (await this.sale.totalEther()).toNumber();
        let finalContributorAmount = (await this.sale.totalContributors()).toNumber();
        let finalVaultBalanace = (await web3.eth.getBalance(this.vault)).toNumber();

        assert.equal(web3.toBigNumber(initialSaleTotal).plus(contribAmount), finalSaleTotal, "Sale total failed to increase");
        assert.equal(initialContributorAmount+1, finalContributorAmount, "Contributor amount did not increment correctly");
        assert.isAbove(initialContributorBalanace - contribAmount, finalContributorBalanace, "Contributor account was not debted");
        assert.equal(web3.toBigNumber(initialVaultBalanace).plus(contribAmount), finalVaultBalanace, "Vault did not recieve correct amount of ether");

        //Lets make sure no discount was applied
        // same logic that is found in executeBuy 
        let tokensRedeemed = web3.toBigNumber(contribAmount).times(web3.toBigNumber(this.exchangeRate).times(80).dividedBy(100));
        // Lets add the t4 discount and check, we should see a 30% increase in tokens given to the caller
        tokensRedeemed = tokensRedeemed.plus(tokensRedeemed.times(0.30)).toNumber();

        let acutalTokens = (await this.gambleT.balanceOf(this.contributor_5)).toNumber();
        assert.equal(acutalTokens, tokensRedeemed, "The caller did not get the correct amount of tokens");

    })


    /**
     * 
     * Negative test cases
     * 
     */

    it('non owners should not be able to mintTokens', async function(){
        // contributer_1 will try to mint tokens to themselves
        let initialBalance = (await this.gambleT.balanceOf(this.contributor_1)).toNumber();
        try{
            await this.sale.mintTokens(1000, this.contributor_1, { from: this.contributor_1})
            assert.equal(false, true, "Mint transaction went through");
        }catch (e){
            //an exception should be thrown
            let finalBalance = (await this.gambleT.balanceOf(this.contributor_1)).toNumber();
            assert.equal(initialBalance, finalBalance, "balance of contributer changed");
        }
    })

    it('transfers should be frozen initially', async function() {
        //contributer_1 will attenpt to send GMBL tokens to contributor_2
        let initContribBalance_1 = (await this.gambleT.balanceOf(this.contributor_1)).toNumber();
        let initContribBalance_2 = (await this.gambleT.balanceOf(this.contributor_2)).toNumber();

        try{
            let response = await this.gambleT.transfer(this.contributor_2, 100, {from: this.contributor_1});
            assert.equal(response, false, "The transaction went through");
        }catch(e){
            let finContribBalance_1 = (await this.gambleT.balanceOf(this.contributor_1)).toNumber();
            let finContribBalance_2 = (await this.gambleT.balanceOf(this.contributor_2)).toNumber();
            assert.equal(initContribBalance_1, finContribBalance_1, "balance of contributer changed");
            assert.equal(initContribBalance_2, finContribBalance_2, "balance of contributer changed");
        }
    })

    //TODO -- add aditional negative tests to check for security


    /**
     * 
     * Enable transfers and make sure all is well
     * 
     */

    it('the owner can enable transfers at anytime', async function(){
        let isEnbaled = await this.sale.allowTransfer();
        assert.equal(isEnbaled, false, "Transfers were enabled prematurely");

        await this.sale.setAllowTransfer(true, {from: this.owner});
        isEnbaled = await this.sale.allowTransfer();
        assert.equal(isEnbaled, true, "Transfer unlock failed");

        //contributer_1 will attenpt to send GMBL tokens to contributor_2
        let initContribBalance_1 = (await this.gambleT.balanceOf(this.contributor_1)).toNumber();
        let initContribBalance_2 = (await this.gambleT.balanceOf(this.contributor_2)).toNumber();

        
        await this.gambleT.transfer(this.contributor_2, 100, {from: this.contributor_1});
        
        let finContribBalance_1 = (await this.gambleT.balanceOf(this.contributor_1)).toNumber();
        let finContribBalance_2 = (await this.gambleT.balanceOf(this.contributor_2)).toNumber();
        assert.equal(web3.toBigNumber(initContribBalance_1).minus(100), finContribBalance_1, "balance of contributer_1 did not change");
        assert.equal(web3.toBigNumber(initContribBalance_2).plus(100), finContribBalance_2, "balance of contributer_2 did not change");

    })

})