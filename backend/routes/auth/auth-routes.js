const express = require("express");
const { body } = require("express-validator");
const validate = require("../../middleware/validate");
const {
  registerUser,
  loginUser,
  logoutUser,
  authMiddleware,
} = require("../../controllers/auth/auth-controller");

// regexes
const nameOnlyLetters = /^[A-Za-z\s]+$/;
const strongPassword =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,72}$/;
const router = express.Router();

router.post("/register",
   /*registerUser*/
   [
    body("userName")
      .trim()
      .notEmpty().withMessage("User name is required")
      .isLength({ min: 2, max: 50 }).withMessage("User name 2–50 chars")
      .matches(nameOnlyLetters).withMessage("Only letters and spaces"),
    body("email")
      .trim()
      .isEmail().withMessage("Enter a valid email") // catches @ and valid domain (incl .com, .lk, etc.)
      .normalizeEmail(),
    body("password")
      .matches(strongPassword)
      .withMessage("Min 8, upper, lower, number & symbol"),
  ],
  validate,
  registerUser
  
  );
router.post("/login", /*loginUser*/
  [
    body("email").trim().isEmail().withMessage("Enter a valid email").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  loginUser

);
router.post("/logout", logoutUser);
router.get("/check-auth", authMiddleware, (req, res) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    message: "Authenticated user!",
    user,
  });
});

module.exports = router;
