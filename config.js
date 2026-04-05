require("dotenv").config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  MONGO_URI: process.env.MONGO_URI,
  ADMIN_IDS: process.env.ADMIN_IDS.split(",").map(id => Number(id))
};
