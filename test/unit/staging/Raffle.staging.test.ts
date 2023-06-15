import {assert, expect} from 'chai'
import { BigNumber } from 'ethers'
import {network, ethers, getNamedAccounts} from 'hardhat'
import { developmentChains } from '../../../helper-hardhat-config'
import { Raffle } from '../../../typechain-types'


developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", () => {
        let raffle: Raffle
        let raffleEntranceFee: BigNumber
        let deployer: string
        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer
            //log deployer address
            console.log("Deployer address is: ", deployer)
            raffle = await ethers.getContract('Raffle', deployer)
            const entranceFee = await raffle.getEntranceFee()
            raffleEntranceFee =BigNumber.from(entranceFee)
            //add 0.01 to the entrance fee to account for gas
            raffleEntranceFee = raffleEntranceFee.add(
                BigNumber.from("10000000000000000")
            )
            console.log()
        })


        describe("fulfillRandomWords", () => {
            it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
                //enter the raffle
                console.log("Setting up test...")
                const startingTimestamp = await raffle.getLatestTimestamp()
                const accounts = await ethers.getSigners()

                console.log("Setting up Listener...")
                await new Promise<void>(async (res, rej) => {
                    //setup listener before we enter the raffle
                    //just in acse the blockchain moves REALLY fast
                    raffle.once("WinnerPicked", async () => {
                        console.log("WinnerPicked event fired!")
                        try {
                            //add our asserts here
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const winnerEndingBalance = await accounts[0].getBalance()
                            const endingTimestamp = await raffle.getLatestTimestamp()

                            await expect(raffle.getPlayer(0)).to.be.reverted
                            assert.equal(
                                recentWinner.toString(),
                                accounts[0].address,
                            )
                            assert.equal(raffleState, 0)
                            assert.equal(
                                winnerEndingBalance.toString(),
                                winnerStartingBalance
                                .add(raffleEntranceFee)
                                .toString(),
                            )
                            assert(endingTimestamp > startingTimestamp)
                            res()
                        } catch (e) {
                            rej(e)
                        }
                    })
                    //log the Raffle address
                    console.log("Raffle address is: ", raffle.address)
                    //Then entering the raffle
                    console.log("Entering raffle...")
                    console.log("Raffle entrance fee: ", raffleEntranceFee)
                    const tx = await raffle.enterRaffle({
                        value: raffleEntranceFee,
                    })
                    console.log("Entered raffle")
                    await tx.wait(1)
                    console.log("Waited for tx to be mined")
                    console.log("Ok, time to wait...")
                    const winnerStartingBalance = await accounts[0].getBalance()

                    // and this code WONT complete until our listener has finished listening!
                })
            })
        })
    })