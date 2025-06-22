const express = require("express");
const router = express.Router();

const {
  contactUsEmail,
  subscribeEmail,
  listingApplicationEmail,
} = require("../controllers/malingController");

router.post("/contactUs", contactUsEmail);
router.post("/subscribeEmail", subscribeEmail);
router.post("/listingApplication", listingApplicationEmail);

module.exports = router;
