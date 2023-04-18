/* eslint-disable no-console */
import { Relayer } from "defender-relay-client";
import { RelayerModel, RelayerParams } from "defender-relay-client/lib/relayer";

// Entrypoint for the Autotask
export async function handler(credentials: RelayerParams): Promise<string> {
  const relayer = new Relayer(credentials);
  const info: RelayerModel = await relayer.getRelayer();
  console.log(`Relayer address is ${info.address}`);

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

  handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });
}
