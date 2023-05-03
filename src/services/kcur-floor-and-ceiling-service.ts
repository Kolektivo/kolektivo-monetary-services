import { ITransaction } from "../globals";
import { getContractAddress } from "../helpers/abi-helper";
import { getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";

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
 * @param buy
 * @param amount
 * @param kCurContract
 * @param cUsdContract
 * @param relayerAddress
 * @param signer
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendBuyOrSell = async (
  signer: DefenderRelaySigner,
  relayerAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proxyPoolContract: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kCurContractAddress: string,
  amount: number,
  buy: boolean,
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
    poolId,
    assetInIndex: 0, // index of token In address in assets array (see assets below)
    assetOutIndex: 1, // index of token Out address in assets array (see assets below)
    amount: parseEther(amount.toString()),
    userData: "", // always empty string
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

  const cUsdContractAddress = getContractAddress("cUSD");
  const assets = buy ? [cUsdContractAddress, kCurContractAddress] : [kCurContractAddress, cUsdContractAddress];

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
    /**
     * 1.79 Guilder is hardcoded to 1 $USD
     * one kG meant to be pegged to 1 Guilder, one-to-one
     * balance of kCUR in Mento Reserve is meant to be fixed to the totalSupply of kGuilder
     */
    const reserveContract = getContract("Reserve", signer);
    const kCurContract = getContract("CuracaoReserveToken", signer);
    const proxyPoolContract = getContract("ProxyPool", signer);

    //price floor is defined in the BL as Reserve Value / kCUR Supply
    const reserveValue = Number.parseFloat(formatEther((await reserveContract.reserveStatus())[0]));
    const kCurTotalSupply = Number.parseFloat(formatEther(await kCurContract.totalSupply()));

    if (!kCurTotalSupply) {
      throw new Error("kCur totalSupply is zero");
    }
    const floor = reserveValue / kCurTotalSupply;
    logMessage(serviceName, `reserve floor: ${floor}`);

    const ceilingMultiplier = Number.parseFloat(formatEther(await proxyPoolContract.ceilingMultiplier()));

    //price ceiling is defined in the BL as Price Floor * Ceiling Multiplier
    const ceiling = floor * ceilingMultiplier;
    logMessage(serviceName, `reserve ceiling: ${ceiling}`);

    if (kCurPrice < floor) {
      logMessage(serviceName, `kCur price ${kCurPrice} is below the floor ${floor}`);
      const delta = floor - kCurPrice + 0.001; // just a little buffer
      /**
       * sell cUSD for kCUR
       */
      const tx: ITransaction = await sendBuyOrSell(
        signer,
        relayerAddress,
        proxyPoolContract,
        kCurContract.address,
        delta,
        false,
      );
      logMessage(serviceName, `Sold ${delta} kCUR for cUSD, tx hash: ${tx.hash}`);
    } else if (kCurPrice > ceiling) {
      logMessage(serviceName, `kCur price ${kCurPrice} is above the ceiling ${ceiling}`);
      const delta = kCurPrice - ceiling + 0.001; // just a little buffer
      /**
       * buy cUSD for kCUR
       */
      const tx: ITransaction = await sendBuyOrSell(
        signer,
        relayerAddress,
        proxyPoolContract,
        kCurContract.address,
        delta,
        true,
      );
      logMessage(serviceName, `Bought ${delta} kCUR for cUSD, tx hash: ${tx.hash}`);
    }
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
  return await Promise.resolve();
};
