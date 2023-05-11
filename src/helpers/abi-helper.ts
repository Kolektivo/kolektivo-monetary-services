import { logMessage } from "./errors-helper";

export interface IContractInfo {
  address: string;
  abi: Array<any>;
}

export interface IContractInfosJson {
  name: string;
  chainId: number;
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
  contracts: {
    [name: string]: IContractInfo;
  };
}

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export interface ISharedContractInfos {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [name: string]: Array<any>;
}

export interface IAutoRelayHandler {
  apiKey: string;
  apiSecret: string;
  secrets: Record<string, string>;
}

let abis: IContractInfosJson;
let sharedAbis: ISharedContractInfos;

export const fetchAbis = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!abis) {
    logMessage("Abi Helper", "fetching abis");

    /**
     * note you should be able to run the production build locally if you have "production=1" in your environment
     */
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      logMessage("Abi Helper: ", `using ABIs: ${process.env.production ? "celo.json" : "celo-test.json"}`);
      abis = require(`../abis/${process.env.production ? "celo.json" : "celo-test.json"}`);
    } catch {
      // abis = require("../abis/celo-test.json");
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      throw new Error("abis not found");
    }

    sharedAbis = require(`../abis/sharedAbis.json`);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getContractAbi = (contractName: string): Array<any> => {
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

export const getContractAddress = (contractName: string): string => {
  const contractInfo: IContractInfo = abis.contracts[contractName];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!contractInfo.address) {
    throw new Error(`abi address not found for ${contractName}`);
  }
  return contractInfo.address;
};
