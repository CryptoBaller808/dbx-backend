const express = require("express");
const { 
  validateTransaction, 
  validatePagination, 
  handleValidationErrors,
  validateRateLimit 
} = require("../middleware/expressValidation");
const { 
  createValidationMiddleware 
} = require("../middleware/validationMiddleware");

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Ledger:
 *       type: object
 *       required:
 *         - title
 *         - author
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the ledger
 *         title:
 *           type: string
 *           description: The ledger title
 *         author:
 *           type: string
 *           description: The ledger author
 *       example:
 *         id: 12
 *         title: The New Turing Omnibus
 *         author: Prabhakar 
 */

 /**
  * @swagger
  * tags:
  *   name: ledger
  *   description: Ledger APIs and in Development Mode and may contains bugs
  */

/**
 * @swagger
 * /ledgers:
 *   get:
 *     summary: Returns the list of all the ledger
 *   tags:
 *   responses:
 *     200:
 *       description: The list of the ledger
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/Ledger'
 */

router.get("/", 
  validateRateLimit,
  validatePagination, 
  handleValidationErrors, 
  (req, res) => {
    const ledger = req.app.db.get("ledger");
    res.send(ledger);
  }
);

/**
 * @swagger
 * /ledger/{id}:
 *   get:
 *     summary: Get the ledger by id
 *     tags:
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ledger id
 *     responses:
 *       200:
 *         description: The ledger description by id
 *         contens:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ledger'
 *       404:
 *         description: The Ledger was not found
 */

router.get("/:id", (req, res) => {
  const ledger = req.app.db.get("ledger").find({ id: req.params.id }).value();

  if(!ledger){
    res.sendStatus(404)
  }

	res.send(ledger);
});

/**
 * @swagger
 * /ledger:
 *   post:
 *     summary: Create a new ledger
 *     tags:
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Ledger'
 *     responses:
 *       200:
 *         description: The ledger was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ledger'
 *       500:
 *         description: Some server error
 */

router.post("/", (req, res) => {
	try {
		const ledger = {
			id: nanoid(idLength),
			...req.body,
		};

    req.app.db.get("ledger").push(ledger).write();
    
    res.send(ledger)
	} catch (error) {
		return res.status(500).send(error);
	}
});

/**
 * @swagger
 * /ledger/{id}:
 *  put:
 *    summary: Update the ledger by the id
 *    tags:
 *    parameters:
 *      - in: path
 *        name: id
 *        schema:
 *          type: string
 *        required: true
 *        description: The ledger id
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/Ledger'
 *    responses:
 *      200:
 *        description: The ledger was updated
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/Ledger'
 *      404:
 *        description: The Ledger was not found
 *      500:
 *        description: Some error happened
 */

router.put("/:id", (req, res) => {
	try {
		req.app.db
			.get("ledger")
			.find({ id: req.params.id })
			.assign(req.body)
			.write();

		res.send(req.app.db.get("ledger").find({ id: req.params.id }));
	} catch (error) {
		return res.status(500).send(error);
	}
});

/**
 * @swagger
 * /ledger/{id}:
 *   delete:
 *     summary: Remove the ledger by id
 *     tags:
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ledger id
 * 
 *     responses:
 *       200:
 *         description: The ledger was deleted
 *       404:
 *         description: The ledger was not found
 */

router.delete("/:id", (req, res) => {
	req.app.db.get("ledger").remove({ id: req.params.id }).write();

	res.sendStatus(200);
});

module.exports = router;