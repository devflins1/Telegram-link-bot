require("dotenv").config();

const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
const express = require("express");

const bot = new Bot(process.env.BOT_TOKEN);

// ---------------- EXPRESS ----------------
const app = express();
app.get("/", (req, res) => res.send("Bot running 🚀"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🌐 Server running on " + PORT));

// ---------------- DB ----------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"));

// ---------------- MODELS ----------------
const Link = mongoose.model("Link", new mongoose.Schema({
  _id: String,
  files: Array,
  created_at: Number
}));

const Admin = mongoose.model("Admin", new mongoose.Schema({
  user_id: Number
}));

// ---------------- CONFIG ----------------
const ADMINS = process.env.ADMIN_IDS.split(",").map(x => Number(x));
const temp = {};

// ---------------- ADMIN CHECK ----------------
async function isAdmin(id) {
  if (ADMINS.includes(id)) return true;
  const a = await Admin.findOne({ user_id: id });
  return !!a;
}

// ---------------- START ----------------
bot.command("start", async (ctx) => {
  const user = ctx.from;
  const id = ctx.match;

  // 🔗 open link
  if (id) {
    const data = await Link.findById(id);
    if (!data) return ctx.reply("❌ Invalid link");

    const kb = new InlineKeyboard()
      .url("🔁 Watch Again", `https://t.me/${ctx.me.username}?start=${id}`);

    await ctx.reply("⚠️ Videos auto delete in 30 min", { reply_markup: kb });

    let ids = [];

    for (let f of data.files) {
      let m;
      if (f.type === "video") {
        m = await ctx.replyWithVideo(f.file_id, { protect_content: true });
      } else {
        m = await ctx.replyWithPhoto(f.file_id, { protect_content: true });
      }
      ids.push(m.message_id);
    }

    setTimeout(async () => {
      for (let mid of ids) {
        try { await bot.api.deleteMessage(ctx.chat.id, mid); } catch {}
      }
    }, 30 * 60 * 1000);

    return;
  }

  // 👑 ADMIN PANEL (INLINE BUTTONS)
  if (await isAdmin(user.id)) {
    const kb = new InlineKeyboard()
      .text("➕ Add Media", "add_media")
      .text("🔗 Make Link", "make_link")
      .row()
      .text("📊 Stats", "stats")
      .text("❌ Cancel", "cancel");

    return ctx.reply("👑 Admin Panel", { reply_markup: kb });
  }

  ctx.reply("Send valid link");
});

// ---------------- MEDIA ----------------
bot.on("message", async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;

  // ignore text
  if (ctx.message.text) return;

  if (!temp[ctx.from.id]) temp[ctx.from.id] = [];

  if (ctx.message.video) {
    temp[ctx.from.id].push({ type: "video", file_id: ctx.message.video.file_id });
    return ctx.reply(`✅ Video added (${temp[ctx.from.id].length})`);
  }

  if (ctx.message.photo) {
    const p = ctx.message.photo.pop();
    temp[ctx.from.id].push({ type: "photo", file_id: p.file_id });
    return ctx.reply(`🖼 Photo added (${temp[ctx.from.id].length})`);
  }
});

// ---------------- MAKE LINK (BUTTON) ----------------
bot.callbackQuery("make_link", async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!(await isAdmin(ctx.from.id))) return;

  const files = temp[ctx.from.id];
  if (!files || files.length === 0) {
    return ctx.reply("❌ No media added");
  }

  const id = Math.random().toString(36).substring(2, 8);

  await Link.create({ _id: id, files });

  delete temp[ctx.from.id];

  const link = `https://t.me/${ctx.me.username}?start=${id}`;
  return ctx.reply(`🔗 Link created:\n${link}`);
});

// ---------------- MAKE LINK (COMMAND) ----------------
bot.command("makelink", async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;

  const files = temp[ctx.from.id];
  if (!files || files.length === 0) {
    return ctx.reply("❌ No media added");
  }

  const id = Math.random().toString(36).substring(2, 8);

  await Link.create({ _id: id, files });

  delete temp[ctx.from.id];

  const link = `https://t.me/${ctx.me.username}?start=${id}`;
  return ctx.reply(`🔗 Link created:\n${link}`);
});

// ---------------- SAFE START ----------------
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

bot.start({ drop_pending_updates: true });
