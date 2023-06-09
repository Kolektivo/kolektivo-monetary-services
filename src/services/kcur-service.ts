import { fromWeiToNumber, getContract, ITransaction } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";
import { getOracleForToken, getReserveContract, updateOracle } from "../helpers/reserve-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { BigNumber, BytesLike } from "ethers/lib/ethers";

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
  try {
    const vault = getContract("Vault", signer);

    const kCurToken = getContract("CuracaoReserveToken", signer);
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

    const Bi = fromWeiToNumber(poolInfo.balances[cUsdIndex], 18); // cUsdBalance
    const Bo = fromWeiToNumber(poolInfo.balances[kCurIndex], 18); // kCurBalance
    const Wi = fromWeiToNumber(weights[cUsdIndex], 18); // cUsdWeight
    const Wo = fromWeiToNumber(weights[kCurIndex], 18); // kCurWeight

    /**
     * see here: https://docs.balancer.fi/reference/math/weighted-math.html#spot-price
     *
     * multiple times cUsdPrice because the exchange rate is in terms of cUSD.  We aren't assuming
     * cUsd is 1-to-1 with fiat USD.
     */
    // eslint-disable-next-line prettier/prettier
  const spotExchangeRate = (Bi / Wi) / (Bo / Wo) * cUsdPrice;

    logMessage(serviceName, `kCUR spot price: ${spotExchangeRate}`);

    // const random = (min: number, max: number): number => Math.floor(Math.random() * (max - min)) + min;
    // const fake = 0.54 + random(0, 100) / 5000;
    // logMessage(serviceName, `fake kCUR spot price: ${fake}`);

    return spotExchangeRate;
  } catch (ex) {
    serviceThrewException("getKCurPrice", ex);
    return undefined;
  }
};

export const executeKCurService = async (kcurPrice: number, signer: DefenderRelaySigner): Promise<void> => {
  logMessage(serviceName, "executing...");

  try {
    const reserveContract = getReserveContract(signer);

    logMessage(serviceName, "Reserve address: ", reserveContract.address);

    const kCurOracleContract = await getOracleForToken(reserveContract, "CuracaoReserveToken", signer);

    logMessage(serviceName, "kCUR Oracle address: ", kCurOracleContract.address);
    logMessage(serviceName, `Reporting ${kcurPrice} to kCUR Oracle`);

    const tx: ITransaction = await updateOracle(kCurOracleContract, kcurPrice);
    await tx.wait(); // await because other services depend on this being up-to-date
    logMessage(serviceName, `Updated kCUR Oracle, tx hash: ${tx.hash}`);
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
};
