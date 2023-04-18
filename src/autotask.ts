/* eslint-disable no-console */
import { Relayer } from "defender-relay-client";
import { RelayerModel, RelayerParams } from "defender-relay-client/lib/relayer";

// const IS_TESTING = require.main === module;
// let abis = "";
// const fetchABIs = async () => {
//   if (abis === "") {
//     const from = IS_TESTING
//       ? "https://raw.githubusercontent.com/Kolektivo/kolektivo-monetary-contracts/development/exports/celo-test.json?token=GHSAT0AAAAAACA465CW4KWNT34WZRO7VHM2ZB54IEQ"
//       : "https://raw.githubusercontent.com/Kolektivo/kolektivo-monetary-contracts/development/exports/celo.json?token=GHSAT0AAAAAACA465CXSXIZ7CAD3WACJOAKZB55EVQ";
//     const response = await fetch(from);
//     abis = await response.json();
//   }
//   return abis;
// };
// const async getContractAbi = (
//   contractType: TContractType,
//   name: Extract<keyof ContractGroupsJsons[TContractType]['main']['contracts'], string>
// ): Promise<string> => {
//   const contractData = (
//     IS_TESTING ? ((await fetchABIS(`../../contracts/${contractType}/celo-test.json`)) as unknown) : ((await import(`../../contracts/${contractType}/celo.json`)) as unknown)
//   );
//   const contracts = contractData.contracts;
//   const contract = contracts[name as keyof typeof contracts] as unknown as { abi: string | ContractInterface; address: string };
//   let abi = contract.abi;
//   if (typeof abi === 'string') {
//     const key = abi as keyof ContractGroupsSharedJson;
//     abi = (await this.getSharedAbi(contractType, key)) as ContractInterface;
//   }
//   overrideAddress = overrideAddress ?? contract.address;
//   if (!overrideAddress) {
//     throw new Error(`ContractService: requested contract has no address: ${name}`);
//   }
//   return abi;
// }
// const async getSharedAbi = (contractType: TContractType, key: keyof ContractGroupsJsons[TContractType]['shared']) => {
//   const abis = await fetchABIs();
//   // console.log(abis)
//   const contractData = (await import(`../../contracts/${contractType}/sharedAbis.json`)) as ContractGroupsJsons[TContractType]['shared'];
//   return contractData[key];
// }

// Entrypoint for the Autotask
export async function handler(credentials: RelayerParams /*, context: { notificationClient?: { send: (...) => void } }*/): Promise<string> {
  const relayer = new Relayer(credentials);
  const info: RelayerModel = await relayer.getRelayer();
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
  // console.log("API_KEY", apiKey, "API_SECRET", apiSecret);

  handler({ apiKey, apiSecret }/*, { notificationClient: undefined }*/)
    .then(() => process.exit(0))
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });
}
