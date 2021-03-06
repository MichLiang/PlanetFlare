"use strict";
; global.WebSocket = require("isomorphic-ws");

const express = require("express");
const uuid = require("uuid");
const cors = require("cors");
const PlanetFlarePublisher = require('./planetflare-publisher');
const PublisherStore = require('./publisher-store');
const BucketHandler = require("./bucket-handler");
const PORT = 3001;

let node;
let publisherStore;

const web3 = require('./ethereum').getWeb3Instance();
const account = require('./ethereum').getUnlockedAccount(web3);
const PlanetFlareContract = require('./ethereum').getPlanetFlareContract(web3);
const PaymentManager = require('./payment-manager');
const { Database } = require("@textile/hub");
const paymentManager = new PaymentManager(web3, account);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());


app.get('/contractABI', (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.json({
    abi: require('./ethereum').getPlanetFlareABI(),
    address: require('./ethereum').getContractAddress()
  });
});

/**
 * Generate tokens for clients requesting them [GET]. 
 * Param: num (query string)
 */
app.get('/get_tokens', (req, res) => {
  const numTokens = req.query.num;

  if (!numTokens) {
    res.status(400).json({ error: "numTokens parameter invalid" });
  }

  const tokensBuffer = [];
  console.log(`Received request to fetch ${numTokens} tokens.`);

  for (let i = 0; i < numTokens; ++i) {
    tokensBuffer.push(uuid.v4());
  }

  publisherStore.addTokens(tokensBuffer);
  console.log('Returning', tokensBuffer);
  res.json({ tokens: tokensBuffer });
});

/**
 * Pay providers presenting clients' proofs-of-receipt [POST]. 
 * Params: tokens, bountyID, recipientAddress (body) 
 */
app.post('/verify_payment', async (req, res) => {
  const tokens = req.body.tokens;
  const bountyID = req.body.bountyID;
  const recipientAddress = req.body.recipientAddress;

  if (!tokens) {
    res.status(400).json({ error: 'No tokens provided' });
  }

  if (!recipientAddress) {
    res.status(400).json({ error: 'No recipient address' });
  }

  if (!bountyID) {
    res.status(400).json({ error: 'No bounty ID' });
  }

  let futurePayment = req.body.futurePayment;

  if (futurePayment) {
    if (!paymentManager.verifyFuturePayment(futurePayment)) {
      res.status(401).json({ error: 'Invalid future payment' });
    }
  } else {
    // TODO: optional, verify that the given bounty ID exists before continuing
    futurePayment = paymentManager.createFuturePayment(recipientAddress, bountyID);
    console.log('created future payment', futurePayment);
  }

  console.log(`tokens: ${tokens}`);
  const result = await ProviderStore.deleteTokens(tokens);
  paymentManager.incrementFuturePayment(futurePayment, result.result.n);
  res.json(futurePayment);
});

app.listen(PORT, () => {
  console.log(`Publisher listening on port ${PORT}`);
});

const init = async () => {
  node = new PlanetFlarePublisher();
  publisherStore = new PublisherStore();
  await node.start();
  await publisherStore.setup();

  await console.log(await node.bucketHandler.upsertFiles('bucket1', ['README.md', 'package.json']));
  await console.log(await node.bucketHandler.getIPNSLink('bucket1'));
}

init();

/**
 * Random error catching
 */
process.on("uncaughtException", err => {
  console.log(err);
}); 
