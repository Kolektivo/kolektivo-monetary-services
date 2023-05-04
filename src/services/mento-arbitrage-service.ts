import { ITransaction, KGUILDER_USDPRICE } from "../globals";
import BigNumberJs, { toBigNumberJs } from "../helpers/bigNumberJsService";
import { fromWei, getContract } from "../helpers/contracts-helper";
import { logMessage, serviceThrewException } from "../helpers/errors-helper";
import { IErc20Token } from "../helpers/tokens-helper";

import { DefenderRelaySigner } from "defender-relay-client/lib/ethers/signer";
import { BigNumber } from "ethers";

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

    // eslint-disable-next-line prettier/prettier
    const kCurTotalValue = BigNumber.from(toBigNumberJs((await kCurContract.balanceOf(mentoReserveContract.address))).times(kCurPrice).integerValue(BigNumberJs.ROUND_CEIL).toString()); // round up one wei;
    /**
     * using the fixed price of kG
     */
    // eslint-disable-next-line prettier/prettier
    const kGTotalValue = BigNumber.from(toBigNumberJs((await kGContract.totalSupply())).times(KGUILDER_USDPRICE).integerValue(BigNumberJs.ROUND_CEIL).toString()); // round up one wei

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
