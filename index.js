require("dotenv").config();

const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
const express = require("express");

const bot = new Bot(process.env.BOT_TOKEN);

// ---------------- EXPRESS SERVER ----------------
const app = express();

app.get("/", (req, res) => {
  res.send("Bot running 🚀");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🌐 Server running on port " + PORT);
});

// ---------------- DB ----------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log(err));

// ---------------- MODEL ----------------
const Link = mongoose.model("Link", new mongoose.Schema({
  _id: String,
  files: Array,
  created_at: Number
}));

// ---------------- ADMINS ----------------
const ADMINS = process.env.ADMIN_IDS.split(",").map(id => Number(id));

// ---------------- TEMP STORE ----------------
const temp = {};

// ---------------- START ----------------
bot.command("start", async (ctx) => {
  const id = ctx.match;

  if (!id) return ctx.reply("👋 Send valid link");

  const data = await Link.findById(id);
  if (!data) return ctx.reply("❌ Invalid link");

  let msgIds = [];

  for (let f of data.files) {
    const m = await ctx.replyWithVideo(f);
    msgIds.push(m.message_id);
    await new Promise(r => setTimeout(r, 500));
  }

  setTimeout(async () => {
    for (let mid of msgIds) {
      try {
        await bot.api.deleteMessage(ctx.chat.id, mid);
      } catch {}
    }
  }, 30 * 60 * 1000);
});

// ---------------- CAPTURE ----------------
bot.on("message", async (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return;

  if (!temp[ctx.from.id]) temp[ctx.from.id] = [];

  if (ctx.message.video) {
    temp[ctx.from.id].push(ctx.message.video.file_id);
    await ctx.reply(`✅ Video added (${temp[ctx.from.id].length})`);
  }
});

// ---------------- MAKE LINK ----------------
bot.command("makelink", async (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return ctx.reply("❌ Admin only");

  const files = temp[ctx.from.id];

  if (!files || files.length === 0) {
    return ctx.reply("❌ No videos added");
  }

  const id = Math.random().toString(36).substring(2, 8);

  await Link.create({
    _id: id,
    files,
    created_at: Date.now()
  });

  delete temp[ctx.from.id];

  const link = `https://t.me/${ctx.me.username}?start=${id}`;

  await ctx.reply(`🔗 Link:\n${link}`);
});

// ---------------- ADMIN PANEL ----------------
bot.command("admin", async (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return;

  const kb = new InlineKeyboard()
    .text("➕ Add Videos", "add_videos")
    .row()
    .text("🔗 Make Link", "make_link")
    .row()
    .text("🧹 Cancel", "cancel");

  await ctx.reply("👑 Admin Panel", { reply_markup: kb });
});

// ---------------- BUTTONS ----------------
bot.callbackQuery("add_videos", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("📥 Send videos now...");
});

bot.callbackQuery("make_link", async (ctx) => {
  await ctx.answerCallbackQuery();

  const files = temp[ctx.from.id];

  if (!files || files.length === 0) {
    return ctx.reply("❌ No videos");
  }

  const id = Math.random().toString(36).substring(2, 8);

  await Link.create({
    _id: id,
    files,
    created_at: Date.now()
  });

  delete temp[ctx.from.id];

  const link = `https://t.me/${ctx.me.username}?start=${id}`;

  await ctx.reply(`🔗 Link:\n${link}`);
});

bot.callbackQuery("cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  delete temp[ctx.from.id];
  await ctx.reply("🧹 Cancelled");
});

// ---------------- START BOT ----------------
bot.start();
