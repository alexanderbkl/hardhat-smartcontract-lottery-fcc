import "@typechain/hardhat"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-etherscan"
import "@nomiclabs/hardhat-ethers"
import "hardhat-gas-reporter"
import "dotenv/config"
import "solidity-coverage"
import "hardhat-deploy"
import { HardhatUserConfig } from "hardhat/config"

//crustio seed 0x7e9f90e8743ec106837cc0c2024359355960e7fcba9935e6179138447ddafe97 test (password, user)
/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "3768ac62-bf0b-4e7e-9210-24271f84b825"
export const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "51E8633S7A49ADJN7AEGNC2WRWTFQJVQX8"
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/q3YfE-__2P3GX27Aw6yEZ2bW5zH8dwX2"
const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "b0e62a4946f4b6ebf5c06c4d60e67cc2fc0cd29b4ec266916fb04cea25b88005"

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      chainId: 31337,
    },
    sepolia: {
      chainId: 11155111,
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
      saveDeployments: true,
    }
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    player: {
      default: 1,
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
    customChains: [],
  },
  gasReporter: {
    enabled: true,
    currency: "EUR",
    noColors: true,
    outputFile: "gas-report.txt",
    coinmarketcap: COINMARKETCAP_API_KEY,
    token: "MATIC",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.18",
      },
      {
        version: "0.4.24",
      },
    ],
  },
  mocha: {
    timeout: 300000, // 300 seconds max for running tests
  },
};

export default config;
