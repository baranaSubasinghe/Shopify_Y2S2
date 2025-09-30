// backend/helpers/payhere.js
const crypto = require("crypto");

function isSandbox() {
  return (process.env.PAYHERE_MODE || "sandbox").toLowerCase() !== "live";
}

function toAmountTwoDecimals(num) {
  return Number(num).toFixed(2); // "123.45"
}

/**
 * Checkout hash
 * MD5( merchant_id + order_id + amount + currency + MD5(merchant_secret).toUpperCase() ).toUpperCase()
 */
function generateCheckoutHash({ merchantId, orderId, amount, currency, merchantSecret }) {
  const amountStr = toAmountTwoDecimals(amount);
  const secretMd5 = crypto.createHash("md5").update(merchantSecret).digest("hex").toUpperCase();
  const raw = `${merchantId}${orderId}${amountStr}${currency}${secretMd5}`;
  return crypto.createHash("md5").update(raw).digest("hex").toUpperCase();
}

/**
 * IPN hash verification
 * MD5( merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(merchant_secret).toUpperCase() ).toUpperCase()
 */
function verifyIPNSignature({
  merchantId,
  orderId,
  payhereAmount,
  payhereCurrency,
  statusCode,
  receivedMd5sig,
  merchantSecret,
}) {
  const secretMd5 = crypto.createHash("md5").update(merchantSecret).digest("hex").toUpperCase();
  const raw = `${merchantId}${orderId}${payhereAmount}${payhereCurrency}${statusCode}${secretMd5}`;
  const expected = crypto.createHash("md5").update(raw).digest("hex").toUpperCase();
  return expected === String(receivedMd5sig || "").toUpperCase();
}

module.exports = {
  isSandbox,
  toAmountTwoDecimals,
  generateCheckoutHash,
  verifyIPNSignature,
};
