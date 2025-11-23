const { SignClient } = require("@walletconnect/sign-client");
// Feature flag to disable XLM WalletConnect handlers
if (process.env.ENABLE_XLM_EVENTS !== 'true') {
  console.log('[XLM] XLM events disabled (ENABLE_XLM_EVENTS != true)');
  module.exports = function() {};
  return;
}

const {
  TransactionBuilder,
  Operation,
  Asset,
  Keypair,
} = require("@stellar/stellar-sdk");
const db = require("../util/database.js");
const transactions = db.transactions;
const User = db.users;

const {
  SIGN_CLIENT_CONFIG,
  SIGN_CLIENT_CONNECT_CONFIG,
  getXLMBalances,
  NETWORK_URL,
  generateErrorText,
  calculatePercentage,
  BASE_FEE,
  signUsingWallet,
  NETWORK_PASSPHRASE,
  server,
  COMMISSION_ACCOUNT,
  handleOfferSaving,
  COMMISSION_ACC_KEYPAIR,
} = require("./xlmData");
const { default: axios } = require("axios");

const LimitOrders = db.xlm_limit_orders;

let sessions = {}; //we need session topic to saved in the db

module.exports = async (socket, userSocket) => {
  const walletConnectSignClient = await SignClient.init(SIGN_CLIENT_CONFIG);

  //when user delete session from mobile wallet emit to frontend immediately
  walletConnectSignClient.on("session_delete", (e) => {
    userSocket.emit("wallet_disconnect");
  });

  const onSessionConnected = async (session) => {
    const publicKey = session?.namespaces?.stellar?.accounts[0]?.slice(15);

    sessions[publicKey] = session.topic;
    await getXLMBalances(publicKey, userSocket);
  };

  // socket.on("xlm-qr-code", async () => {
  //   const { uri, approval } = await walletConnectSignClient.connect(
  //     SIGN_CLIENT_CONNECT_CONFIG
  //   );
  //   if (uri) userSocket.emit("qr-app-response", uri);
  //   try {
  //     const session = await approval();
  //     await onSessionConnected(session);
  //   } catch (error) {
  //     console.log("connect error", error);
  //     userSocket.emit(
  //       "connect-error",
  //       error.message ?? "Error in wallet connect."
  //     );
  //   }
  // });

  socket.on("xlm-qr-code", async () => {
    try {
      // Attempt to connect to WalletConnect
      const { uri, approval } = await walletConnectSignClient.connect(SIGN_CLIENT_CONNECT_CONFIG);
  
      if (uri) {
        userSocket.emit("qr-app-response", uri);
      }
  
      // Create a promise that resolves safely even on timeout
      const approvalWithTimeout = new Promise(async (resolve) => {
        const approvalTimeout = setTimeout(() => {
          console.warn("QR code approval timeout occurred.");
          resolve({ error: "QR code approval timeout. Please try again." }); // Resolve with error message
        }, 300000); // 5 minutes timeout
  
        try {
          const session = await approval();
          clearTimeout(approvalTimeout);
          resolve(session); // Successfully received session
        } catch (err) {
          clearTimeout(approvalTimeout);
          console.error("Session approval failed:", err.message);
          resolve({ error: err.message }); // Resolve with error message instead of throwing
        }
      });
  
      const session = await approvalWithTimeout;
  
      // Check if session contains an error message
      if (session?.error) {
        console.log("Approval failed:", session.error);
        userSocket.emit("connect-error", session.error);
        return; // Exit safely
      }
  
      await onSessionConnected(session);
    } catch (error) {
      console.error("Connect error:", error);
  
      // Handle different error cases properly
      if (error.message.includes("Request expired")) {
        userSocket.emit("connect-error", "Request expired. Please try again.");
      } else if (error.message.includes("Proposal expired")) {
        userSocket.emit("connect-error", "Proposal expired. Please try scanning the QR code again.");
      } else {
        userSocket.emit("connect-error", "Error in wallet connect.");
      }
    }
  });
  
  // Catch unhandled promise rejections globally
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
  });
  
   // Handle uncaught exceptions globally
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

  socket.on("xlm-payment-request", async (args) => {
    console.log("args====>", args); 
    const {
      offerType,
      side,
      buyCurrency,
      sellCurrency,
      buyIssuer,
      sellIssuer,
      userToken,
      secretKey,
    } = args; 

    try {
      let userKeypair = "";
      if (secretKey) userKeypair = Keypair.fromSecret(secretKey);

      let sellingAsset = null;
      let buyingAsset = null;
      const type = side?.toLowerCase();

      const account = await server.loadAccount(userToken);


      switch (type) {
        case "buy":

          sellingAsset = new Asset.native();
          buyingAsset = new Asset(buyCurrency, buyIssuer);


 
          if (
            !account.balances.find(
              (balance) =>
                balance.asset_code === buyingAsset.code &&
                balance.asset_issuer === buyingAsset.issuer
            )
          ) {
            console.log();
            const trustAsetsTxn = new TransactionBuilder(account, {
              fee: BASE_FEE,
              networkPassphrase: NETWORK_PASSPHRASE,
            })
              .addOperation(
                Operation.changeTrust({
                  asset: buyingAsset,
                })
              )
              .setTimeout(30)
              .build();

            if (signUsingWallet) {
              await signAndSubmitTxn({
                txn: trustAsetsTxn,
                client: walletConnectSignClient,
                userSocket,
                userToken,
                acknowledge: false,
              });
            } else {
              trustAsetsTxn.sign(userKeypair);

              await server.submitTransaction(trustAsetsTxn);
            }
          }

          break;

        case "sell":
          console.log('sell', account);
          buyingAsset = new Asset.native();
          sellingAsset = new Asset(sellCurrency, sellIssuer);
          //check if we have trustline for the buying assets if not create trustline
          if (
            !account.balances.find(
              (balance) =>
                balance.asset_code === sellingAsset.code &&
                balance.asset_issuer === sellingAsset.issuer
            )
          ) {
            const trustAsetsTxn = new TransactionBuilder(account, {
              fee: BASE_FEE,
              networkPassphrase: NETWORK_PASSPHRASE,
            })
              .addOperation(
                Operation.changeTrust({
                  asset: sellingAsset,
                })
              )
              .setTimeout(30)
              .build();

            if (signUsingWallet) {
              await signAndSubmitTxn({
                txn: trustAsetsTxn,
                client: walletConnectSignClient,
                userSocket,
                userToken,
                acknowledge: false,
              });
            } else {
              trustAsetsTxn.sign(userKeypair);
              await server.submitTransaction(trustAsetsTxn);
            }
          }
          break;
      }

      switch (offerType.toLowerCase()) {
        case "limit": 
          handleLimitOrder({
            args,
            userSocket,
            type,
            buyingAsset,
            sellingAsset,
            account,
            signClient: walletConnectSignClient,
            userKeypair,
          });
          break;

        case "market":
          console.log('market', account);
          handleMarketOrder({
            args,
            userSocket,
            type,
            buyingAsset,
            sellingAsset,
            account,
            signClient: walletConnectSignClient,
            userKeypair,
          });
          break;
      }
    } catch (error) {
      console.log("xlm-payment-request:error", error);
      userSocket.emit("transaction-error", generateErrorText(error));
    }
  });

  socket.on("xlm-delete-offers", async (args) => {
    try {
      const { userToken, tx_id, offerType, secretKey } = args;
      let deleteOffersKeypair = null;
      if (secretKey) deleteOffersKeypair = Keypair.fromSecret(secretKey);

      const userOffer = await server.offers().offer(tx_id).call();
      const account = await server.loadAccount(userToken);

      const OfferInDb = await LimitOrders.findOne({
        where: {
          txnId: userOffer.id,
        },
        raw: true,
      });

      let finalTransaction = null;

      if (offerType === "ManageBuyOffer") {
        finalTransaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            Operation.manageBuyOffer({
              offerId: parseInt(tx_id),
              selling: new Asset(
                userOffer.selling.asset_code,
                userOffer.selling.asset_issuer
              ),
              buying: new Asset.native(),
              buyAmount: "0",
              price: "1",
            })
          )
          .setTimeout(0)
          .build();
      } else {
        finalTransaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            Operation.manageSellOffer({
              offerId: parseInt(tx_id),
              buying: new Asset(
                userOffer.buying.asset_code,
                userOffer.buying.asset_issuer
              ),
              selling: new Asset.native(),
              amount: "0",
              price: "1",
            })
          )
          .setTimeout(0)
          .build();
      }

      let resp = {};

      if (signUsingWallet) {
        const payload = {
          id: 1,
          jsonrpc: "2.0",
          method: "stellar_signAndSubmitXDR",
          params: {
            xdr: finalTransaction.toXDR(),
          },
        };

        resp = await walletConnectSignClient.request({
          topic: sessions[userToken],
          request: payload,
          chainId: "stellar:pubnet",
        });
      } else {
        finalTransaction.sign(deleteOffersKeypair);
        resp = await server.submitTransaction(finalTransaction);
      }

      //offer is delete now we have to return the user fee.
      if (OfferInDb) {
        try {
          const COMMISSION_ACC = await server.loadAccount(COMMISSION_ACCOUNT);

          const refundTxn = new TransactionBuilder(COMMISSION_ACC, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(
              Operation.payment({
                amount: OfferInDb.fee,
                asset: new Asset.native(),
                destination: userToken,
              })
            )
            .setTimeout(3600)
            .build();

          refundTxn.sign(COMMISSION_ACC_KEYPAIR);
          const resp = await server.submitTransaction(refundTxn);
        } catch (error) {
          console.log(
            "error when refunding transaction",
            error?.response?.data?.extras
          );
        }
      }

      userSocket.emit("delete-offers-response", {
        ...resp,
        success: true,
        message: "offers removed successfully",
      });
    } catch (error) {
      console.log("xlm-delete-offers:error", error?.response?.data?.extras);
      userSocket.emit("delete-offers-response", {
        success: false,
        message: error?.message ?? error,
      });
    }
  });

  socket.on("xlm-get-all-user-currencies", async (args) => {
    try {
      const { userToken } = args;
      const account = await server.loadAccount(userToken);

      const accountCurrencies = [];
      let mainBala = "0";

      account.balances.forEach((bal) => {
        if (bal.asset_type === "native") mainBala = bal.balance;
        else
          accountCurrencies.push({
            issuer_address: bal.asset_issuer,
            balance: bal.balance,
            currency: bal.asset_code,
          });
      });

      const balanceData = {
        mainBala,
        account: userToken,
      };

      // Construct the final response data
      const accountData = {
        success: true,
        accountCurrencies,
        currencyList: [
          {
            balance: balanceData,
            currency: "XLM",
            issuer_address: null,
          },
        ],
      };

      // Emit the response
      userSocket.emit("get-all-user-currencies-response", accountData);
    } catch (err) {
      // Emit the error
      userSocket.emit("get-all-user-currencies-error", err);
    }
  });

  socket.on("xlm-swap-request", async (args) => {
    console.log("xlm-swap-request args====>", args);

    const {
      fromCurrency,
      toCurrency,
      toIssuer,
      sourceAmount,
      fromIssuer = "",
      userToken,
      destAmount,
      secretKey,
    } = args;

    try {
      let xlmSwapKeypair = null;
      if (secretKey) xlmSwapKeypair = Keypair.fromSecret(secretKey);

      let sellingAsset = null;
      let buyingAsset = null;
      let buyIsNative = false;

      const account = await server.loadAccount(userToken);

      if (fromCurrency === "XLM") {
        buyIsNative = true;
        sellingAsset = new Asset.native();
        buyingAsset = new Asset(toCurrency, toIssuer);

        if (
          !account.balances.find(
            (balance) =>
              balance.asset_code === buyingAsset.code &&
              balance.asset_issuer === buyingAsset.issuer
          )
        ) {
          //if there is no existing trust add it
          const trustAsetsTxn = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(
              Operation.changeTrust({
                asset: buyingAsset,
              })
            )
            .setTimeout(30)
            .build();

          if (signUsingWallet) {
            await signAndSubmitTxn({
              txn: trustAsetsTxn,
              client: walletConnectSignClient,
              userSocket,
              userToken,
              acknowledge: false,
            });
          } else {
            trustAsetsTxn.sign(xlmSwapKeypair);
            await server.submitTransaction(trustAsetsTxn);
          }
        }
      } else if (toCurrency === "XLM") {
        sellingAsset = new Asset(fromCurrency, fromIssuer);
        buyingAsset = new Asset.native();
      } else {
        sellingAsset = new Asset(fromCurrency, fromIssuer);
        buyingAsset = new Asset(toCurrency, toIssuer);

        if (
          !account.balances.find(
            (balance) =>
              balance.asset_code === sellingAsset.code &&
              balance.asset_issuer === sellingAsset.issuer
          )
        ) {
          //if there is no existing trust add it
          const trustAsetsTxn = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(
              Operation.changeTrust({
                asset: sellingAsset,
              })
            )
            .setTimeout(30)
            .build();

          if (signUsingWallet) {
            await signAndSubmitTxn({
              txn: trustAsetsTxn,
              client: walletConnectSignClient,
              userSocket,
              userToken,
              acknowledge: false,
            });
          } else {
            trustAsetsTxn.sign(xlmSwapKeypair);
            await server.submitTransaction(trustAsetsTxn);
          }
        }

        if (
          !account.balances.find(
            (balance) =>
              balance.asset_code === buyingAsset.code &&
              balance.asset_issuer === buyingAsset.issuer
          )
        ) {
          //if there is no existing trust add it
          const trustAsetsTxn = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(
              Operation.changeTrust({
                asset: buyingAsset,
              })
            )
            .setTimeout(30)
            .build();

          if (signUsingWallet) {
            await signAndSubmitTxn({
              txn: trustAsetsTxn,
              client: walletConnectSignClient,
              userSocket,
              userToken,
              acknowledge: false,
            });
          } else {
            trustAsetsTxn.sign(xlmSwapKeypair);
            await server.submitTransaction(trustAsetsTxn);
          }
        }
      }

      handleMarketOrder({
        args: {
          sellValue: sourceAmount,
          buyValue: destAmount,
          userToken,
          sellCurrency: fromCurrency,
          sellIssuer: fromIssuer,
          buyCurrency: toCurrency,
          buyIssuer: toIssuer,
        },
        userSocket,
        type: buyIsNative ? "buy" : "sell",
        buyingAsset,
        sellingAsset,
        account,
        signClient: walletConnectSignClient,
        userKeypair: xlmSwapKeypair,
        isSwaping: true,
      });
    } catch (error) {
      console.log("xlm-swap-request:error", error);
    }
  });

  socket.on("xlm-fetch-wallet", async (userToken) => {
    console.log("xlm-fetch-wallet:userToken: ", userToken);
    await getXLMBalances(userToken, userSocket, "wallet-updated");
  });
};

const handleLimitOrder = async ({
  args,
  userSocket,
  sellingAsset,
  buyingAsset,
  type,
  account,
  signClient,
  userKeypair,
}) => {
  const { buyValue, sellValue, currPrice, userToken } = args;
 
  if (type === "buy") {
    const commissionFee = calculatePercentage(sellValue, 0.25);
    try {
      //now create the sell offer and submit
      const sellOfferTxn = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          Operation.manageSellOffer({
            selling: sellingAsset,
            buying: buyingAsset,
            amount: sellValue,
            price: currPrice,
            offerId: 0,
          })
        )
        .addOperation(
          Operation.payment({
            amount: commissionFee,
            destination: COMMISSION_ACCOUNT,
            asset: new Asset.native(),
          })
        )
        .setTimeout(3600) //This is allowed time to sign and submit the txn to ledger.
        .build();
        if (signUsingWallet) {
        console.log('limitttttttttttttttttttttttttttttttttttttttttttttttt',args);
        signAndSubmitTxn({
          args:args,
          txn: sellOfferTxn,
          client: signClient,
          userSocket,
          userToken,
          commissionFee,
        });
      } else {
        sellOfferTxn.sign(userKeypair);
        const resp = await server.submitTransaction(sellOfferTxn);

        if (resp && resp.successful) {
          await handleOfferSaving(userToken, commissionFee);
          userSocket.emit("payment-response-xlm", resp);
        }
      }
    } catch (error) {
      console.log("handleLimitOrder.buy.error", error);
      userSocket.emit("transaction-error", error?.message);
    }
  } else if (type === "sell") {
    const commissionFee = calculatePercentage(buyValue, 0.25);

    try {
      //now create the sell offer and submit
      const buyOfferTxn = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          Operation.manageBuyOffer({
            selling: sellingAsset,
            buying: buyingAsset,
            buyAmount: buyValue,
            price: currPrice,
            offerId: 0,
          })
        )
        .addOperation(
          Operation.payment({
            amount: commissionFee,
            destination: COMMISSION_ACCOUNT,
            asset: new Asset.native(),
          })
        )
        .setTimeout(120) //This is allowed time to sign and submit the txn to ledger.
        .build();

      if (signUsingWallet) {
        signAndSubmitTxn({
          args:args,
          txn: buyOfferTxn,
          client: signClient,
          userSocket,
          userToken,
          commissionFee,
        });
      } else {
        buyOfferTxn.sign(userKeypair);
        const resp = await server.submitTransaction(buyOfferTxn);
        if (resp && resp.successful) {
          await handleOfferSaving(userToken, commissionFee);
          userSocket.emit("payment-response-xlm", resp);
        }
      }
    } catch (error) {
      console.log("handleLimitOrder.sell.error", error);

      userSocket.emit("transaction-error", error?.message);
    }
  }
};

const handleMarketOrder = async ({
  args,
  userSocket,
  type,
  buyingAsset,
  sellingAsset,
  account,
  signClient,
  userKeypair,
  isSwaping = false,
}) => {
  const {
    sellValue,
    buyValue,
    userToken,
    buyIssuer,
    sellIssuer,
    buyCurrency,
    sellCurrency,
  } = args;

  const commisionPercentage = isSwaping ? 1 : 0.25;

  if (type === "buy") {
    try {
      //check for the paths exist to make the payment
      const url = `${NETWORK_URL}/paths/strict-receive?source_assets=native&destination_asset_type=credit_alphanum4&destination_asset_issuer=${buyIssuer}&destination_asset_code=${buyCurrency}&destination_amount=${buyValue}`;
      const resp = await axios.get(url);

      //if the possible paths are available then proceed to sign and submit
      if (resp && resp?.data?._embedded?.records.length) {
        const record = resp.data._embedded.records[0];

        const assetPath = record.path.map(
          (pt) => new Asset(pt.asset_code, pt.asset_issuer)
        );

        const txn = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            Operation.pathPaymentStrictReceive({
              sendAsset: sellingAsset,
              sendMax: sellValue,
              source: userToken,
              destination: userToken,
              destAsset: buyingAsset,
              destAmount: record.destination_amount,
              path: record.path.length ? assetPath : [],
            })
          )
          .addOperation(
            Operation.payment({
              amount: calculatePercentage(
                record.source_amount,
                commisionPercentage
              ),
              destination: COMMISSION_ACCOUNT,
              asset: new Asset.native(),
            })
          )
          .setTimeout(0)
          .build();

        if (signUsingWallet) {
          await signAndSubmitTxn({
            txn,
            client: signClient,
            userSocket,
            userToken,
          });
        } else {
          txn.sign(userKeypair);

          const resp = await server.submitTransaction(txn);

          if (resp && resp.successful)
            userSocket.emit("payment-response-xlm", resp);
        }
      } else {
        //If we doesn't find any path return with error
        userSocket.emit(
          "transaction-error",
          "No available path to complete this transaction. Please try again later"
        );
      }
    } catch (error) {
      console.log(
        "handleMarketOrder.buy.error::",
        error?.response?.data?.extras
      );
      userSocket.emit("transaction-error", generateErrorText(error));
    }
  } else if (type === "sell") {
    try {
      //check for the paths exist to make the payment
      const url = `${NETWORK_URL}/paths/strict-send?destination_assets=native&source_asset_type=credit_alphanum4&source_asset_issuer=${sellIssuer}&source_asset_code=${sellCurrency}&source_amount=${sellValue}`;
      const resp = await axios.get(url);

      //if the possible paths are available then proceed to sign and submit
      if (resp && resp?.data?._embedded?.records.length) {
        const record = resp.data._embedded.records[0];

        const assetPath = record.path.map(
          (pt) => new Asset(pt.asset_code, pt.asset_issuer)
        );

        const txn = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            Operation.pathPaymentStrictSend({
              sendAsset: sellingAsset,
              sendAmount: record.source_amount,
              destination: userToken,
              destAsset: buyingAsset,
              destMin: record.destination_amount,
              path: record.path.length ? assetPath : [],
            })
          )
          .addOperation(
            Operation.payment({
              amount: calculatePercentage(
                record.destination_amount,
                commisionPercentage
              ),
              destination: COMMISSION_ACCOUNT,
              asset: new Asset.native(),
            })
          )
          .setTimeout(0)
          .build();

        if (signUsingWallet) {
          await signAndSubmitTxn({
            txn,
            client: signClient,
            userSocket,
            userToken,
          });
        } else {
          txn.sign(userKeypair);
          const resp = await server.submitTransaction(txn);
          if (resp && resp.successful)
            userSocket.emit("payment-response-xlm", resp);
        }
      } else {
        //If we doesn't find any path return with error
        userSocket.emit(
          "transaction-error",
          "No available path to complete this transaction. Please try again later"
        );
      }
    } catch (error) {
      console.log(
        "handleMarketOrder.sell.error::",
        error?.response?.data?.extras?.result_codes
      );
      userSocket.emit("transaction-error", generateErrorText(error));
    }
  }

  await getXLMBalances(userToken, userSocket, "wallet-updated");
};

const signAndSubmitTxn = async ({
  args,
  txn, 
  client,
  userSocket,
  userToken,
  acknowledge = true,
  socketEvent = "payment-response-xlm",
  errorEvent = "transaction-error",
  commissionFee,
}) => {
  try {
    const payload = {
      id: 1,
      jsonrpc: "2.0",
      method: "stellar_signAndSubmitXDR",
      params: {
        xdr: txn.toXDR(),
      },
    };
// console.log('args++++++++++++++++++++++++++++++++++++==',args);
    const users = await User.findAll(); // Wait for the users array
    console.log('taxation', txn.operations);
    let finalPayload = txn?.operations?.filter(item => item.type === "manageSellOffer" || item.type === "manageBuyOffer").map((item) => ({
      seller: item?.selling?.issuer || null,
      buyer: item?.buying?.issuer || null,
      orderType: args?.offerType,
      from: item?.selling?.code || null,
      to: item?.buying?.code || null,
      price: item?.price || null,
      amount: item?.amount || item?.buyAmount|| null,
      total: (parseFloat(item?.amount) || parseFloat(item?.buyAmount) || 0) * (parseFloat(item?.price) || 0),
      nft_id: null,
      // provider: users?.find(data => 
      //   data.wallet_address === item?.selling?.issuer || data.wallet_address === item?.buying?.issuer
      // )?.provider || null, 
    }));

    if (finalPayload.length) {

    console.log("finalPayload----------------------------------", finalPayload);
      addTransactionsData(finalPayload) 
    }

    console.log("payload", sessions[userToken]);
    await client.extend({ topic: sessions[userToken] });

    const resp = await client.request({
      topic: sessions[userToken],
      request: payload,
      chainId: "stellar:pubnet",
    });

    if (resp && resp.status === "success" && acknowledge) {
      if (commissionFee) await handleOfferSaving(userToken, commissionFee);

      userSocket.emit(socketEvent, resp);
    }
  } catch (error) {
    console.log("signAndSubmitTxn:Error===>", error);
    if (acknowledge) {
      userSocket.emit(errorEvent, error?.message ?? error);
    }
  }
};



const addTransactionsData = async (payloadArray) => {
  if (!Array.isArray(payloadArray) || payloadArray.length === 0) {
    console.error("Invalid or empty payload array.");
    return;
  }

  try {
    for (const payload of payloadArray) {
      const { seller, buyer, orderType, from, to, nft_id, price, amount, total } = payload; 

      // Save each transaction
      await transactions.create({
        seller,
        buyer,
        orderType,
        from,
        to,
        price,
        amount,
        total,
        nft_id,
        viewDetails: "", // Add a meaningful value if required
      });
    }
    console.log("All transactions added successfully.");
  } catch (error) {
    console.error("Error adding transactions:", error);
  }
};
