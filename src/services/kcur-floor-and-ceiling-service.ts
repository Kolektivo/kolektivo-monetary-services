import { ITransaction } from "../globals";
import { getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";
import { createAllowance } from "../helpers/tokens-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { BigNumber } from "ethers";
import { BytesLike, formatEther, parseEther } from "ethers/lib/utils";

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
 * @param buyingKCur
 * @param amount
 * @param kCurContract
 * @param cUsdContract
 * @param relayerAddress
 * @param signer
 */
const sendBuyOrSell = async (
  signer: DefenderRelaySigner,
  relayerAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proxyPoolContract: any,
  kCurContractAddress: string,
  cUsdContractAddress: string,
  /**
   * amount we're paying in
   */
  amount: number,
  /**
   * if true then we're buying kCUR with cUSD
   * if false then we're buying cUSD with kCUR
   */
  buyingKCur: boolean,
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
    amount: parseEther(amount.toString()),
    /**
     * always empty string
     */
    userData: "0x",
  };
  /**
   * empty array to set limits
   * limit says how many tokens can Vault use on behalf of user
   * for us, it will be always empty array
   */
  const limits: Array<number> = [];
  /**
   * deadline is by what time the swap should be executed
   */
  const deadline: number = 60 * 60; // for us we can set it to one hour | used previously in Prime Launch

  const assets = buyingKCur ? [cUsdContractAddress, kCurContractAddress] : [kCurContractAddress, cUsdContractAddress];
  /**
   * make the purchase
   */
  return proxyPoolContract.batchSwapExactIn(
    [batchSwapStep],
    assets,
    batchSwapStep.amount,
    BigNumber.from(0),
    funds,
    limits,
    deadline,
  );
};

export const executeFloorAndCeilingService = async (
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
    const reserveValue = Number.parseFloat(formatEther((await reserveContract.reserveStatus())[0]));
    const kCurTotalSupply = Number.parseFloat(formatEther(await kCurContract.totalSupply()));

    if (!kCurTotalSupply) {
      throw new Error("kCur totalSupply is zero");
    }
    const floor = reserveValue / kCurTotalSupply;
    logMessage(serviceName, `reserve floor: ${floor}`);

    const ceilingMultiplier = Number.parseFloat(formatEther(await proxyPoolContract.ceilingMultiplier()));

    const ceiling = floor * ceilingMultiplier;
    logMessage(serviceName, `reserve ceiling: ${ceiling}`);

    if (kCurPrice < floor) {
      logMessage(serviceName, `kCur price ${kCurPrice} is below the floor ${floor}`);
      const delta = floor - kCurPrice + 0.001; // add just a little buffer
      /**
       * tell kCUR token to allow the proxy contract to spend kCUR on behalf of the Relayer
       */
      await createAllowance(signer, kCurContract, delta, relayerAddress, proxyPoolContract.address);
      /**
       * buy cUSD with kCUR
       */
      const tx: ITransaction = await sendBuyOrSell(
        signer,
        relayerAddress,
        proxyPoolContract,
        kCurContract.address,
        cUsdContract.address,
        delta,
        false,
      );
      logMessage(serviceName, `Bought ${delta} cUSD with kCUR, tx hash: ${tx.hash}`);
    } else if (kCurPrice > ceiling) {
      logMessage(serviceName, `kCur price ${kCurPrice} is above the ceiling ${ceiling}`);
      const delta = kCurPrice - ceiling + 0.001; // add just a little buffer
      /**
       * tell kCUR token to allow the proxy contract to spend cUSD on behalf of the Relayer
       */
      await createAllowance(signer, cUsdContract, delta, relayerAddress, proxyPoolContract.address);
      /**
       * buy kCUR with cUSD
       */
      const tx: ITransaction = await sendBuyOrSell(
        signer,
        relayerAddress,
        proxyPoolContract,
        kCurContract.address,
        cUsdContract.address,
        delta,
        true,
      );
      logMessage(serviceName, `Bought ${delta} kCUR with cUSD, tx hash: ${tx.hash}`);
    }
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
};
