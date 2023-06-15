import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { BigNumber } from "ethers";
import { network, deployments, ethers } from "hardhat";
import { developmentChains, networkConfig } from "../../helper-hardhat-config";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types";

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", () => {
        let raffle: Raffle
        let raffleContract: Raffle
        let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock
        let raffleEntranceFee: BigNumber
        let interval: number
        let player: SignerWithAddress
        let accounts: SignerWithAddress[]

        beforeEach(async () => {
            accounts = await ethers.getSigners()
            // deployer = accounts[0]
            player = accounts[1]
            await deployments.fixture(["mocks", "raffle"])
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock") as unknown as VRFCoordinatorV2Mock
            raffleContract = await ethers.getContract("Raffle") as unknown as Raffle
            raffle = raffleContract.connect(player)
            const entranceFee = await raffle.getEntranceFee()
            raffleEntranceFee = BigNumber.from(entranceFee)
            interval = Number(await raffle.getInterval())
        })

        describe("constructor", () => {
            it("initializes the raffle correctly", async () => {
                console.log("chainId: " + network.config.chainId)
                // Ideally, we'd separate these out so that only there's 1 assert per "it" block
                // And ideally, we'd make this checl everything
                const raffleState = (await raffle.getRaffleState()).toString()
                assert.equal(raffleState, "0", "Raffle state should be 0")
                assert.equal(
                    interval.toString(),
                    networkConfig[network.config.chainId!]["keepersUpdateInterval"]
                )
            })
        })

        describe("enterRaffle", () => {
            it("reverts when you don't pay enough", async () => {
                await expect(raffle.enterRaffle()).to.be.revertedWith(
                    "Raffle__NotEnoughETHEntered()"
                )
            })
            it("records player when they enter", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                const contractPlayer = await raffle.getPlayer(0)
                assert.equal(player.address, contractPlayer)
            })
            it("emits event on enter", async () => {
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                    raffle,
                    "RaffleEnter"
                )
            })

            it("doesn't allow entrance when raffle is calculating", async () => {
                console.log("raffle state: " + await raffle.getRaffleState())
                await raffle.enterRaffle({ value: raffleEntranceFee })
                console.log("raffle state1: " + await raffle.getRaffleState())
                await network.provider.send("evm_increaseTime", [interval + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                console.log("raffle state2: " + await raffle.getRaffleState())
                // pretend to be a keeper for a second
                await raffle.performUpkeep([])
                console.log("raffle state3: " + await raffle.getRaffleState())
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                    "Raffle__NotOpen"
                )
            })
        })

        describe("checkUpkeep", () => {
            it("returns false if people haven't sent any ETH", async () => {
                await network.provider.send("evm_increaseTime", [interval + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert(!upkeepNeeded)
            })
            it("resturns false if enough time hasn't passed", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval - 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert(!upkeepNeeded)
            })
            it("returns true if enough time has passed, has players, eth and is open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert(upkeepNeeded)
            })
        })

        describe("performUpkeep", () => {
            it("can only run if checkupkeep is true", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const tx = await raffle.performUpkeep([])
                assert(tx)
            })
            it("reverts if checkup is false", async () => {
                await expect(raffle.performUpkeep([])).to.be.revertedWith(
                    "Raffle__UpkeepNotNeeded"
                )
            })
            it("updates the raffle state and emits a requestId", async () => {
                //too many asserts in this test bruh
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const txResponse = await raffle.performUpkeep([])
                const txReceipt = await txResponse.wait(1)
                const raffleState = await raffle.getRaffleState()
                const requestId = txReceipt!.events![1].args!.requestId
                assert(requestId.toNumber() > 0)
                assert(raffleState == 1)
            })
        })
        describe("fulfillRandomWords", () => {
            beforeEach(async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
            })
            it("can only be called after performupkeep", async () => {
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                ).to.be.revertedWith("nonexistent request")
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                ).to.be.revertedWith("nonexistent request")
            })
            //This test is too big, but used for demonstration purposes
            it("picks a winner, resets and sends money", async () => {
                const additionalEntrances = 3
                const startingIndex = 2
                for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                    raffle = raffleContract.connect(accounts[i])
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                }
                const startingTimestamp = await raffle.getLatestTimestamp()

                //This will be more important for our staging tests...
                await new Promise<void>(async (res, rej) => {
                    raffle.once("WinnerPicked", async () => {
                        console.log("WinnerPicked event fired!")
                        //assert throws an error if it fails, so we need to wrap
                        //it in a try/catch so that the promise returns event
                        //if it fails
                        try {
                            //now lets get the ending values
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const winnerBalance = await accounts[2].getBalance()
                            const endingTimestamp = await raffle.getLatestTimestamp()
                            await expect(raffle.getPlayer(0)).to.be.reverted
                            assert.equal(recentWinner.toString(), accounts[2].address)
                            assert.equal(raffleState, 0)
                            assert.equal(
                                winnerBalance.toString(),
                                startingBalance
                                    .add(raffleEntranceFee.mul(additionalEntrances).add(raffleEntranceFee)).toString()
                            )
                            assert(endingTimestamp > startingTimestamp)
                            res()

                        } catch(e) {
                            rej(e)
                        }
                });

                const tx = await raffle.performUpkeep([])
                const txReceipt = await tx.wait(1)
                const startingBalance = await accounts[2].getBalance()
                await vrfCoordinatorV2Mock.fulfillRandomWords(
                    txReceipt!.events![1].args!.requestId,
                    raffle.address
                )
            })
        })
    })
})