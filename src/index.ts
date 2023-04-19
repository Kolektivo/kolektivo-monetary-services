/**
 * the packages available in the Autotask execution environment:
 *    https://docs.openzeppelin.com/defender/autotasks#environment
 */
/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require("axios");
import { Relayer } from "defender-relay-client";
import { DefenderRelayProvider, DefenderRelaySigner } from "defender-relay-client/lib/ethers";
import { RelayerModel } from "defender-relay-client/lib/relayer";
import { ethers } from "ethers";
import { Contract } from "ethers/lib/ethers";

const RUNNING_LOCALLY = require.main === module;

/*************************************
 * ABI services
 */
interface IContractInfo {
  address: string;
  abi: Array<any>;
}

interface IContractInfosJson {
  name: string;
  chainId: number;
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
  contracts: {
    [name: string]: IContractInfo;
  };
}

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
interface ISharedContractInfos {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [name: string]: Array<any>;
}

interface IAutoRelayHandler {
  apiKey: string;
  apiSecret: string;
  secrets: Record<string, string>;
}

let abis: IContractInfosJson;
let sharedAbis: ISharedContractInfos;

const fetchAbis = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!abis) {
    console.log("fetching abis");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // TODO restore this when ready for production: abis = require(`./abis/${RUNNING_LOCALLY ? "celo-test.json" : "celo.json"}`);
    abis = require("./abis/celo-test.json");
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!abis) {
      throw new Error("abis not found");
    }

    sharedAbis = require(`./abis/sharedAbis.json`);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getContractAbi = (contractName: string): Array<any> => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  let abi = abis.contracts[contractName]?.abi;
  if (typeof abi === "string") {
    // is name of shared abi, such as ERC20
    abi = sharedAbis[abi];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (!abi) {
    abi = sharedAbis[contractName];
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!abi) {
    throw new Error(`abi not found for ${contractName}`);
  }

  return abi;
};

const getContractAddress = (contractName: string): string => {
  const contractInfo: IContractInfo = abis.contracts[contractName];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!contractInfo.address) {
    throw new Error(`abi address not found for ${contractName}`);
  }
  return contractInfo.address;
};

const getTokenGeckoPrice = (geckoTokenId: string, coinGeckoApiKey: string): Promise<number> => {
  // const geckoTokenId = `${tokenName.toLowerCase()}-${tokenSymbol.toLowerCase()}`;

  const uri = `https://pro-api.coingecko.com/api/v3/coins/${geckoTokenId}?market_data=true&localization=false&community_data=false&developer_data=false&sparkline=false&x_cg_pro_api_key=${coinGeckoApiKey}`;

  return (
    axios
      .get(uri)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((response: any) => {
        return response.data.market_data.current_price.usd ?? 0;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((ex: any) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`price not found for token: ${geckoTokenId}, ex: ${ex.message}`);
      })
  );

  return Promise.resolve(1.0);
};

/*******************************
 * Reserve Oracle functions
 */
const getReserveContract = (signer: DefenderRelaySigner): Contract => {
  const reserveAddress = getContractAddress("Reserve");
  const reserveAbi = getContractAbi("Reserve");
  return new ethers.Contract(reserveAddress, reserveAbi, signer);
};

const getOracleForToken = async (reserveContract: Contract, erc20Name: string, signer: DefenderRelaySigner): Promise<Contract> => {
  const erc20Address = getContractAddress(erc20Name);
  const oracleAddress = await reserveContract.oraclePerERC20(erc20Address);
  const oracleAbi = getContractAbi("Oracle");
  return new ethers.Contract(oracleAddress, oracleAbi, signer);
};

const updateOracle = (oracleContract: Contract, price: number): Promise<void> => {
  // default precision is 18
  const formattedPrice = ethers.utils.parseEther(price.toString());
  return oracleContract.pushReport(formattedPrice);
};

/********************************
 * Autotask entrypoint for the entire service
 *
 * The autotask logs all exceptions thrown here, including stack trace, and sends an email to the Defender account holder.
 *
 * @returns I believe can be used to trigger notifications
 */
export async function handler(event: IAutoRelayHandler /*, context: { notificationClient?: { send: (...) => void } }*/): Promise<string> {
  fetchAbis();
  const relayer = new Relayer(event);

  const info: RelayerModel = await relayer.getRelayer();
  console.log(`Relayer address is ${info.address}`);

  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fast" });

  const coinGeckoApiKey = event.secrets.CoingeckoApiKey;
  const cusdPrice = await getTokenGeckoPrice("celo-dollar", coinGeckoApiKey);

  // confirm here: https://www.coingecko.com/en/coins/celo-dollar
  console.log("cUSD price: ", cusdPrice);

  const reserveContract = getReserveContract(signer);

  console.log("Reserve address: ", reserveContract.address);

  const oracleContract = await getOracleForToken(reserveContract, "cUSD", signer);

  console.log("cUSD Oracle address: ", oracleContract.address);
  console.log("Updating cUSD oracle");

  /**
   * From https://www.npmjs.com/package/defender-relay-client#user-content-ethersjs :
   *
   * A wait on the transaction to be mined will only wait for the current transaction hash (see Querying).
   * If Defender Relayer replaces the transaction with a different one, this operation will time out.
   * This is ok for fast transactions, since Defender only reprices after a few minutes.
   * But if you expect the transaction to take a long time to be mined, then ethers' wait may not work.
   * Future versions will also include an ethers provider aware of this.
   */
  const tx = await updateOracle(oracleContract, cusdPrice);
  // const mined = await tx.wait();

  // const cusdAbi = getContractAbi("cUSD");
  // const cusdAddress = getContractAddress("cUSD");

  // const { notificationClient } = context;
  // if (notificationClient) {
  //   try {
  //     notificationClient.send({
  //       channelAlias: "Kolektivo Notifications",
  //       subject: "Autotask notification example",
  //       message: "This is an example of a email notification sent from an autotask",
  //     });
  //   } catch (error) {
  //     console.error("Failed to send notification", error);
  //   }
  // }

  return "Success";

  // const txRes = await relayer.sendTransaction({
  //   to: '0xc7464dbcA260A8faF033460622B23467Df5AEA42',
  //   value: 100,
  //   speed: 'fast',
  //   gasLimit: '21000',
  // });

  // console.log(txRes);
  // return txRes.hash;
}

/*************************************
 * To run locally (this code will not be executed in Autotasks)
 */
// Sample typescript type definitions
type EnvInfo = {
  API_KEY: string;
  API_SECRET: string;
};

if (RUNNING_LOCALLY) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config();
  const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env as EnvInfo;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition

  handler({ apiKey, apiSecret, secrets: {} } /*, { notificationClient: undefined }*/)
    .then(() => process.exit(0))
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });
}
