const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
      match: [/^[A-Za-z\s]+$/, "User name can contain only letters and spaces"],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email"],
    },
    password: { type: String, required: true ,select: false},
    resetPasswordToken:   { type: String, index: true, default: null },
    resetPasswordExpires: { type: Date,   default: null },
    role: { type: String, enum: ["user", "admin"], default: "user" ,required: true},
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
module.exports = User;
