import { logMessage } from "./errors-helper";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require("axios");

export const getTokenGeckoPrice = (geckoTokenId: string, coinGeckoApiKey: string): Promise<number> => {
  logMessage("coingecko-service", `fetching from CoinGecko: ${geckoTokenId}`);

  // const geckoTokenId = `${tokenName.toLowerCase()}-${tokenSymbol.toLowerCase()}`;

  const uri = `https://pro-api.coingecko.com/api/v3/coins/${geckoTokenId}?market_data=true&localization=false&community_data=false&developer_data=false&sparkline=false&x_cg_pro_api_key=${coinGeckoApiKey}`;

  return (
    axios
      .get(uri)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((response: any) => {
        return response.data.market_data.current_price.usd ?? 0;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((ex: any) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`price not found for token: ${geckoTokenId}, ex: ${ex.message}`);
      })
  );

  return Promise.resolve(1.0);
};
