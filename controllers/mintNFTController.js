const { DATE, DataTypes } = require("sequelize");
const db = require("../util/database.js");
const multer = require("multer"); // multer will be used to handle the form data.
const Aws = require("aws-sdk");
const { XummSdk } = require("xumm-sdk");
const axios = require("axios");
const xrpl = require("xrpl");
const Sdk = new XummSdk(
  process.env.XUMM_API_KEY,
  process.env.XUMM_API_SECRET,
  {
    network: process.env.XRPL_NETWORK || 'mainnet' // defaults to mainnet
  }
);
var Sequelize = require("sequelize");

// Import models from the database connection
// Note: We're not accessing these models directly at the module level
// to avoid issues with models not being initialized yet
const db_models = require("../models");

// create main Model
const ActivityEnum = Object.freeze({
  1: "transaction",
  2: "SaleOffer",
  3: "BuyOffer",
  4: "SaleCancel",
  5: "BuyCancel",
  6: "NftMinted",
});

// These model references will be initialized in the init function
let ItemActivity;
let Item;
let User;
let Collection;
let Category;
let ItemProperties;
let ItemSaleInfo;
let Wishlist;

// Initialize models function - must be called before using any model
const initModels = () => {
  if (!ItemActivity) {
    ItemActivity = db_models.item_activity;
    Item = db_models.items;
    User = db_models.users;
    Collection = db_models.collections;
    Category = db_models.categories;
    ItemProperties = db_models.item_properties;
    ItemSaleInfo = db_models.item_sale_info;
    Wishlist = db_models.wishlist;
  }
};

const sdk1 = require("api")("@xumm/v0.9#4r71r49l0zx90kh");
const http = require("https");
require("dotenv/config");
var request = require("request");
const { categories: categoriesModel, wishlist: wishlistModel } = require("../util/database.js");
const con = require('../util/mysql.js').mysqlInstance;

async function txAPI(txid) {
  var responded = "";
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

  await axios(config)
    .then(function (response) {
      var data = JSON.stringify(response.data);
      // console.log(data);
      responded = JSON.parse(data);
      console.log("this is data", data);
      //   console.log(response.data);
      //   console.log(JSON.stringify(response.data));
    })
    .catch(function (error) {
      console.log(error);
    });
  return responded;
}
//access token
async function accessTOKEN(txRes) {
  console.log("this is txres::", txRes);
  console.log(
    "this is txres:: 2",
    txRes.result.meta.AffectedNodes[0].ModifiedNode.PreviousFields.NFTokens
  );
  var newNFTokenID = "";
  // console.log(sampleTxMint.result.meta.AffectedNodes[1].ModifiedNode.FinalFields.NFTokens[0]);
  // console.log(sampleTxMint.result.meta.AffectedNodes[1].ModifiedNode.PreviousFields.NFTokens[1]);
  // console.log("this is length",sampleTxMint.result.meta.AffectedNodes[1].ModifiedNode.PreviousFields.NFTokens.length);
  var set_position = 0;
  for (j = 0; j < txRes.result.meta.AffectedNodes.length; j++) {
    if (
      txRes.result.meta.AffectedNodes[j].ModifiedNode.LedgerEntryType ==
      "NFTokenPage"
    )
      set_position = j;
  }
  for (
    i = 0;
    i <=
    txRes.result.meta.AffectedNodes[set_position].ModifiedNode.PreviousFields
      .NFTokens.length;
    i++
  ) {
    var nfNew =
      txRes.result.meta.AffectedNodes[set_position].ModifiedNode.FinalFields
        .NFTokens[i];
    var nfOld =
      txRes.result.meta.AffectedNodes[set_position].ModifiedNode.PreviousFields
        .NFTokens[i];
    var eq = JSON.stringify(nfNew) === JSON.stringify(nfOld);
    if (eq == false) {
      newNFTokenID =
        txRes.result.meta.AffectedNodes[set_position].ModifiedNode.FinalFields
          .NFTokens[i].NFToken.NFTokenID;
      break;
    }
  }
  if (newNFTokenID == null) {
    var length =
      txRes.result.meta.AffectedNodes[set_position].ModifiedNode.FinalFields
        .NFTokens.length;
    newNFTokenID =
      txRes.result.meta.AffectedNodes[set_position].ModifiedNode.FinalFields
        .NFTokens[length];
  }
  console.log("this is new token", newNFTokenID);
  return newNFTokenID;
}

async function appInfo(
  imguri,
  flags,
  transfee,
  title,
  desc,
  collection_id,
  account,
  usertoken
) {
  var response = "";
  // console.log("this account ::::", account);
  // const appInfo2 = await Sdk.ping();
  // console.log(
  //   "this is app info::::::::::::::::::::::::::",
  //   appInfo2.application.name
  // );


  const request2 = {
    txjson: {
      TransactionType: "NFTokenMint",
      Account: account,
      TransferFee: (transfee) *1000,
      NFTokenTaxon: parseInt(collection_id),
      Flags: 8,
      Fee: "10",
      URI: imguri,
    },
    user_token: usertoken,
  };
  console.log("this is request load :::::::::::::::::::::::::::::::", request2);
  ////////////////
  const subscription = await Sdk.payload.createAndSubscribe(
    request2,
    (event) => {
      console.log("New payload event:", event.data);

      if (event.data.signed === true) {
        console.log("Woohoo! The sign request was signed :)", event);
        return event;
      }
      if (event.data.signed === false) {
        console.log("The sign request was rejected :(", event);
        return false;
      }
    }
  );

  console.log("THIS IS SUBSCRIPTOIN::::", subscription);
  ////// after sign in requestion push notification
  console.log("New payload created, URL:", subscription.created.next.always);
  console.log("  > Pushed:", subscription.created.pushed ? "yes" : "no");

  const resolveData = await subscription.resolved;
  console.log("this is resolve data:::::::::::::::::::", resolveData);
  // console.log("this is response data:::::::::::::::::::" , resolveData.response);

  var txid = "";
  if (resolveData.signed === false) {
    console.log("The sign request was rejected :(");
    console.log("On ledger TX hash:", result.response);
    return false;
  } else {
    // var neww = JSON.parse(resolveData);
    console.log(resolveData.payload.meta.uuid);
    var payloaduid = resolveData.payload.meta.uuid;

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
      console.log("this is a response:::::::", response);
      console.log("this is transaction id", response.data.response.txid);
      txid = response.data.response.txid;
    } catch (error) {
      console.log(error.response.body);
    }
  }
  if (txid) return txid;
  return txid;
}
async function getPayloadResponse(payloaduid) {
  const options = {
    method: "GET",
    hostname: "xumm.app",
    port: null,
    path: "/api/v1/platform/payload/" + payloaduid,
    headers: {
      Accept: "application/json",
      "X-API-Key": process.env.XUMM_API_KEY,
      "X-API-Secret": process.env.XUMM_API_SECRET,
    },
  };

  const req2 = http.request(options, function (res2) {
    const chunks = [];

    res2.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res2.on("end", function () {
      const body = Buffer.concat(chunks);
      var body2 = body.toString();
      var body2 = JSON.parse(body2);
      // console.log("this is body 2:::::::::::",body2);
      response = body2;
      // console.log("response in mint func",response.response.txid);
      console.log("this is response", response);
      return response;
    });
  });
  req2.end();
}
// appInfo();
// console.log("this is app info:::::::::::::::::::::::::: EMPTY" , appInfo2);

// async function signin() {
//   sdk["post-payload"](
//     { txjson: { TransactionType: "SignIn" } },
//     {
//       "X-API-Key": process.env.XUMM_API_KEY,
//       "X-API-Secret": process.env.XUMM_API_SECRET,
//     }
//   )
//     .then((res) => console.log("res:" + res))
//     .catch((err) => console.error("err:" + err));
// }
// //signin();

// Safe check for Collection model - moved inside a function
async function checkCollection() {
  try {
    // Initialize models before using them
    initModels();
    
    const result = await Collection.findByPk(8);
    console.log(result);
    return result;
  } catch (err) {
    console.log("Error checking collection:", err);
    return null;
  }
}

///////////////////////////////////////////////////////// code for req and res by using xumm minting.

const mintNFT = async (req, res) => {
  // Initialize models before using them
  initModels();
  
  //check
  var id = req.body.user_id;
  // var something =  await Collections.findByPk(113);
  var something = await User.findByPk(id);
  if (something == null)
    return res.status(400).send("User with this id doesn't exists.");
  var res2 = JSON.stringify(something);
  var res2 = JSON.parse(res2);
  console.log("this is res", res2.wallet_address);
  //
  var check = req.body.collection_id;
  var checker = await Collection.findByPk(check);
  console.log("Collection Details .------------------------------", checker);
  if (checker == null)
    return res.status(400).send("Collection doesn't exist with this ID.");
  if (checker.user_id != id)
    return res
      .status(400)
      .send("User id: " + id + " is not the owner of collection id: " + check);
  // var rep="";
  // var rep2="";
  // get current time through javaScript
  var today = new Date();
  var date =
    today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
  var time =
    today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  var update1 = date + " " + time;

  // var secret = req.body.secret;
  // var tokenUrl = req.body.tokenUrl;
  var flags = 8;
  var atitle = req.body.title;
  var adesc = req.body.description;
  var transfee = checker.royalty;
  console.log("RoyaltySettt -------------. " + transfee);

  //Image upload to s3

  //return false;
  let profileres = "";
  let imageexists = null;
  //for profile image
  if (req.files.nftimage === undefined) {
    console.log("here i am");
    res.status(400).send("please select a image.");
    return false;
  } else {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME + "/collection-assets", // bucket that we made earlier
      Key: req.files.nftimage[0].originalname, // Name of the image
      Body: req.files.nftimage[0].buffer, // Body which will contain the image in buffer format
      ACL: "public-read-write", // defining the permissions to get the public link
      ContentType: req.files.nftimage[0].mimetype, // Necessary to define the image content-type to view the photo in the browser with the link
    };
    const upload = await s3
      .upload(params)
      .promise()
      .then((data) => {
        // this will give the information about the object in which photo is stored
        profileres = data.Location;
        console.log("data2", profileres);
        imageexists = true;
        return profileres;
      }); //return false;
  }

  var imguri = xrpl.convertStringToHex(profileres);
  console.log("this image uri", imguri);
  var title = xrpl.convertStringToHex(atitle);
  var desc = xrpl.convertStringToHex(adesc);
  var account = res2.wallet_address;
  var usertoken = res2.xumm_token;
  if (usertoken == null)
    res.status(400).send("Xumm not likned with user. Please contact admin.");
  var result = await appInfo(
    imguri,
    flags,
    transfee,
    title,
    desc,
    check,
    account,
    usertoken
  );
  // result stores the txId of nft minting through xumm
  var nftDetails = {};
  var txres = await txAPI(result);
  //txres gets the response from the xrp ledger against the transaction id
  console.log("this is txres:::::", txres);
  var tokenid = await accessTOKEN(txres);
  //tokenid is the Unique Id of the newly created NFT on the XRP Ledger
  console.log(
    "this is response from xumm for minting::::::::::::::::::::",
    tokenid
  );
  nftDetails.title = atitle;
  nftDetails.description = adesc;
  nftDetails.is_unlockable_content = req.body.is_unlockable_content;
  if (req.body.is_unlockable_content)
    nftDetails.unlockable_content = req.body.unlockable_content;
  nftDetails.is_expilict_content = req.body.is_explicit_content;
  if (req.body.is_explicit_content)
    nftDetails.explicit_content = req.body.explicit_content;
  nftDetails.user_id = req.body.user_id;
  nftDetails.current_owner_id = req.body.user_id;
  if (req.body.external_link) nftDetails.external_link = req.body.external_link;
  nftDetails.collection_id = req.body.collection_id;
  nftDetails.item_status = 1; //hard coded
  if (result) nftDetails.token_id = tokenid;
  console.log(nftDetails.token_id);
  // nftDetails.token_id = tokenid;
  nftDetails.updated_at = update1;
  nftDetails.image_uri = profileres;
  nftDetails.sc_address = account;

  // nftDetails.image_url = profileres;
  var obj;
  if (result) {
    console.log("this is result from minter", result);

    var response = await Item.create(nftDetails)
      .then(function (vari) {
        obj = JSON.stringify(vari);
        obj = JSON.parse(obj);
        delete obj.is_deleted;
        delete obj.updated_at;
        delete obj.created_at;
        delete obj.item_status;
      //  delete obj.token_id;
        delete obj.meta_uri;
        delete obj.sale_index;
        delete obj.img_url;
        delete obj.smartcontract_address;
        obj.transaction_id = result;
        console.log(obj);
        res.status(200).send(obj);
      })
      .catch(function (err) {
        console.log(err);
        res
          .status(400)
          .send(
            "Some error occured while saving data of minted nft to the server."
          );
      });
    var properties = JSON.parse(req.body.nft_property);
    // itemprop.property_name = "hi";
    // itemprop.property_value = "hlo";

    // await cusItem(itemprop);
    Object.keys(properties).forEach(async (key) => {
      var itemprop = {};
      itemprop.item_id = obj.id;
      itemprop.property_name = key;
      itemprop.property_value = properties[key];
      console.log(itemprop);
      await cusItem(itemprop);
    });
    var tx_id = result;
    var buyer = null;
    var seller = id; //minter
    // {1:"transaction", 2:"SaleOffer", 3:"BuyOffer", 4:"SaleCancel",5:"BuyCancel",6:"NftMinted",}
    var type = 6;
    var price = null;
    var item_id = obj.id;
    await activityEntry(tx_id, buyer, seller, type, price, item_id);

    // res.status(200).send("minted");
  } else {
    res.status(400).send("xumm rejected");
  }
};

// Add a new function to get all items
const getAllItems = async (req, res) => {
  try {
    // Initialize models before using them
    initModels();
    
    const items = await Item.findAll();
    res.status(200).json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An error occurred while retrieving items" });
  }
};

async function activityEntry(tx_id, buyer, seller, type, price, item_id) {
  // Initialize models before using them
  initModels();
  
  var activity = {};
  activity.item_id = item_id;
  if (buyer) activity.buyer = buyer;
  if (seller) activity.seller = seller;
  if (price) activity.price = price;
  activity.type = type;
  activity.tx_id = tx_id;
  await ItemActivity.create(activity)
    .then(function (vari2) {
      console.log("entry in activity: ", vari2);
    })
    .catch(function (err) {
      console.log(err);
      // res.status(400).send("Some error occured while saving data of minted nft to the server.")
    });
}
async function cusItem(itemprop) {
  // Initialize models before using them
  initModels();
  
  await ItemProperties.create(itemprop)
    .then(function (vari2) {
      console.log(vari2);
    })
    .catch(function (err) {
      console.log(err);
      // res.status(400).send("Some error occured while saving data of minted nft to the server.")
    });
}
//#region Image Upload
// creating the storage variable to upload the file and providing the destination folder,
// if nothing is provided in the callback it will get uploaded in main directory

const storage = multer.memoryStorage({
  destination: function (req, files, cb) {
    if (files === null) {
      console.log("image field is null");
    }
    console.log("image field is not null");
    cb(null, "");
  },
});

// below variable is define to check the type of file which is uploaded

const filefilter = (req, files, cb) => {
  if (
    files.mimetype === "image/jpeg" ||
    files.mimetype === "image/jpg" ||
    files.mimetype === "image/png" ||
    files.mimetype === "image/gif"
  ) {
    cb(null, true);
    //console.log("Image" , file);
  } else {
    cb(null, false);
  }
};

// defining the upload variable for the configuration of photo being uploaded
const nftImg = multer({ storage: storage, fileFilter: filefilter }).fields([
  {
    name: "nftimage",
    maxCount: 1,
  },
]);

// Initialize models when the module is loaded
initModels();

module.exports = {
  mintNFT,
  nftImg,
  getAllItems
};
