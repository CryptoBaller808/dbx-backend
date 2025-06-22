const { Horizon,Server, Networks, Keypair } = require("@stellar/stellar-sdk");

const isDev = process.env.ENV_TYPE === "development";
const BASE_FEE = "1000000";
const NETWORK_PASSPHRASE = isDev ? Networks.TESTNET : Networks.PUBLIC;
const COMMISSION_ACCOUNT = process.env.COMMISSION_ACCOUNT_PUB_KEY;
const COMMISSION_ACCOUNT_SECRET = process.env.COMMISSION_ACCOUNT_SEC_KEY;
const db = require("../util/database.js");
const LimitOrders = db.xlm_limit_orders;

const COMMISSION_ACC_KEYPAIR = COMMISSION_ACCOUNT_SECRET && Keypair.fromSecret(COMMISSION_ACCOUNT_SECRET);
 
const NETWORK_URL = isDev
  ? process.env.XLM_TESTNET
  : process.env.XLM_PUBNET_BASE_URL;

const signUsingWallet = process.env.WALLET_SIGN === "true";
 
const server = new Horizon.Server(NETWORK_URL); 


const SIGN_CLIENT_CONFIG = {
  projectId: process.env.WALLET_CONNECT_PID,
  metadata: {
    name: process.env.APP_NAME,
    description:
      "Digital Block Exchange uses blockchain and new technologies to allow all users to access fair financial services",
    url: process.env.WEB_URL,
    icons: [process.env.APP_ICON],
  },
};

// const SIGN_CLIENT_CONNECT_CONFIG = {
//   requiredNamespaces: {
//     stellar: {
//       chains: ["stellar:testnet", "stellar:pubnet"],
//       methods: ["stellar_signAndSubmitXDR", "stellar_signXDR"],
//       events: [],
//     },
//   },
// };

// eip155: {
//   methods: ["stellar_signAndSubmitXDR"],
//   chains: ["eip155:1"],
//   events: ["connect", "disconnect"],
// },

const SIGN_CLIENT_CONNECT_CONFIG = {
  requiredNamespaces: {
    stellar: {
      chains: ["stellar:pubnet"],
      methods: ["stellar_signAndSubmitXDR", "stellar_signXDR"],
      events: ["connect", "disconnect"],
    },
  },
};

const getXLMBalances = async (
  publicKey,
  userSocket,
  event = "account-response"
) => {
  if (publicKey) {
    try {
      const account = await server.loadAccount(publicKey);
      accountData = {
        account: account.balances[account.balances.length - 1].balance,
        userToken: publicKey,
        success: true,
        currencies: account.balances,
      };
      userSocket.emit(event, accountData);
      // userSocket.emit("account-response", accountData);
    } catch (error) {
      console.log("getXLMBalances:error", error);
      userSocket.emit("connect-error", error);
    }
  }
};

const generateErrorText = (error) => {
  if (error?.response && error.response?.data && error.response.data?.extras) {
    const transactionResultCodes =
      error.response.data.extras?.result_codes?.operations ?? [];

    if (transactionResultCodes[0]) {
      const transactionResult = transactionResultCodes[0];

      if (transactionResult === "tx_bad_seq") {
        return "Transaction failed: Bad sequence number";
      } else if (transactionResult === "tx_insufficient_balance") {
        return "Transaction failed: Insufficient balance";
      } else if (transactionResult === "op_too_few_offers") {
        return "Transaction failed: No path found for the trade.";
      } else {
        return "Transaction failed: Unknown reason";
      }
    }
  } else {
    return "Error submitting transaction:";
  }
};

function calculatePercentage(amountStr, percentage) {
  const amount = parseFloat(amountStr);
  if (isNaN(amount)) {
    return 0;
  }

  const result = (amount * percentage) / 100;
  const roundedResult = result.toFixed(7);

  if (roundedResult === "0.0000000") return "0.0000001";

  return roundedResult;
}

const handleOfferSaving = async (userToken, commissionFee) => {
  try {
    const offers = (
      await server.offers().forAccount(userToken).order("desc").call()
    ).records;

    if (offers && offers.length) {
      const latestOffer = offers[0];
      return await LimitOrders.create({
        walletAddress: userToken,
        txnId: latestOffer.id,
        fee: commissionFee,
        status: "Created",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    console.log("handleOfferSaving:error", error);
  }
};

module.exports = {
  SIGN_CLIENT_CONFIG,
  SIGN_CLIENT_CONNECT_CONFIG,
  getXLMBalances,
  NETWORK_URL,
  isDev,
  generateErrorText,
  calculatePercentage,
  BASE_FEE,
  signUsingWallet,
  NETWORK_PASSPHRASE,
  server,
  COMMISSION_ACCOUNT,
  handleOfferSaving,
  COMMISSION_ACC_KEYPAIR,
};
