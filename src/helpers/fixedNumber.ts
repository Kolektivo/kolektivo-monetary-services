import { FixedNumber } from "ethers";

const ONE = FixedNumber.from(1, "fixed32x18");
const TWO = FixedNumber.from(2, "fixed32x18");

export const sqrt = (x: FixedNumber): FixedNumber => {
  let z = x.addUnsafe(ONE).divUnsafe(TWO);
  let y = x;
  while (z.subUnsafe(y).isNegative()) {
    y = z;
    z = x.divUnsafe(z).addUnsafe(z).divUnsafe(TWO);
  }
  return y.round(18);
};
