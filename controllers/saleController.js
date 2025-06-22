const moment = require("moment");
require("moment-timezone");
const { DATE } = require("sequelize");
const db = require("../util/database.js");
const multer = require("multer"); // multer will be used to handle the form data.
const Aws = require("aws-sdk"); // aws-sdk library will used to upload image to s3 bucket.
const http = require("https");
const axios = require("axios");
const xrpl = require("xrpl");
const { XummSdk } = require("xumm-sdk");
const { Console } = require("console");
require("dotenv/config");
const Sdk = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);
// create main Model
const ActivityEnum = Object.freeze({
  1: "transaction",
  2: "SaleOffer",
  3: "BuyOffer",
  4: "SaleCancel",
  5: "BuyCancel",
  6: "NftMinted",
});
const ItemActivity = db.item_activity;
const Collection = db.collections;
const Category = db.categories;
const User = db.users;
const Items = db.items;
const ItemStats = db.item_stats;
const ItemSaleInfo = db.item_sale_info;
const ItemProperties = db.item_properties;
const ItemLeger = db.item_ledger;
const ItemBids = db.item_bids;
const Wishlist = db.wishlist;
const Setting = db.setting;
var Sequelize = require("sequelize");
const Op = Sequelize.Op;
const operatorsAliases = {
  $eq: Op.eq,
  $or: Op.or,
};

// connection for query
const { send } = require("process");
const itemPropertiesModel = require("../models/itemPropertiesModel.js");
const { sequelize } = require("../util/database.js");

const destination = process.env.PLATFORM_NFT_BROKER_ADDRESS;

// Brokered Request
async function signBrokerReq(nftselloffer, nftbuyoffer, getFee) {
  const setting = await Setting.findOne();
  if (!setting) {
    throw new Error("No record found");
  }

  const { value } = setting;
  var fees = (value / 100) * getFee * 1000000; // Calculate fees as a percentage of getFee and multiply by 1,000,000

  const Broker_fee = fees.toFixed(0).toString(); // Calculate sprice and subtract fees

  // var fees = value *1000000;
  console.log("Inside brokerAPI", Broker_fee);

  // var fees = (value*1000000).toString(); // Convert fee to a string

  // var fees = (fee * 1000000).toFixed(2);
  // // fees = fees + "";
  const secret = process.env.PLATFORM_NFT_BROKER_ADDRESS_SECRET;
  const wallet = xrpl.Wallet.fromSeed(secret);

  const client = new xrpl.Client(process.env.TESTNET);

  try {
    await client.connect();

    const prepared = await client.autofill({
      Account: process.env.PLATFORM_NFT_BROKER_ADDRESS,
      NFTokenSellOffer: nftselloffer,
      NFTokenBuyOffer: nftbuyoffer,
      TransactionType: "NFTokenAcceptOffer",
      NFTokenBrokerFee: Broker_fee,
    });

    const max_ledger = prepared.LastLedgerSequence;

    // process.exit(0);

    const signed = wallet.sign(prepared);
    console.log("Signed transaction...");

    const result = await client.submitAndWait(signed.tx_blob);
    console.log("Transaction result:", result.result.meta.TransactionResult);
    console.log(
      "Balance changes:",
      JSON.stringify(xrpl.getBalanceChanges(result.result.meta), null, 2)
    );

    const resultData = result.result.meta.TransactionResult;

    if (resultData === "tesSUCCESS") {
      console.log(
        `Transaction succeeded: ${process.env.TESTNET_TX}/transactions/${signed.hash}`
      );

      console.log(
        `Transaction succeeded: ${process.env.TESTNET_TX}/transactions/${signed.hash}`
      );
      return {
        success: true,
        transactionId: signed.hash,
      };
    } else if (resultData === "unknown") {
      console.log("Transaction status unknown.");
      return {
        success: false,
        error: "Transaction status unknown.",
      };
    } else if (resultData === "tefMAX_LEDGER") {
      console.log("Transaction failed to achieve consensus.");
      return {
        success: false,
        error: "Transaction failed to achieve consensus.",
      };
    } else {
      console.log(
        `Transaction failed with code ${resultData}: ${process.env.TESTNET_TX}/transactions/${signed.hash}`
      );
      return {
        success: false,
        error: `Transaction failed with code ${resultData}`,
      };
    }
  } catch (error) {
    console.log("Error occurred:", error);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    await client.disconnect();
  }
}

async function signBrokerReq1(nftselloffer, nftbuyoffer) {
  var account = "rwrkGzbBBsJ744DaCG2iPim758tyrSPKJ3"; // broker account
  // var nftselloffer = "4C1F3D90B28A218CDF1E1E252B2BA7C62A44FDFDF6E4183C611059D378025D45";
  // var nftbuyoffer = "E15627AF40EA2B3617D0CD49ACEE8C19563C231C7B77047770EF025F0EBFD2F7" ;
  // var tokenid = "00080000731BF82DBA59DCD0495A0DC3F7198DCA495AD6973A9725F70000005C";
  var fees = "10000";
  var usertoken = "667395a5-a08d-4201-ab3a-79db8db76a98";
  // let usertoken = '667395a5-a08d-4201-ab3a-79db8db76a98';
  // var account = 'rBVeDQtHcEEgWLTXkwkLVAZmieEWhjrFKZ';
  // var tokenid ='00080000731BF82DBA59DCD0495A0DC3F7198DCA495AD6970A85CBBD00000022';
  const request = {
    // tx id of created nft offer D0FF8D522F1851852D2A5AC29C312D02540DB40A7AE42C9FCDDA119085139DB7
    /////////////// ACCEPT NFTokenAcceptOffer  /////////////////
    txjson: {
      TransactionType: "NFTokenAcceptOffer",
      Account: account,
      NFTokenBrokerFee: fees,
      NFTokenBuyOffer: nftbuyoffer,
      NFTokenSellOffer: nftselloffer,
      // "NFTokenID": tokenid,
      // "Flags": 0,
    },
    //////////////////// SEND PUSH NOTIFICATION TO XUMM USER ///////////////////////////////////////
    user_token: usertoken,
  };
  //////////////// Create Payload
  const subscription = await Sdk.payload.createAndSubscribe(
    request,
    (event) => {
      // console.log('New payload event:', event.data)
      if (event.data.signed === true) {
        console.log("Woohoo! The sign request was signed :)");
        return event;
      }
      if (event.data.signed === false) {
        console.log("The sign request was rejected :(", event);
        return false;
      }
    }
  );
  var sellNFTresponse = "";
  console.log("  > Pushed:", subscription.created.pushed ? "yes" : "no");
  const resolveData = await subscription.resolved;
  console.log("this is resolve data:::::::::::::::::::", resolveData);
  if (resolveData.signed === false) {
    console.log("The sign request was rejected :(");
    return false;
  } else {
    var payloaduid = subscription.payload.meta.uuid;
    // use try catch to hit xumm payload api to make it await.
    try {
      const response = await axios.get(
        "https://xumm.app/api/v1/platform/payload/" + payloaduid,
        {
          headers: {
            Accept: "application/json",
            "X-API-Key": process.env.XUMM_API_KEY,
            "X-API-Secret": process.env.XUMM_API_SECRET,
          },
        }
      );
      // console.log("this is a response:::::::",response);
      sellNFTresponse = response.data;
    } catch (error) {
      console.log(error.response.body);
      sellNFTresponse = error;
    }
  }
  console.log("this is sellNFTresponse :::::::::::", sellNFTresponse);
  return sellNFTresponse;
}
//////////////////////////////////////////////////////

// accessTOKEN();
function accessTOKEN(txRes) {
  var newNFTokenID = "";
  // console.log(sampleTxMint.result.meta.AffectedNodes[1].ModifiedNode.FinalFields.NFTokens[0]);
  // console.log(sampleTxMint.result.meta.AffectedNodes[1].ModifiedNode.PreviousFields.NFTokens[1]);
  // console.log("this is length",sampleTxMint.result.meta.AffectedNodes[1].ModifiedNode.PreviousFields.NFTokens.length);
  for (
    i = 0;
    i <=
    txRes.result.meta.AffectedNodes[1].ModifiedNode.PreviousFields.NFTokens
      .length;
    i++
  ) {
    var nfNew =
      txRes.result.meta.AffectedNodes[1].ModifiedNode.FinalFields.NFTokens[i];
    var nfOld =
      txRes.result.meta.AffectedNodes[1].ModifiedNode.PreviousFields.NFTokens[
        i
      ];
    var eq = JSON.stringify(nfNew) === JSON.stringify(nfOld);
    if (eq == false) {
      newNFTokenID =
        txRes.result.meta.AffectedNodes[1].ModifiedNode.FinalFields.NFTokens[i]
          .NFToken.NFTokenID;
      break;
    }
  }
  if (newNFTokenID == null) {
    var length =
      txRes.result.meta.AffectedNodes[1].ModifiedNode.FinalFields.NFTokens
        .length;
    newNFTokenID =
      txRes.result.meta.AffectedNodes[1].ModifiedNode.FinalFields.NFTokens[
        length
      ];
  }
  console.log("this is new token", newNFTokenID);
  return newNFTokenID;
}

// txpi2();
async function txAPI(txid) {
  // var txid = "696C1193C21217BBC0475DFB5A00BF258D347FD13D231115D3724C4460DAA642";
  // var axios = require('axios');
  var data = JSON.stringify({
    method: "tx",
    params: [
      {
        transaction: txid,
        binary: false,
      },
    ],
  });

  var config = {
    method: "post",
    url: process.env.TESTNET_HTTPS,
    headers: {
      // 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXRfYWRkcmVzcyI6InJCVmVEUXRIY0VFZ1dMVFhrd2tMVkFabWllRVdoanJGS1oiLCJpYXQiOjE2NTY2NjM5NDUsImV4cCI6MTY1Njc1MDM0NX0.nqZ9XqZxRAVj4T2-grr6th24pRVbTuQCB2n8KF01vQ8',
      "Content-Type": "application/json",
    },
    data: data,
  };

  var response = await axios(config)
    .then(function (response) {
      var data = JSON.stringify(response.data);
      // console.log(data);
      data = JSON.parse(data);
      console.log(data);
      return data;
      //   console.log(response.data);
      //   console.log(JSON.stringify(response.data));
    })
    .catch(function (error) {
      console.log(error);
    });
  console.log("this is response:::::", response);
  return response;
}
async function getAccountNfts(account) {
  // var txid = "696C1193C21217BBC0475DFB5A00BF258D347FD13D231115D3724C4460DAA642";
  // var axios = require('axios');
  var data = JSON.stringify({
    method: "account_nfts",
    params: [
      {
        account: account,
        // "account": "rwrkGzbBBsJ744DaCG2iPim758tyrSPKJ3",
        ledger_index: "validated",
      },
    ],
  });

  var config = {
    method: "post",
    url: process.env.TESTNET_HTTPS,
    headers: {
      // 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXRfYWRkcmVzcyI6InJCVmVEUXRIY0VFZ1dMVFhrd2tMVkFabWllRVdoanJGS1oiLCJpYXQiOjE2NTY2NjM5NDUsImV4cCI6MTY1Njc1MDM0NX0.nqZ9XqZxRAVj4T2-grr6th24pRVbTuQCB2n8KF01vQ8',
      "Content-Type": "application/json",
    },
    data: data,
  };

  var response = await axios(config)
    .then(function (response) {
      var data = JSON.stringify(response.data);
      // console.log(data);
      data = JSON.parse(data);
      console.log(data);
      return data;
      //   console.log(response.data);
      //   console.log(JSON.stringify(response.data));
    })
    .catch(function (error) {
      console.log(error);
    });
  console.log("this is response:::::", response);
  return response;
}

//SELL NFT  API
async function signSellReq(account, tokenid, usertoken, fix_price) {
  // fix_price = fix_price * 1000000;
  var fix_price = (fix_price * 1000000).toFixed(0).toString();

  // let usertoken = '667395a5-a08d-4201-ab3a-79db8db76a98';
  // var account = 'rBVeDQtHcEEgWLTXkwkLVAZmieEWhjrFKZ';
  // var tokenid ='00080000731BF82DBA59DCD0495A0DC3F7198DCA495AD6970A85CBBD00000022';
  const request = {
    // tx id of created nft offer D0FF8D522F1851852D2A5AC29C312D02540DB40A7AE42C9FCDDA119085139DB7
    /////////////// CREATE NFTokenCreateOffer  /////////////////
    txjson: {
      TransactionType: "NFTokenCreateOffer",
      Account: account,
      NFTokenID: tokenid,
      //  Amount: "" + fix_price,
      Amount: fix_price,
      Destination: destination,
      Flags: 1, /// MUST HAVE 1 for sell and 0 for buy.
    },
    //////////////////// SEND PUSH NOTIFICATION TO XUMM USER ///////////////////////////////////////
    user_token: usertoken,
  };
  //////////////// Create Payload
  const subscription = await Sdk.payload.createAndSubscribe(
    request,
    (event) => {
      // console.log('New payload event:', event.data)
      if (event.data.signed === true) {
        console.log("Woohoo! The sign request was signed :)");
        return event;
      }
      if (event.data.signed === false) {
        console.log("The sign request was rejected :(", event);
        return false;
      }
    }
  );
  var sellNFTresponse = "";
  console.log("  > Pushed:", subscription.created.pushed ? "yes" : "no");
  const resolveData = await subscription.resolved;
  console.log("this is resolve data:::::::::::::::::::", resolveData);
  if (resolveData.signed === false) {
    console.log("The sign request was rejected :(");
    return false;
  } else {
    var payloaduid = subscription.payload.meta.uuid;
    // use try catch to hit xumm payload api to make it await.
    try {
      const response = await axios.get(
        "https://xumm.app/api/v1/platform/payload/" + payloaduid,
        {
          headers: {
            Accept: "application/json",
            "X-API-Key": process.env.XUMM_API_KEY,
            "X-API-Secret": process.env.XUMM_API_SECRET,
          },
        }
      );
      // console.log("this is a response:::::::",response);
      sellNFTresponse = response.data;
    } catch (error) {
      console.log(error.response.body);
      sellNFTresponse = error;
    }
  }
  console.log("this is sellNFTresponse :::::::::::", sellNFTresponse);
  return sellNFTresponse;
}

const sellNFT = async (req, res) => {
  var nft_id = req.body.item_id;
  var user_id = req.body.user_id;
  var sale_type = req.body.sale_type;
  var status_id = req.body.resale_status;
  var today = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/, " UTC");

  // VALIDATIONS
  if (!nft_id) return res.status(400).send("Please provide nft id.");
  if (!user_id) return res.status(400).send("Please provide user id.");
  if (!sale_type) return res.status(400).send("Please provide sale type.");

  // Sale Type 1 = Fixed price, 2 = Timed Auction and 3 = Unlimited Auction
  if (sale_type == 1 && !req.body.fix_price) {
    return res
      .status(400)
      .send("Please include Fixed Price Value for Sale Type - fix_price.");
  }

  if (
    sale_type == 2 &&
    (!req.body.min_price ||
      !req.body.start_date ||
      !req.body.end_date ||
      !req.body.reserve_price)
  ) {
    return res
      .status(400)
      .send(
        "Please include min_price, start_date, end_date and reserve_price for Sale Type - Timed Auction."
      );
  }

  if (sale_type == 3 && !req.body.min_price) {
    return res
      .status(400)
      .send(
        "Please include min_price for Sale Type - Unlimited Auction - min_price."
      );
  }

  // Check if NFT exists
  const nft = await Items.findOne({
    where: {
      id: nft_id,
    },
  });

  if (!nft) {
    return res.status(404).send("NFT not found.");
  }

  // Check if user is the owner of the NFT
  if (nft.current_owner_id != user_id) {
    return res.status(403).send("You are not the owner of this NFT.");
  }

  // Check if NFT is already on sale
  const existingSale = await ItemSaleInfo.findOne({
    where: {
      item_id: nft_id,
      is_completed: 0,
    },
  });

  if (existingSale) {
    return res.status(400).send("NFT is already on sale.");
  }

  // Get user details for XUMM token
  const user = await User.findOne({
    where: {
      id: user_id,
    },
  });

  if (!user) {
    return res.status(404).send("User not found.");
  }

  if (!user.xumm_token) {
    return res
      .status(400)
      .send("User does not have XUMM token. Please connect wallet first.");
  }

  // Create sale info based on sale type
  let saleInfo = {
    item_id: nft_id,
    sale_type: sale_type,
    is_completed: 0,
    created_at: today,
    updated_at: today,
  };

  if (sale_type == 1) {
    // Fixed price
    saleInfo.fix_price = req.body.fix_price;
  } else if (sale_type == 2) {
    // Timed Auction
    saleInfo.min_price = req.body.min_price;
    saleInfo.start_date = req.body.start_date;
    saleInfo.end_date = req.body.end_date;
    saleInfo.reserve_price = req.body.reserve_price;
  } else if (sale_type == 3) {
    // Unlimited Auction
    saleInfo.min_price = req.body.min_price;
  }

  try {
    // For Fixed Price, create XUMM sell offer
    if (sale_type == 1) {
      const sellResponse = await signSellReq(
        user.wallet_address,
        nft.token_id,
        user.xumm_token,
        req.body.fix_price
      );

      if (!sellResponse || sellResponse === false) {
        return res.status(400).send("Failed to create sell offer.");
      }

      // Check if transaction was successful
      if (
        sellResponse.response &&
        sellResponse.response.dispatched_result === "tesSUCCESS"
      ) {
        // Get transaction details
        const txDetails = await txAPI(sellResponse.response.txid);

        if (!txDetails || !txDetails.result) {
          return res.status(400).send("Failed to get transaction details.");
        }

        // Extract offer index from transaction
        let offerIndex = "";
        if (
          txDetails.result.meta &&
          txDetails.result.meta.AffectedNodes &&
          txDetails.result.meta.AffectedNodes.length > 0
        ) {
          for (let node of txDetails.result.meta.AffectedNodes) {
            if (node.CreatedNode && node.CreatedNode.LedgerEntryType === "NFTokenOffer") {
              offerIndex = node.CreatedNode.LedgerIndex;
              break;
            }
          }
        }

        if (!offerIndex) {
          return res.status(400).send("Failed to extract offer index from transaction.");
        }

        // Save sale info with offer index
        saleInfo.offer_index = offerIndex;
        saleInfo.tx_id = sellResponse.response.txid;

        // Create sale info in database
        const createdSale = await ItemSaleInfo.create(saleInfo);

        // Update item status
        await Items.update(
          {
            item_status: status_id ? status_id : 2, // 2 = On Sale
            updated_at: today,
          },
          {
            where: {
              id: nft_id,
            },
          }
        );

        // Create activity record
        await ItemActivity.create({
          item_id: nft_id,
          user_id: user_id,
          activity_type: 2, // SaleOffer
          price: req.body.fix_price,
          created_at: today,
          updated_at: today,
        });

        return res.status(201).json({
          status: 201,
          success: true,
          message: "NFT put on sale successfully.",
          data: {
            sale_info: createdSale,
            transaction: {
              txid: sellResponse.response.txid,
              offer_index: offerIndex,
            },
          },
        });
      } else {
        return res.status(400).json({
          status: 400,
          success: false,
          message: "Failed to create sell offer.",
          error: sellResponse.response
            ? sellResponse.response.dispatched_result
            : "Unknown error",
        });
      }
    } else {
      // For auction types, just create the sale info
      const createdSale = await ItemSaleInfo.create(saleInfo);

      // Update item status
      await Items.update(
        {
          item_status: status_id ? status_id : 2, // 2 = On Sale
          updated_at: today,
        },
        {
          where: {
            id: nft_id,
          },
        }
      );

      // Create activity record
      await ItemActivity.create({
        item_id: nft_id,
        user_id: user_id,
        activity_type: 2, // SaleOffer
        price: sale_type == 1 ? req.body.fix_price : req.body.min_price,
        created_at: today,
        updated_at: today,
      });

      return res.status(201).json({
        status: 201,
        success: true,
        message: "NFT put on auction successfully.",
        data: {
          sale_info: createdSale,
        },
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 500,
      success: false,
      message: "An error occurred while putting NFT on sale.",
      error: error.message,
    });
  }
};

// Get all items on sale
const getAllitemsOnSale = async (req, res) => {
  try {
    var sale_type = req.body.sale_type;
    var whereClause = {};
    if (sale_type) {
      whereClause = {
        sale_type: sale_type,
        is_completed: 0,
      };
    } else {
      whereClause = {
        is_completed: 0,
      };
    }

    const saleItems = await ItemSaleInfo.findAll({
      where: whereClause,
      include: [
        {
          model: Items,
          as: "item_detail",
          include: [
            {
              model: Collection,
              as: "item_collection",
              include: [
                {
                  model: Category,
                  as: "category_details",
                },
              ],
            },
            {
              model: User,
              as: "creator",
              attributes: {
                exclude: [
                  "password",
                  "access_token",
                  "xumm_token",
                  "is_deleted",
                  "created_at",
                  "updated_at",
                ],
              },
            },
            {
              model: User,
              as: "current_owner_details",
              attributes: {
                exclude: [
                  "password",
                  "access_token",
                  "xumm_token",
                  "is_deleted",
                  "created_at",
                  "updated_at",
                ],
              },
            },
            {
              model: ItemProperties,
              as: "item_properties_details",
            },
          ],
        },
      ],
    });

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Items on sale fetched successfully.",
      data: saleItems,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 500,
      success: false,
      message: "An error occurred while fetching items on sale.",
      error: error.message,
    });
  }
};

// Get collected items by user ID
const getCollectedItemsByUserId = async (req, res) => {
  try {
    var id = req.query.id;
    if (id == "" || id == null) res.status(400).send("Please enter userid.");
    var page_number = 0;
    var page_size = 10000;
    if (req.query.page_size > 0) page_size = req.query.page_size;
    if (req.query.page_number > 0)
      page_number = (req.query.page_number - 1) * page_size;
    console.log((req.query.page_number - 1) * page_size);
    console.log("pages:", page_number, page_size);
    if (id) {
      Items.findAndCountAll({
        where: {
          current_owner_id: id,
        },
        attributes: {
          exclude: [
            "sale_index",
            "collection_id",
            "item_status",
            "token_id",
            "sc_address",
            "meta_uri",
            "is_deleted",
            "created_at",
            "updated_at",
          ],
        },
        // offset: parseInt(page_number),
        // limit: parseInt(page_size),
        distinct: true,
        subQuery: false,
        include: [
          {
            model: ItemSaleInfo, // Include the ItemSaleInfo model
            as: "item_sale_info",
            required: false,
            attributes: [
              ["is_completed", "is_completed"], // Rename the attribute to is_completed
            ], // Include only the is_completed attribute
          },
          {
            model: Collection,
            as: "item_collection",
            required: false,
            attributes: {
              exclude: [
                "smartcontract_address",
                "is_deleted",
                "created_at",
                "updated_at",
              ],
            },
            include: [
              {
                model: Category,
                as: "category_details",
                required: false,
              },
            ],
          },
          {
            model: ItemProperties,
            as: "item_properties_details",
            required: false,
          },
          {
            //not working..  might be a issue with sequelize   https://lightrun.com/answers/sequelize-sequelize-no-multiple-includes-possible-when-using-count-function
            // below counted over a loop after result.
            model: Wishlist,
            as: "wishlist_count",
            attributes: {
              exclude: ["id", "item_id"],
            },
            required: false,
          },
          {
            model: User,
            as: "current_owner_details",
            required: false,
            attributes: {
              exclude: [
                "access_token",
                "xumm_token",
                "is_deleted",
                "created_at",
                "updated_at",
              ],
            },
          },
          {
            model: User,
            as: "creator",
            required: false,
            attributes: {
              exclude: [
                "access_token",
                "xumm_token",
                "is_deleted",
                "created_at",
                "updated_at",
              ],
            },
          },
        ],
      })
        .then((res2) => {
          const aobj = JSON.stringify(res2);
          const obj = JSON.parse(aobj);

          for (i = 0; i < obj.rows.length; i++) {
            if (obj.rows[i].creator && obj.rows[i].current_owner_details) {
              obj.rows[i] = {
                item_detail: {
                  ...obj.rows[i],
                  item_sale_info: {
                    is_completed: obj.rows[i].item_sale_info?.is_completed ? 1 : null
                  },
                },
              };
            }
          }

          // pagination
          obj.count = obj.rows.length;
          if (req.query.page_number || req.query.page_size) {
            var skip = req.query.page_number * req.query.page_size - req.query.page_size;
            var objpage = [];
            var newobkindex = 0;
            if (obj.count <= skip) {
              obj.rows = [];
            } else {
              for (i = skip; i < obj.count; i++) {
                if (newobkindex == req.query.page_size) break;
                objpage.push(obj.rows[i]);
                newobkindex++;
              }
              obj.rows = objpage;
            }
          }

          return res.status(200).json({
            status: 200,
            success: true,
            message: "Fetched successfully.",
            data: obj,
          });
        });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 500,
      success: false,
      message: "An error occurred while fetching sale details.",
      error: error.message,
    });
  }
};

module.exports = {
  sellNFT,
  getAllitemsOnSale,
  getCollectedItemsByUserId,
};
