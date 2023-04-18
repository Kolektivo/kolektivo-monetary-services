/* eslint-disable no-console */
import { Relayer } from "defender-relay-client";
import { RelayerModel, RelayerParams } from "defender-relay-client/lib/relayer";

interface IContractInfo {
  address: string;
  abi: Array<any>;
}

interface IContractInfosJson {
  name: string;
  chainId: number;
  contracts: {
    [name: string]: IContractInfo;
  }
}

interface ISharedContractInfos {
  [name: string]: Array<any>;
}

const IS_TESTING = require.main === module;
let abis: IContractInfosJson;
let sharedAbis: ISharedContractInfos;

const fetchAbis = (): void => {
  if (!abis) {
    console.log("fetching abis");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    abis = require(`./abis/${IS_TESTING ? "celo-test.json" : "celo.json"}`);
    if (!abis) {
      throw new Error("abis not found");
    }

    sharedAbis = require(`./abis/sharedAbis.json`);
  }
};

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

// Entrypoint for the Autotask
export async function handler(credentials: RelayerParams /*, context: { notificationClient?: { send: (...) => void } }*/): Promise<string> {
  fetchAbis();
  const relayer = new Relayer(credentials);
  const info: RelayerModel = await relayer.getRelayer();

  // const oracleAbi = getContractAbi("Oracle");

  // console.log(`oracleAbi[0].inputs: ${JSON.stringify(oracleAbi[0].inputs)}`);

  console.log(`Relayer address is ${info.address}`);

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

  handler({ apiKey, apiSecret } /*, { notificationClient: undefined }*/)
    .then(() => process.exit(0))
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });
}

