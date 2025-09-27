const { validationResult } = require("express-validator");

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map(e => ({ field: e.param, msg: e.msg })),
    });
  }
  next();
};
