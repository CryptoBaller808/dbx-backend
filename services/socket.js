// import xumm from "../services/xumm";
// import xrplHelper from "../services/xrpl";
// const xrpl = require("xrpl");
// import AccountOffers from "../model/AccountOffers";

xumm = require("../services/xumm.js");
xrplHelper = require("../services/xrpl.js");
const xrpl = require("xrpl");
const { DATE } = require("sequelize");
const db = require("../util/database.js");
const account_offers = db.account_offers; // SQL Database
const User = db.users;

const xlmEvents = require("./xlmEvents.js");

const { TxData } = require("xrpl-txdata");
const Verify = new TxData();

const socketInit = async (io) => {
  io.on("connection", (socket) => {
    console.log("connected to socket with id==", socket.id);

    const userSocket = io.to(socket.id);

    // Initialize XLM WalletConnect handlers if enabled
    if (process.env.ENABLE_XLM_EVENTS === 'true') {
      xlmEvents(socket, userSocket);
    } else {
      console.log('[XLM] Skipping Stellar WalletConnect handlers');
    }

    socket.on("connect_error", (err) => {
      console.log(`connect_error due to ${err.message}`);
    });

    socket.on("xumm-qr-code", async () => {
      const rejectResponse = {
        success: false,
        message: "Rejected",
      };
      try {
        const request = {
          txjson: {
            TransactionType: "SignIn",
          },
        };

        const subscription = await xumm.payload.createAndSubscribe(
          request,
          (e) => {
            if (Object.keys(e.data).indexOf("signed") > -1) {
              return e.data;
            }
          }
        );

        const QR_Code = subscription.created.refs.qr_png;

        userSocket.emit("qr-response", QR_Code);

        const noPushMsgReceivedUrl = `https://xumm.app/sign/${subscription.created.uuid}/qr`;

        userSocket.emit("qr-app-response", noPushMsgReceivedUrl);
        const resolveData = await subscription.resolved;

        if (resolveData.signed == false) {
          userSocket.emit("account-response", rejectResponse);
        } else {
          const response = await xumm.payload.get(resolveData.payload_uuidv4);
          const accountNo = response.response.account;
          const accountData = await xrplHelper.getBalance(accountNo);
          accountData.success = true;
          accountData.userToken = response.application.issued_user_token;
          userSocket.emit("account-response", accountData);
        }
      } catch (error) {
        userSocket.emit("account-response", rejectResponse);
      }
    });

    socket.on("get-account-balance", async (args) => {
      const accountNo = args.accountNo;

      const accountData = await xrplHelper.getBalance(accountNo);

      accountData.success = true;
      accountData.userToken = args.userToken;

      userSocket.emit("account-response", accountData);
    });

    // GET All user currencies
    socket.on("get-all-user-currencies", async (args) => {
      try {
        // Get all user currencies
        const accountCurrencies = await xrplHelper.getAllCurrencies(
          args.accountInfo
        );

        // Get balance for the user
        const balanceData = await xrplHelper.getBalance(args.accountInfo);

        // Construct the final response data
        const accountData = {
          success: true,
          accountCurrencies,
          currencyList: [
            {
              balance: balanceData,
              currency: "XRP",
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

    // Get all assets balances

    // socket.on("get-allassets-balance", async (args) => {
    //   const accountNo = args.accountNo;

    //   const accountData = await xrplHelper.getAvailableLines(accountNo);

    //   accountData.success = true;
    //   accountData.userToken = args.userToken;

    //   userSocket.emit("allassets-response", accountData);
    // });

    // socket.on("get-tx-info", (args) => {
    // 	destination = args.destination;
    // 	amount = args.amount;
    // });

    // To get available swap path
    // socket.on("get-available-swap-path", async (args) => {

    //   console.log("this is form AVAlaile swap path");
    //   const data = args;
    //   console.log(args);
    //    await xrplHelper.getAvailableLines(data);
    //   const accountData = await xrplHelper.getAvailableSwapPath(args);

    //   accountData.success = true;
    //   accountData.userToken = args.userToken;

    //   userSocket.emit("available-path", accountData);
    // });

    socket.on("get-available-swap-path", async (args) => {
      const data = args;
      try {
        await xrplHelper.getAvailableLines(data);
        const accountData = await xrplHelper.getAvailableSwapPath(args);
        accountData.success = true;
        accountData.userToken = args.userToken;
        userSocket.emit("available-path", accountData);
      } catch (err) {
        userSocket.emit("available-path-error", err); // emit the error to the socket
      }
    });

    // SWAP payment via XUMM

    socket.on("xumm-payment", async (args) => {
      try {
        const data = args;
        const userToken = args.userToken;
        //   const availableLines = await xrplHelper.getAvailableLines(args)

        // if (!availableLines.length) {
        // 	const rejectResponse = {
        // 		success: false,
        // 		message: availableLines.message,
        // 	};

        //   console.log("after avaiula lines");

        // 	socket.emit("swap-payment-response", rejectResponse);
        // }
        // else {
        const { sendMax, receivingAmount } = data;

        console.log(args);

        const xPayment = {
          TransactionType: "Payment",
          Account: data.account,
          Amount: data.receivingAmount,
          Destination: data.destination,
          SendMax: data.sendMax,
        };

        if (sendMax?.currency === "XRP") {
          xPayment["SendMax"] = xrpl.xrpToDrops(sendMax.value);
        } else {
          if (sendMax?.value) {
            xPayment["SendMax"]["value"] = sendMax.value;
          }
          if (sendMax?.currency) {
            xPayment["SendMax"]["currency"] = sendMax.currency;
          }
          if (sendMax?.issuer) {
            xPayment["SendMax"]["issuer"] = sendMax.issuer;
          }
        }
        if (receivingAmount.currency === "XRP") {
          xPayment["Amount"] = xrpl.xrpToDrops(receivingAmount.value);
        } else {
          if (receivingAmount.value) {
            xPayment["Amount"]["value"] = receivingAmount.value;
          }
          if (receivingAmount.currency) {
            xPayment["Amount"]["currency"] = receivingAmount.currency;
          }
          if (receivingAmount.issuer) {
            xPayment["Amount"]["issuer"] = receivingAmount.issuer;
          }
        }

        const request = {
          txjson: xPayment,
          user_token: userToken,
        };

        const subscription = await xumm.payload.createAndSubscribe(
          request,
          (e) => {
            if (Object.keys(e.data).indexOf("signed") > -1) {
              return e.data;
            }
          }
        );

        const resolveData = await subscription.resolved;

        if (resolveData.signed == false) {
          const rejectResponse = {
            success: false,
            message: "Rejected",
          };

          socket.emit("swap-payment-response", rejectResponse);
        } else {
          const response = await xumm.payload.get(resolveData.payload_uuidv4);

          if (
            response.response.dispatched_result === "tecPATH_DRY" ||
            response.response.dispatched_result === "tecPATH_PARTIAL"
          ) {
            const rejectResponse = {
              success: false,
              message:
                "The transaction failed due to not enough liquidity for the pair on XRP Decentralized Exchange",
              data: response.response,
            };
            socket.emit("swap-payment-response", rejectResponse);
          } else {
            if (response.response.dispatched_result === "tesSUCCESS") {
              // check ID from Ledger first
              // const verifiedResult = await Verify.getOne(response.response.txid)

              // if (verifiedResult.status !== "error") {
              const resolveResponse = {
                success: true,
                message: "Swap has been successful",
                data: response.response,
              };
              socket.emit("swap-payment-response", resolveResponse);
              //}
              // else {
              // 	// TODO: return the error data
              // 	const rejectResponse = {
              // 		success: false,
              // 		message: verifiedResult.error_message,
              // 		data: verifiedResult
              // 	};
              // 	socket.emit("swap-payment-response", rejectResponse);
              // }
            } else {
              // TODO: return the error data
              const rejectResponse = {
                success: false,
                message: "Payment not succeeded",
                data: response.response,
              };
              socket.emit("swap-payment-response", rejectResponse);
            }
          }
        }
      } catch (error) {
        const rejectResponse = {
          success: false,
          message: error.message,
        };
        userSocket.emit("swap-payment-response", rejectResponse);
      }
    });

    //   socket.on("xumm-payment", async (args) => {
    //     try {
    //       const data = args;
    //       console.log("this is form PATH Paymenr path");

    //       console.log(args);

    //  //   await xrplHelper.getAvailableLines(data);

    //       /* 3. Prepare Transaction */

    //       const { sendMax, receivingAmount } = data;

    //       const xPayment = {
    //         TransactionType: "Payment",
    //         Account: data.account,
    //         Amount: data.receivingAmount,
    //         Destination: data.destination,
    //         SendMax: data.sendMax,
    //       };

    //       if (sendMax?.currency === "XRP") {
    //         xPayment["SendMax"] = xrpl.xrpToDrops(sendMax.value);
    //       } else {
    //         if (sendMax?.value) {
    //           xPayment["SendMax"]["value"] = sendMax.value;
    //         }
    //         if (sendMax?.currency) {
    //           xPayment["SendMax"]["currency"] = sendMax.currency;
    //         }
    //         if (sendMax?.issuer) {
    //           xPayment["SendMax"]["issuer"] = sendMax.issuer;
    //         }
    //       }
    //       if (receivingAmount.currency === "XRP") {
    //         xPayment["Amount"] = xrpl.xrpToDrops(receivingAmount.value);
    //       } else {
    //         if (receivingAmount.value) {
    //           xPayment["Amount"]["value"] = receivingAmount.value;
    //         }
    //         if (receivingAmount.currency) {
    //           xPayment["Amount"]["currency"] = receivingAmount.currency;
    //         }
    //         if (receivingAmount.issuer) {
    //           xPayment["Amount"]["issuer"] = receivingAmount.issuer;
    //         }
    //       }

    //       const request = {
    //         txjson: xPayment,
    //         user_token: data.userToken,
    //       };

    //       const subscription = await xumm.payload.createAndSubscribe(
    //         request,
    //         (e) => {
    //           if (Object.keys(e.data).indexOf("signed") > -1) {
    //             return e.data;
    //           }
    //         }
    //       );

    //       const resolveData = await subscription.resolved;

    //       if (resolveData.result.meta.TransactionResult == "tesSUCCESS") {
    //         const resolveResponse = {
    //           success: true,
    //           message: "Payment successful",
    //           data: resolveData.result.meta,
    //         };
    //         userSocket.emit("swap-payment-response", resolveResponse);
    //       } else {
    //         // TODO: return the error data
    //         const rejectResponse = {
    //           success: false,
    //           message: "Payment not succeded",
    //           data: resolveData.result.meta,
    //         };
    //         userSocket.emit("swap-payment-response", rejectResponse);
    //       }
    //     } catch (error) {
    //       const rejectResponse = {
    //         success: false,
    //         message: error.message,
    //       };
    //       userSocket.emit("swap-payment-response", rejectResponse);
    //     }
    //   });

    // Create Order API

    socket.on("xumm-payment-request", async (args) => {
      const accountNumber = args.account;
      const data = args;
      const userToken = args.userToken;

      const request = {
        txjson: {
          TransactionType: "OfferCreate",
          Account: data.account,
          TakerGets: {},
          TakerPays: {},
        },
        user_token: data.userToken,
      };

      const txjson = request.txjson;

      // console.log("PAYMENT REQUEST :: data from client", data);

      if (data.buyCurrency === "XRP") {
        txjson["TakerPays"] = xrpl.xrpToDrops(data.buyValue);
      } else {
        if (data.buyValue) {
          txjson["TakerPays"]["value"] = data.buyValue;
        }
        if (data.buyCurrency) {
          txjson["TakerPays"]["currency"] = data.buyCurrency;
        }
        if (data.buyIssuer) {
          txjson["TakerPays"]["issuer"] = data.buyIssuer;
        }
      }

      if (data.sellCurrency === "XRP") {
        txjson["TakerGets"] = xrpl.xrpToDrops(data.sellValue);
      } else {
        if (data.sellValue) {
          txjson["TakerGets"]["value"] = data.sellValue;
        }
        if (data.sellCurrency) {
          txjson["TakerGets"]["currency"] = data.sellCurrency;
        }
        if (data.sellIssuer) {
          txjson["TakerGets"]["issuer"] = data.sellIssuer;
        }
      }

      console.log("txjson", txjson);

      const subscription = await xumm.payload.createAndSubscribe(
        request,
        (e) => {
          if (Object.keys(e.data).indexOf("signed") > -1) {
            return e.data;
          }
        }
      );

      // console.log("qr url", subscription.created.next.always);

      // const QR_Code = subscription.created.refs.qr_png;

      // userSocket.emit("payment-qr-response", QR_Code);

      const resolveData = await subscription.resolved;
      console.log("resolveData", resolveData);
      if (resolveData.signed == false) {
        const rejectResponse = {
          success: false,
          message: "Rejected",
        };

        userSocket.emit("payment-response", rejectResponse);
      } else {
        const response = await xumm.payload.get(resolveData.payload_uuidv4);
        console.log("response.response", response.response);
        if (response.response.dispatched_result === "tecUNFUNDED_OFFER") {
          const rejectResponse = {
            success: false,
            message: "Insufficient balance to fund created offers",
          };

          userSocket.emit("payment-response", rejectResponse);
        } else {
          response.success = true;
          response.message = "Offer Created Successfully";
          // store info in database
          const accObj = {
            account: data.account,
            txId: response.response.txid,
            pair: `${data.sellCurrency}/${data.buyCurrency}`,
            offerType: data.offerType,
            side: data.side,
            price: data.currPrice,
            amount: data.side === "Sell" ? data.buyValue : data.sellValue,
            date: response.payload.created_at,
          };

          // console.log("accObj", accObj);
          console.log("TO BE SAVED DATA TO DB ::: ", accObj);
          // await new AccountOffers(accObj).save();
          //const result = await account_offers.create(accObj);

          // MySQL Storage
          try {
            const result = await account_offers.create(accObj);
            console.log("SAVED DATA TO DB ::: ", result.toJSON());
            userSocket.emit("payment-response", response);
          } catch (err) {
            console.error("ERROR WHILE SAVING DATA TO DB", err);
            const errorResponse = {
              success: false,
              message: "Error while saving data",
            };
            userSocket.emit("payment-response", errorResponse);
          }

          // userSocket.emit("payment-response", response);
        }
      }
    });

    const xrpToDropsVal = xrpl.xrpToDrops(1);
    // console.log("xrpToDropsVal DROP VAL :::   ", xrpToDropsVal);
    userSocket.emit("drops-val", xrpToDropsVal);

    // socket.on("xumm-cancel-offer", async () => {
    // 	const request = {
    // 		txjson: {
    // 			TransactionType: "OfferCancel",
    // 			Account: accountNumber,
    // 			Fee: "12",
    // 			Flags: 0,
    // 			LastLedgerSequence: 7108629,
    // 			OfferSequence: 6,
    // 			Sequence: 7,
    // 		},
    // 		user_token: userToken,
    // 	};

    // 	const subscription = await xumm.payload.createAndSubscribe(request, (e) => {
    // 		if (Object.keys(e.data).indexOf("signed") > -1) {
    // 			return e.data;
    // 		}
    // 	});

    // 	const resolveData = await subscription.resolved;

    // 	if (resolveData.signed == false) {
    // 		const rejectResponse = {
    // 			success: false,
    // 			message: "Rejected",
    // 		};

    // 		userSocket.emit("payment-response", rejectResponse);
    // 	} else {
    // 		const response = await xumm.payload.get(resolveData.payload_uuidv4);

    // 		response.success = true;

    // 		userSocket.emit("payment-response", response);
    // 	}
    // });

    //get OrderBooks between two currencies

    socket.on("getorderbooksPair", async (args) => {
      try {
        const orderbookslist = await xrplHelper.getOrderBooks(args);
        orderbookslist.success = true;
        userSocket.emit("orderbook-list", orderbookslist);
      } catch (err) {
        userSocket.emit("orderbook-list", err); // emit the error to the socket
      }
    });

    // search users based on socket

    socket.on("search-users", async (searchTerm) => {
      try {
        const users = await User.findAll({
          attributes: ["id", "wallet_address", "email"],
          where: {
            is_deleted: 0,
            [Op.or]: [
              { wallet_address: { [Op.like]: `%${searchTerm}%` } },
              { email: { [Op.like]: `%${searchTerm}%` } },
            ],
          },
        });

        // Emit the search results to the client
        socket.emit("search-results", users);
      } catch (err) {
        console.log("Search Error:", err);
      }
    });

    // DELETE EXISTING OFFERS

    socket.on("delete-offers", async (args) => {
      const data = args;
      tx_id = data.tx_id;

      const fetchorderbookdata = await xrplHelper.deleteoffers(tx_id);
      const sequence_number = fetchorderbookdata.sequence_number;
      const affected_account = fetchorderbookdata.affected_account;

      if (affected_account !== data.account) {
        const rejectResponse = {
          success: false,
          message: "Order is not owned by the owner ",
        };
        userSocket.emit("delete-offers-response", rejectResponse);
        return; // Exit early if not owned by the owner
      }

      const request = {
        txjson: {
          TransactionType: "OfferCancel",
          Account: data.account,
          OfferSequence: sequence_number,
        },
        user_token: data.userToken,
      };

      const txjson = request.txjson;

      console.log("txjson", txjson);

      const subscription = await xumm.payload.createAndSubscribe(
        request,
        (e) => {
          if (Object.keys(e.data).indexOf("signed") > -1) {
            return e.data;
          }
        }
      );

      const resolveData = await subscription.resolved;
      console.log("resolveData", resolveData);
      if (resolveData.signed === false) {
        const rejectResponse = {
          success: false,
          message: "Rejected",
        };
        userSocket.emit("delete-offers-response", rejectResponse);
      } else {
        const response = await xumm.payload.get(resolveData.payload_uuidv4);

        console.log("response.response", response.response);

        if (response.response.dispatched_result !== "tesSUCCESS") {
          const rejectResponse = {
            success: false,
            message: "Errors in Deleting the Orders",
          };
          userSocket.emit("delete-offers-response", rejectResponse);
        }
        if (response.response.dispatched_result === "tesSUCCESS") {
          // Set the success message
          response.success = true;
          response.message = "Offer Deleted Successfully";

          // DELETE THE OFFER
          try {
            await account_offers.destroy({
              where: {
                txId: tx_id,
              },
            });
            console.log("DELETED RECORD FROM DB BY txId: ", tx_id);
            userSocket.emit("delete-offers-response", response);
          } catch (err) {
            console.error("ERROR WHILE DELETING RECORD FROM DB", err);
            const errorResponse = {
              success: false,
              message: "Error while deleting offers, please try again",
            };
            userSocket.emit("delete-offers-response", errorResponse);
          }
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(socket.id, " is disconnected");
    });
  });
};

module.exports = socketInit;
// export default io;
