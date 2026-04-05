const mongoose = require("../db");

const schema = new mongoose.Schema({
  _id: String,
  files: Array,
  links: Array,
  created_at: Number
});

module.exports = mongoose.model("Link", schema);
