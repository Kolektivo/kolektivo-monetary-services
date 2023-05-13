import { KGUILDER_USDPRICE } from "../globals";
import { fromWei, fromWeiToNumber, getContract, ITransaction, toWei } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";
import { IErc20Token } from "../helpers/tokens-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { FixedNumber } from "ethers";

const serviceName = "Mento Service";

/**
 * What we are doing here:
 *
 * The USD value of kG is hardcoded (same as the 1.79 ratio of Guilder to USD) in the StablePool and by how we compute
 * the kCUR/kG exchange rate in the service that reports the rate to the Mento SortedOracles (kg-kcur-rate-service).
 *
 * This Mento Arbitrage service is meant to maintain the level of backing of kCUR to kG,
 * based on the current price of kCUR (which comes from the WeightedPool).
 *
 * To that end, the total value of kG needs to equal the total value of kCUR in the MentoReserve.
 *
 * The price of kCUR comes from the WeightedPool, the supply comes from kCUR.balanceOf(MentoReserve)
 *
 * The price of kG is, again, based on the 1.79, and its supply comes from kG.totalSupply
 *
 * We can correct any inequality by raising or lowering the supply of kCUR in the MentoReserve.
 * Increase kCUR by sending to the MentoReserve, decrease using MentoReserve.transferExchangeGold.
 *
 * Since there is frequent fluctuation in the USD value of kCUR and the totalSupply of kCUR,
 * we find that this service must frequently update the balance.
 */
export const executeMentoService = async (
  kCurPrice: number,
  relayerAddress: string,
  signer: DefenderRelaySigner,
): Promise<void> => {
  logMessage(serviceName, "executing...");

  try {
    const kCurContract = getContract("CuracaoReserveToken", signer) as unknown as IErc20Token;
    const kGContract = getContract("KolektivoGuilder", signer) as unknown as IErc20Token;
    const mentoReserveContract = getContract("MentoReserve", signer);
    logMessage(serviceName, `MentoReserve address is: ${mentoReserveContract.address}`);

    const kCurTotalSupply = await kCurContract.balanceOf(mentoReserveContract.address);

    const kCurTotalValue = fromWeiToNumber(
      FixedNumber.fromValue(kCurTotalSupply)
        .mulUnsafe(FixedNumber.fromString(kCurPrice.toString()))
        .round(0)
        .toFormat("fixed32x0")
        .toString(),
      18,
    );

    const kGTotalSupply = await kGContract.totalSupply();

    /**
     * Using the fixed price of kG to help maintain that fixed
     * equivalence between kGUilder and Guilder
     */
    const kGTotalValue = fromWeiToNumber(
      FixedNumber.fromValue(kGTotalSupply)
        .mulUnsafe(FixedNumber.fromString(KGUILDER_USDPRICE.toString()))
        .round(0)
        .toFormat("fixed32x0")
        .toString(),
      18,
    );

    logMessage(serviceName, `kCUR total supply: ${fromWei(kCurTotalSupply, 18)}`);
    logMessage(serviceName, `kG total supply: ${fromWei(kGTotalSupply, 18)}`);

    logMessage(serviceName, `kCUR total value: ${kCurTotalValue.toString()}`);
    logMessage(serviceName, `kG total value: ${kGTotalValue.toString()}`);

    if (kCurTotalValue < kGTotalValue) {
      /**
       * then need to increase the balance of kCUR in the MentoReserve.
       */
      const deltaKCur = toWei((kGTotalValue - kCurTotalValue) / kCurPrice, 18);
      const relayerBalance = await kCurContract.balanceOf(relayerAddress);

      if (relayerBalance.lt(deltaKCur)) {
        throw new Error(
          `The Relayer has insufficient balance (${fromWei(
            relayerBalance,
            18,
          )}) to send to the MentoReserve (needs: ${fromWei(deltaKCur, 18)})`,
        );
      }

      const tx: ITransaction = await kCurContract.transfer(mentoReserveContract.address, deltaKCur);
      logMessage(serviceName, `Transferred ${fromWei(deltaKCur, 18)} kCur to the MentoReserve, tx hash: ${tx.hash}`);
    } else if (kGTotalValue < kCurTotalValue) {
      /**
       * then need to decrease the balance of kCUR in the MentoReserve.
       */
      const deltaKCur = toWei((kCurTotalValue - kGTotalValue) / kCurPrice, 18);
      const mentoExchangeAvailable = await mentoReserveContract.getUnfrozenBalance();

      if (mentoExchangeAvailable.lt(deltaKCur)) {
        throw new Error(
          `The MentoExchange has insufficient balance (${fromWei(
            mentoExchangeAvailable,
            18,
          )}) to send to the Relayer (needs: ${fromWei(deltaKCur, 18)})`,
        );
      }

      const tx: ITransaction = await mentoReserveContract.transferExchangeGold(relayerAddress, deltaKCur);
      logMessage(serviceName, `Transferred ${fromWei(deltaKCur, 18)} kCur from the MentoReserve, tx hash: ${tx.hash}`);
    } else {
      logMessage(serviceName, `No changes required, the numbers are balanced`);
    }
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
};
