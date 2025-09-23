const paypal = require("paypal-rest-sdk");

paypal.configure({
  mode: "sandbox",
  client_id: "AVtWzrPL5z0_nEDa8u7EEdQJAR0aD9eNZTfhNpv5KTbgTycji16YGaCUqketMYnYFz9bOoE9xFYSQnwf",
  client_secret: "EDTXZLD24iTzAu04Wk9YxP9dBaORKNpW8BfV1Sdj8F_UXyHHiTMC_HaIY-JX7DLP9qUmayiGXLs-Ddkf",
});

module.exports = paypal;
