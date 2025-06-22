// import express from "express";
express = require('express');

// 	Controllers
// import xummController from "./controllers/xumm.js";
xummController = require('./controllers/xumm.js');
xlmController = require('./controllers/xlm.js');

const router = express.Router();

/**
 * PUBLIC ROUTES
 */
router.use("/xumm", xummController);
router.use("/xlm", xlmController);

router.use("/heart-bit", (req, res, next) => {
	res.json({
		success: true,
		message: "Digital Block Exchange backend works fine",
	});
});

module.exports = router;
