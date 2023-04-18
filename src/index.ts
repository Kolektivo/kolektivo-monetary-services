/**
 * the packages available in the Autotask execution environment:
 *    https://docs.openzeppelin.com/defender/autotasks#environment
 */
/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require("axios");
import { Relayer } from "defender-relay-client";
import { RelayerModel } from "defender-relay-client/lib/relayer";

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
const IS_TESTING = require.main === module;

let abis: IContractInfosJson;
let sharedAbis: ISharedContractInfos;

const fetchAbis = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!abis) {
    console.log("fetching abis");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    abis = require(`./abis/${IS_TESTING ? "celo-test.json" : "celo.json"}`);
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

// const getContractAddress = (contractName: string): string => {
//   const contractInfo: IContractInfo = abis.contracts[contractName];
//   // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
//   if (!contractInfo.address) {
//     throw new Error(`abi address not found for ${contractName}`);
//   }
//   return contractInfo.address;
// };

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

/**
 * Entrypoint for the Autotask
 * @param event
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export async function handler(event: IAutoRelayHandler /*, context: { notificationClient?: { send: (...) => void } }*/): Promise<string> {
  fetchAbis();
  const relayer = new Relayer(event);
  const info: RelayerModel = await relayer.getRelayer();

  // const cusdAbi = getContractAbi("cUSD");
  // const cusdAddress = getContractAddress("cUSD");

  // console.log(`oracleAbi[0].inputs: ${JSON.stringify(oracleAbi[0].inputs)}`);

  console.log(`Relayer address is ${info.address}`);

  // const cusdContract = new ethers.Contract(cusdAddress, cusdAbi);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  const coinGeckoApiKey = event.secrets.CoingeckoApiKey;
  const price = await getTokenGeckoPrice("celo-dollar", coinGeckoApiKey);

  console.log("cUSD price: ", price);

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

  return Promise.resolve("");

  // const txRes = await relayer.sendTransaction({
  //   to: '0xc7464dbcA260A8faF033460622B23467Df5AEA42',
  //   value: 100,
  //   speed: 'fast',
  //   gasLimit: '21000',
  // });

  // console.log(txRes);
  // return txRes.hash;
}

// Sample typescript type definitions
type EnvInfo = {
  API_KEY: string;
  API_SECRET: string;
};

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
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
