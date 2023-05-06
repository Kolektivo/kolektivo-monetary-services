import { KGUILDER_USDPRICE } from "../globals";
import { fromWei, fromWeiToNumber, getContract, ITransaction, toWei } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";
import { IErc20Token } from "../helpers/tokens-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { FixedNumber } from "ethers";

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

    const kCurTotalSupply = await kCurContract.balanceOf(mentoReserveContract.address);

    const kCurTotalValue = fromWeiToNumber(
      FixedNumber.fromValue(kCurTotalSupply, 0, "fixed32x18")
        .mulUnsafe(FixedNumber.fromString(kCurPrice.toString(), "fixed32x18"))
        // .addUnsafe(FixedNumber.fromString("1", "fixed32x18")) // round up one wei
        .round(0)
        .toFormat("fixed32x0")
        .toString(),
      18,
    );

    const kGTotalSupply = await kGContract.totalSupply();

    /**
     * using the fixed price of kG
     */
    const kGTotalValue = fromWeiToNumber(
      FixedNumber.fromValue(kGTotalSupply, 0, "fixed32x18")
        .mulUnsafe(FixedNumber.fromString(KGUILDER_USDPRICE.toString(), "fixed32x18"))
        // .addUnsafe(FixedNumber.fromString("1", "fixed32x18")) // round up one wei
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
       * round up cause we don't want a fractional number of tokens, and rounding down wouldn't give us enough.
       */
      const amountOfKCur = toWei((kGTotalValue - kCurTotalValue) / kCurPrice, 18).add(1);
      const relayerBalance = await kCurContract.balanceOf(relayerAddress);

      if (relayerBalance.lt(amountOfKCur)) {
        throw new Error(
          `The Relayer has insufficient balance (${fromWei(
            relayerBalance,
            18,
          )}) to send to the MentoReserve (needs: ${fromWei(amountOfKCur, 18)})`,
        );
      }

      const tx: ITransaction = await kCurContract.transfer(mentoReserveContract.address, amountOfKCur);
      logMessage(serviceName, `Transferred ${fromWei(amountOfKCur, 18)} kCur to the MentoReserve, tx hash: ${tx.hash}`);
    } else if (kGTotalValue < kCurTotalValue) {
      /**
       * then need to decrease the balance of kCUR in the MentoReserve.
       * round up cause we don't want a fractional number of tokens, and rounding down wouldn't give us enough.
       */
      const amountOfKCur = toWei((kCurTotalValue - kGTotalValue) / kCurPrice, 18).add(1);
      const mentoExchangeAvailable = await mentoReserveContract.getUnfrozenBalance();

      if (mentoExchangeAvailable.lt(amountOfKCur)) {
        throw new Error(
          `The MentoExchange has insufficient balance (${fromWei(
            mentoExchangeAvailable,
            18,
          )}) to send to the Relayer (needs: ${fromWei(amountOfKCur, 18)})`,
        );
      }

      const tx: ITransaction = await mentoReserveContract.transferExchangeGold(relayerAddress, amountOfKCur);
      // eslint-disable-next-line prettier/prettier
      logMessage(serviceName, `Transferred ${fromWei(amountOfKCur, 18)} kCur from the MentoReserve, tx hash: ${tx.hash}`);
    } else {
      logMessage(serviceName, `No changes required, the numbers are balanced`);
    }
  } catch (ex) {
    serviceThrewException(serviceName, ex);
  }
};
