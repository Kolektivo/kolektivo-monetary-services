import { ITransaction, KGUILDER_USDPRICE } from "../globals";
import { fromWei, getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";
import { IErc20Token } from "../helpers/tokens-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { BigNumber, FixedNumber } from "ethers";

const serviceName = "Mento Service";

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

    const kCurTotalValue = BigNumber.from(
      FixedNumber.fromValue(await kCurContract.balanceOf(mentoReserveContract.address), 0, "fixed32x18")
        .mulUnsafe(FixedNumber.fromString(kCurPrice.toString(), "fixed32x18"))
        .addUnsafe(FixedNumber.fromString("1", "fixed32x18")) // round up one wei
        .round(0)
        .toFormat("fixed32x0")
        .toString(),
    );

    /**
     * using the fixed price of kG
     */
    const kGTotalValue = BigNumber.from(
      FixedNumber.fromValue(await kGContract.totalSupply(), 0, "fixed32x18")
        .mulUnsafe(FixedNumber.fromString(KGUILDER_USDPRICE.toString(), "fixed32x18"))
        .addUnsafe(FixedNumber.fromString("1", "fixed32x18")) // round up one wei
        .round(0)
        .toFormat("fixed32x0")
        .toString(),
    );

    logMessage(serviceName, `kCUR total value: ${kCurTotalValue.toString()}`);
    logMessage(serviceName, `kG total value: ${kGTotalValue.toString()}`);

    if (kCurTotalValue.lt(kGTotalValue)) {
      /**
       * then need to increase the balance of kCUR in the MentoReserve.
       * round up cause we don't want a fractional number of tokens, and rounding down wouldn.t give us enough.
       */
      const amount = kGTotalValue.sub(kCurTotalValue);
      const relayerBalance = await kCurContract.balanceOf(relayerAddress);

      if (relayerBalance.lt(amount)) {
        throw new Error(
          `The Relayer has insufficient balance (${fromWei(
            relayerBalance,
            18,
          )}) to send to the MentoReserve (needs: ${fromWei(amount, 18)})`,
        );
      }
      const tx: ITransaction = await kCurContract.transfer(mentoReserveContract.address, amount);
      logMessage(serviceName, `Transferred ${fromWei(amount, 18)} kCur to the MentoReserve, tx hash: ${tx.hash}`);
    } else if (kGTotalValue.lt(kCurTotalValue)) {
      /**
       * then need to decrease the balance of kCUR in the MentoReserve.
       * round up cause we don't want a fractional number of tokens, and rounding down wouldn.t give us enough.
       */
      const amount = kCurTotalValue.sub(kGTotalValue);
      const mentoExchangeAvailable = await mentoReserveContract.getUnfrozenBalance();

      if (mentoExchangeAvailable.lt(amount)) {
        throw new Error(
          `The MentoExchange has insufficient balance (${fromWei(
            mentoExchangeAvailable,
            18,
          )}) to send to the Relayer (needs: ${fromWei(amount, 18)})`,
        );
      }

      const tx: ITransaction = await mentoReserveContract.transferExchangeGold(relayerAddress, amount);
      logMessage(serviceName, `Transferred ${fromWei(amount, 18)} kCur from the MentoReserve, tx hash: ${tx.hash}`);
    }
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
};
