import { ITransaction } from "../globals";
import { fromWei, getContract, toWei } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";
import { createAllowance } from "../helpers/tokens-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { BigNumber, FixedNumber } from "ethers";
import { BytesLike } from "ethers/lib/utils";

const serviceName = "FloorCeiling Service";

interface IFundManagement {
  sender: string;
  fromInternalBalance: boolean; // always false
  recipient: string;
  toInternalBalance: boolean; // always false
}

interface IBatchSwapStep {
  poolId: BytesLike;
  assetInIndex: number; // index of token In address in assets array
  assetOutIndex: number; // index of token Out address in assets array
  amount: BigNumber; // if using batchSwapExactIn:
  userData: string; // always empty string
}

/**
 * execute a buy or sell between cUSD and kCUR
 */
const sendBuyOrSell = async (
  signer: DefenderRelaySigner,
  relayerAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proxyPoolContract: any,
  kCurContractAddress: string,
  cUsdContractAddress: string,
  /**
   * amount of cUSD when buying or kCUR to give up when selling
   */
  amount: BigNumber,
  /**
   * if true then we're buying kCUR with cUSD
   * if false then we're selling kCUR for cUSD
   */
  isBuying: boolean,
): Promise<ITransaction> => {
  /**
   * docs: https://github.com/Kolektivo/kolektivo-monetary-contracts/blob/feat/mihir/src/dex/IVault.sol#L910
   */
  const funds: IFundManagement = {
    sender: relayerAddress,
    fromInternalBalance: false, // always false
    recipient: relayerAddress,
    toInternalBalance: false, // always false
  };

  const kCurPool = getContract("kCur Pool", signer);
  const poolId: BytesLike = await kCurPool.getPoolId();
  /**
   * docs: https://github.com/Kolektivo/kolektivo-monetary-contracts/blob/feat/mihir/src/dex/IVault.sol#L881
   */
  const batchSwapStep: IBatchSwapStep = {
    /**
     * kCUR pool id
     */
    poolId,
    /**
     * index of token In address in assets array (see assets below)
     */
    assetInIndex: 0,
    /**
     * index of token Out address in assets array (see assets below)
     */
    assetOutIndex: 1,
    /**
     * what we are paying.
     */
    amount: amount,
    /**
     * always empty string
     */
    userData: "0x",
  };
  /**
   * limit says how many tokens can Vault use on behalf of user
   */
  const limits: Array<BigNumber> = [toWei(1000000, 18), toWei(1000000, 18)];
  /**
   * deadline is by what time the swap should be executed
   */
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const deadline: number = currentTimestamp + 60 * 60; // for us we can set it to one hour | used previously in Prime Launch
  const assets = isBuying ? [cUsdContractAddress, kCurContractAddress] : [kCurContractAddress, cUsdContractAddress];

  return proxyPoolContract.batchSwapExactIn(
    [batchSwapStep],
    assets,
    batchSwapStep.amount,
    100000000, // minTotalAmountOut  TODO - figure out what this should be
    funds,
    limits,
    deadline,
  );
};

const doit = async (
  /**
   * if true then we're buying kCUR with cUSD
   * if false then we're selling kCUR for cUSD
   */
  isBuying: boolean,
  /**
   * amount of cUSD when buying or kCUR to give up when selling
   */
  delta: BigNumber,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kCurContract: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cUsdContract: any,
  relayerAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proxyPoolContract: any,
  signer: DefenderRelaySigner,
): Promise<ITransaction> => {
  /**
   * tell kCUR token to allow the Vault to spend kCUR on behalf of the Relayer
   */
  const vault = getContract("Vault", signer);
  /**
   * tell token to allow the proxy contract to spend token on behalf of the Relayer
   */
  await Promise.all([
    createAllowance(
      signer,
      kCurContract,
      isBuying ? "cUSD" : "kCUR",
      delta,
      relayerAddress,
      proxyPoolContract.address,
      serviceName,
    ),

    // eslint-disable-next-line prettier/prettier
    createAllowance(signer,
      kCurContract,
      isBuying ? "cUSD" : "kCUR",
      delta,
      relayerAddress,
      vault.address,
      serviceName,
    ),
  ]);

  return sendBuyOrSell(
    signer,
    relayerAddress,
    proxyPoolContract,
    kCurContract.address,
    cUsdContract.address,
    delta,
    isBuying,
  );
};

export const executeFloorAndCeilingService = async (
  cUsdPrice: number,
  kCurPrice: number,
  relayerAddress: string,
  signer: DefenderRelaySigner,
): Promise<void> => {
  logMessage(serviceName, "executing...");

  try {
    const reserveContract = getContract("Reserve", signer);
    const kCurContract = getContract("CuracaoReserveToken", signer);
    const cUsdContract = getContract("cUSD", signer);
    const proxyPoolContract = getContract("ProxyPool", signer);
    /**
     * reserve value in USD
     */
    const reserveValue = FixedNumber.fromValue((await reserveContract.reserveStatus())[0], 0, "fixed32x18");
    const kCurTotalSupply = FixedNumber.fromValue(await kCurContract.totalSupply(), 0, "fixed32x18");

    if (kCurTotalSupply.isZero()) {
      throw new Error("kCur totalSupply is zero");
    }
    /** floor in USD */
    const floor: number = reserveValue.divUnsafe(kCurTotalSupply).toUnsafeFloat();
    logMessage(serviceName, `reserve floor: ${floor.toString()}`);
    /**
     * multiplier as a number
     */
    const ceilingMultiplier: number = FixedNumber.fromValue(
      await proxyPoolContract.ceilingMultiplier(),
      0,
      "fixed32x18",
    )
      .divUnsafe(FixedNumber.fromString("10000", "fixed32x18"))
      .toUnsafeFloat();
    /**
     * ceiling in USD
     */
    const ceiling = floor * ceilingMultiplier;
    logMessage(serviceName, `reserve ceiling: ${ceiling}`);

    // const reserveToken = await proxyPoolContract.reserveToken();
    // const pairToken = await proxyPoolContract.pairToken();

    /**
     * TODO: this logic makes no sense.  Gotta find better logic
     */

    /**
     * Is below the floor.  Gotta buy kCUR, using cUSD
     */
    if (kCurPrice < floor) {
      logMessage(serviceName, `kCur price ${kCurPrice} is below the floor ${floor}`);

      const delta = toWei((floor - kCurPrice) / kCurPrice, 18).add(1);
      const tx = await doit(true, delta, kCurContract, cUsdContract, relayerAddress, proxyPoolContract, signer);

      logMessage(serviceName, `Bought ${fromWei(delta, 18)} kCUR with cUSD, tx hash: ${tx.hash}`);
      /**
       * Is above the ceiling, gotta sell kCUR, for cUSD
       */
    } else if (kCurPrice > ceiling) {
      logMessage(serviceName, `kCur price ${kCurPrice} is above the ceiling ${ceiling.toString()}`);

      const delta = toWei((kCurPrice - ceiling) / kCurPrice, 18).add(1); // add just a little buffer
      const tx = await doit(false, delta, kCurContract, cUsdContract, relayerAddress, proxyPoolContract, signer);

      logMessage(serviceName, `Sold ${fromWei(delta, 18)} kCUR for cUSD, tx hash: ${tx.hash}`);
    }
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
};
