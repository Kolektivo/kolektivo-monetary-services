import { fromWei, fromWeiToNumber, getContract, ITransaction, toWei } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";
import { createAllowance, IErc20Token } from "../helpers/tokens-helper";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kCurContract: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cUsdContract: any,
  /**
   * amount of kCUR to buy or sell
   */
  kCurAmount: BigNumber,
  kCurPrice: number,
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
    sender: proxyPoolContract.address,
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
     * amount of kCUR we are buying or selling.
     */
    amount: kCurAmount,
    /**
     * always empty string
     */
    userData: "0x",
  };
  /**
   * limit says how many tokens can Vault use on behalf of user
   */
  const limits: Array<BigNumber> = [toWei(10000, 18), toWei(10000, 18)];
  /**
   * deadline is by what time the swap should be executed
   */
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const deadline: number = currentTimestamp + 60 * 60; // for us we can set it to one hour | used previously in Prime Launch
  /**
   * kCUR is always the "exact" amount
   */
  if (isBuying) {
    // const maximumAmountIn = await cUsdContract.balanceOf(relayerAddress);

    logMessage(serviceName, `buying kCUR (${fromWei(batchSwapStep.amount, 18)}) with cUSD`);
    // buying kCUR (out) with cUSD (in)
    return proxyPoolContract.batchSwapExactOut(
      [batchSwapStep],
      [cUsdContract.address, kCurContract.address],
      // maxTotalAmountIn (# of cUSD)
      await cUsdContract.balanceOf(relayerAddress),
      funds,
      limits,
      deadline,
    );
  } else {
    logMessage(serviceName, `selling kCUR (${fromWei(batchSwapStep.amount, 18)}) for cUSD`);
    // selling kCUR (in) to get cUSD (out)
    return proxyPoolContract.batchSwapExactIn(
      [batchSwapStep],
      [kCurContract.address, cUsdContract.address],
      batchSwapStep.amount, // yes, is the same as batchSwapStep.amount
      // minTotalAmountOut (# of cUSD)
      computeValueOfDelta(kCurAmount, kCurPrice),
      funds,
      limits,
      deadline,
    );
  }
};

const doit = async (
  /**
   * if true then we're buying kCUR with cUSD
   * if false then we're selling kCUR for cUSD
   */
  isBuying: boolean,
  /**
   * amount of kCUR to receive when buying or to pay when selling
   */
  kCurAmount: BigNumber,
  kCurPrice: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kCurContract: IErc20Token,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cUsdContract: IErc20Token,
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
   * Since we can't know the amount of cUSD in advance (kCUr is always the fixed amount in the exchange),
   * we will set the allowance the full balance of cUSD in relayer (maybe is better than unlimited, wishful thinking).
   *
   * cUsdAmount isn't used if !isBuying
   */
  const cUsdAmount = isBuying ? await cUsdContract.balanceOf(relayerAddress) : null;
  await Promise.all([
    createAllowance(
      signer,
      isBuying ? cUsdContract : kCurContract,
      isBuying ? "cUSD" : "kCUR",
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      isBuying ? cUsdAmount! : kCurAmount,
      relayerAddress,
      proxyPoolContract.address,
      serviceName,
    ),

    // eslint-disable-next-line prettier/prettier
    createAllowance(signer,
      isBuying ? cUsdContract : kCurContract,
      isBuying ? "cUSD" : "kCUR",
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      isBuying ? cUsdAmount! : kCurAmount,
      relayerAddress,
      vault.address,
      serviceName,
    ),
  ]);

  return sendBuyOrSell(
    signer,
    relayerAddress,
    proxyPoolContract,
    kCurContract,
    cUsdContract,
    kCurAmount,
    kCurPrice,
    isBuying,
  );
};

const BPS = 10000;

/**
 * backingRatio is (reserveValuation * BPS) / supplyValuation
 * @param backingRatio - not / BPS
 * @param ceilingMultiplier - not / BPS
 * @returns
 * [0]: a limit is breached
 * [1]: floor is breached (else if [0] then ceiling)
 */
const checkReserveLimits = (
  backingRatio: number,
  ceilingMultiplier: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Array<boolean> => {
  // checks following
  // current floor price <= current kCur price
  // below condition is a derived condition which in the end checks same logic
  if (backingRatio > BPS) {
    return [true, true];
  }

  // Ceiling
  // check following
  // current kCur price > current floor price * ceiling multiplier
  // below condition is a derived condition which in the end checks the same logic
  // ceilingMultiplier -> if 3.5 = 35000
  if (backingRatio * ceilingMultiplier < BPS * BPS) {
    return [true, false];
  }

  return [false, false];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getFloor = (reserveBacking: number, kCurPrice: number): number => {
  return (reserveBacking / BPS) * kCurPrice;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getCeiling = (ceilingMultiplier: number, floor: number): number => {
  return floor * (ceilingMultiplier / BPS);
};

/**
 * compute the number of kCUR needed to buy or sell.
 * The idea here is to alter the total supply of kCUR enough to cause
 * the floor or ceiling to equal the current price of xCUR
 */
const computeDelta = (
  reserveValue: BigNumber,
  kCurPrice: number,
  kCurTotalSupply: BigNumber,
  forFloor: boolean,
): BigNumber => {
  const totalSupply = FixedNumber.fromValue(kCurTotalSupply, 0, "fixed32x18");

  // kCurTotalSupply * (reserveValue / (kCurTotalSupply * kCurPrice))
  let delta = FixedNumber.fromValue(reserveValue, 0, "fixed32x18")
    // eslint-disable-next-line prettier/prettier
    .divUnsafe(totalSupply.mulUnsafe(FixedNumber.fromString(kCurPrice.toString(), "fixed32x18")))
    .mulUnsafe(totalSupply)
    .addUnsafe(FixedNumber.fromString("1", "fixed32x18")) // just to be safe
    .round(0);

  /**
   * get the delta
   */
  if (forFloor) {
    // ceiling deltas will be negative
    delta = delta.subUnsafe(totalSupply);
  } else {
    delta = totalSupply.subUnsafe(delta);
  }

  return BigNumber.from(delta.toFormat("fixed32x0").toString());
};

const computeValueOfDelta = (deltaBG: BigNumber, kCurPrice: number): BigNumber => {
  const delta = FixedNumber.fromValue(deltaBG, 0, "fixed32x18");
  return BigNumber.from(
    FixedNumber.fromString(kCurPrice.toString(), "fixed32x18")
      .mulUnsafe(delta)
      .round(0)
      .toFormat("fixed32x0")
      .toString(),
  );
};

const getkCurTotalSupply = (totalSupplyValue: BigNumber, kCurPrice: number): BigNumber => {
  return BigNumber.from(
    FixedNumber.fromValue(totalSupplyValue, 0, "fixed32x18")
      .divUnsafe(FixedNumber.fromString(kCurPrice.toString(), "fixed32x18"))
      .round(0)
      .toFormat("fixed32x0")
      .toString(),
  );
};

/**
 * @param kCurPrice this relies on the Reserve.reserveStatus being up-to-date with
 *                  the price having been reported to the Reserve kCur Oracle by the kcur-service.
 * @param relayerAddress
 * @param signer
 */
export const executeFloorAndCeilingService = async (
  kCurPrice: number,
  relayerAddress: string,
  signer: DefenderRelaySigner,
): Promise<void> => {
  logMessage(serviceName, "executing...");

  try {
    const reserveContract = getContract("Reserve", signer);
    const kCurContract = getContract("CuracaoReserveToken", signer) as unknown as IErc20Token;
    const cUsdContract = getContract("cUSD", signer) as unknown as IErc20Token;
    const proxyPoolContract = getContract("ProxyPool", signer);
    logMessage(serviceName, `Proxy pool address is: ${proxyPoolContract.address}`);
    const reserveStatus = await reserveContract.reserveStatus();
    const ceilingMultiplier = Number(await proxyPoolContract.ceilingMultiplier());
    const backingRatio = Number(reserveStatus[2]);

    logMessage(serviceName, `ceilingMultiplier: ${ceilingMultiplier / BPS}`);
    logMessage(serviceName, `backingRatio: ${backingRatio / BPS}`);

    const breachState = checkReserveLimits(backingRatio, ceilingMultiplier);

    // const reserveToken = await proxyPoolContract.reserveToken();
    // const pairToken = await proxyPoolContract.pairToken();

    const floor = getFloor(backingRatio, kCurPrice);
    logMessage(serviceName, `floor: ${floor}`);
    const ceiling = getCeiling(ceilingMultiplier, floor);
    logMessage(serviceName, `ceiling: ${ceiling}`);

    if (breachState[0]) {
      const totalSupply = getkCurTotalSupply(reserveStatus[1], kCurPrice);
      logMessage(serviceName, `kCUR total supply: ${fromWeiToNumber(totalSupply, 18)}`);
      logMessage(serviceName, `Reserve value: ${fromWeiToNumber(reserveStatus[0], 18)}`);

      if (breachState[1]) {
        /**
         * Is below the floor.
         */
        logMessage(serviceName, `The floor has been breached`);
        /**
         * delta is how many kCUR we should be burning (selling) to bring the treasury value on par with
         * the value of the total supply of kCUR.
         */
        const delta = computeDelta(reserveStatus[0], kCurPrice, totalSupply, true);

        /**
         * don't invoke this for now, as the logic is not fully worked out
        const tx = await doit(
          false,
          delta,
          kCurPrice,
          kCurContract,
          cUsdContract,
          relayerAddress,
          proxyPoolContract,
          signer,
        );

        logMessage(serviceName, `Sold ${fromWei(delta, 18)} kCUR for cUSD, tx hash: ${tx.hash}`);
         */
      } else {
        /**
         * Is above the ceiling
         */
        logMessage(serviceName, `The ceiling has been breached`);
        /**
         * delta is how many kCUR we should be minting (buying) to bring the treasury value on par with
         * the value of the total supply of kCUR.
         */
        const delta = computeDelta(reserveStatus[0], kCurPrice, totalSupply, false);

        /**
         * don't invoke this for now, as the logic is not fully worked out
        const tx = await doit(
          true,
          delta,
          kCurPrice,
          kCurContract,
          cUsdContract,
          relayerAddress,
          proxyPoolContract,
          signer,
        );

        logMessage(serviceName, `Bought ${fromWei(delta, 18)} kCUR with cUSD, tx hash: ${tx.hash}`);
        */
      }
    } else {
      logMessage(serviceName, `kCur is within range ${kCurPrice}: (${floor} to ${ceiling})`);
    }
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
};
