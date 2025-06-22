mongoose = require("mongoose");
// import mongoose from "mongoose";

const Schema = mongoose.Schema;

const AccountOfferSchema = new Schema(
  {
    account: {
      type: String,
      required: true,
    },
    txId: {
      type: String,
      required: true,
    },
    pair: {
      type: String,
      required: true,
    },
    offerType: {
      type: String,
      required: true,
    },
    side: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

AccountOfferSchema.index({
  id: 1,
});

module.exports = mongoose.model("AccountOffer", AccountOfferSchema);
