const mongoose = require("../db");

const schema = new mongoose.Schema({
  user_id: Number
});

module.exports = mongoose.model("Admin", schema);
