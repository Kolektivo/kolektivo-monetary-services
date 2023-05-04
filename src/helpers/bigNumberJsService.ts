import { fromWei } from "./contracts-helper";

import { BigNumber as BigNumberJs } from "bignumber.js";
import { BigNumber } from "ethers";

BigNumberJs.config({
  EXPONENTIAL_AT: [-100, 100],
  ROUNDING_MODE: BigNumberJs.ROUND_DOWN,
  DECIMAL_PLACES: 18,
});

export const toBigNumberJs = (n: string | number | BigNumber): BigNumberJs => new BigNumberJs(n.toString());
export default BigNumberJs;

export const bnFromWei = (value: BigNumberJs, decimals: number): string => {
  return fromWei(value.toString(), decimals);
};
