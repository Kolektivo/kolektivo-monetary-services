import { getContract } from "./contracts-service";
import { logMessage, serviceThrewException } from "./errors-service";
import { getOracleForToken, getReserveContract, updateOracle } from "./reserve-service";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { BigNumber, BytesLike } from "ethers/lib/ethers";
import { formatEther } from "ethers/lib/utils";

/**
 * this is a made up struct just for explaining what is returned from Vault
 */
interface IPoolTokensStruct {
  tokens: Array<string>; // [Ti, To]
  balances: Array<BigNumber>; // [Bi, Bo]
  lastChangeBlock: BigNumber;
}

const serviceName = "kCur Service";

export const getKCurPrice = async (cUsdPrice: number, signer: DefenderRelaySigner): Promise<number | undefined> => {
  let spotExchangeRate: number;

  const vault = getContract("Symmetric-Vault", signer);

  const kCurToken = getContract("kCur", signer);
  const cUsdToken = getContract("cUSD", signer);

  const kCurPool = getContract("kCur Pool", signer);

  const kCurIndex = kCurToken.address.toLowerCase() < cUsdToken.address.toLowerCase() ? 0 : 1;
  const cUsdIndex = kCurIndex ? 0 : 1;

  /**
   * see here: https://www.notion.so/curvelabs/Symmetric-Pools-ec2dcc480c6b440db734caf515840fa8?pvs=4#64bb38994a77416aadba3890bcfb4375
   */
  const weights: Array<BigNumber> = await kCurPool.getNormalizedWeights();
  const poolId: BytesLike = await kCurPool.getPoolId();
  const poolInfo: IPoolTokensStruct = await vault.getPoolTokens(poolId);

  const Bi = Number.parseFloat(formatEther(poolInfo.balances[cUsdIndex])); // cUsdBalance
  const Bo = Number.parseFloat(formatEther(poolInfo.balances[kCurIndex])); // kCurBalance
  const Wi = Number.parseFloat(formatEther(weights[cUsdIndex])); // cUsdWeight
  const Wo = Number.parseFloat(formatEther(weights[kCurIndex])); // kCurWeight

  /**
   * see here: https://docs.balancer.fi/reference/math/weighted-math.html#spot-price
   *
   * multiple times cUsdPrice because the exchange rate is in terms of cUSD
   */
  // eslint-disable-next-line prettier/prettier
  spotExchangeRate = (Bi / Wi) / (Bo / Wo) * cUsdPrice;

  logMessage(serviceName, `computed kCUR spot price: ${spotExchangeRate}`);

  return spotExchangeRate;
};

export const executeKCurService = async (kcurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  logMessage(serviceName, "executing the kCurService");

  try {
    const reserveContract = getReserveContract(signer);

    logMessage(serviceName, "Reserve address: ", reserveContract.address);

    const kCurOracleContract = await getOracleForToken(reserveContract, "kCur", signer);

    logMessage(serviceName, "kCUR Oracle address: ", kCurOracleContract.address);
    logMessage(serviceName, "Updating kCUR oracle");

    const tx = await updateOracle(kCurOracleContract, kcurPrice);
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    logMessage(serviceName, `Updated kCUR oracle tx hash: ${tx.hash}`);
    // const mined = await tx.wait();

    /**
     * TODO: write the price to Mento Oracle
     */
  } catch (ex) {
    serviceThrewException(serviceName, ex);
    return undefined;
  }
};
