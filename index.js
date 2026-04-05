require("dotenv").config();

const { Bot, Keyboard, InlineKeyboard } = require("grammy");
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

const User = mongoose.model("User", new mongoose.Schema({
  user_id: Number,
  name: String,
  username: String
}));

// ---------------- ADMINS ----------------
const ADMINS = process.env.ADMIN_IDS.split(",").map(id => Number(id));

// ---------------- TEMP ----------------
const temp = {};

// ---------------- ADMIN CHECK ----------------
async function isAdmin(id) {
  if (ADMINS.includes(id)) return true;
  const a = await Admin.findOne({ user_id: id });
  return !!a;
}

// ---------------- ADMIN PANEL ----------------
async function showAdminPanel(ctx) {
  const kb = new Keyboard()
    .text("➕ Add Media")
    .text("🔗 Make Link")
    .row()
    .text("👑 Add Admin")
    .text("❌ Remove Admin")
    .row()
    .text("📊 Stats")
    .text("🧹 Cancel")
    .resized();

  await ctx.reply("👑 Admin Panel", { reply_markup: kb });
}

// ---------------- START ----------------
bot.command("start", async (ctx) => {
  const id = ctx.match;
  const user = ctx.from;

  // 🔔 New user tracking
  let existing = await User.findOne({ user_id: user.id });

  if (!existing) {
    await User.create({
      user_id: user.id,
      name: user.first_name,
      username: user.username
    });

    const total = await User.countDocuments();

    const msg = `🆕 New User

👤 Name: ${user.first_name}
🔗 Username: @${user.username || "none"}
🆔 ID: ${user.id}

📊 Total Users: ${total}`;

    for (let adminId of ADMINS) {
      try {
        await bot.api.sendMessage(adminId, msg);
      } catch {}
    }
  }

  // 🔗 LINK OPEN
  if (id) {
    const data = await Link.findById(id);
    if (!data) return ctx.reply("❌ Invalid link");

    const kb = new InlineKeyboard()
      .url("🔁 Watch Again", `https://t.me/${ctx.me.username}?start=${id}`);

    await ctx.reply(
      "⚠️ Note: All media will be deleted automatically after 30 minutes.",
      { reply_markup: kb }
    );

    let msgIds = [];

    for (let f of data.files) {
      let m;
      if (f.type === "video") {
        m = await ctx.replyWithVideo(f.file_id);
      } else {
        m = await ctx.replyWithPhoto(f.file_id);
      }
      msgIds.push(m.message_id);
    }

    setTimeout(async () => {
      for (let mid of msgIds) {
        try {
          await bot.api.deleteMessage(ctx.chat.id, mid);
        } catch {}
      }
    }, 30 * 60 * 1000);

    return;
  }

  // 👑 ADMIN PANEL
  if (await isAdmin(user.id)) {
    return showAdminPanel(ctx);
  }

  ctx.reply("👋 Send valid link");
});

// ---------------- CAPTURE MEDIA ----------------
bot.on("message", async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;

  if (!temp[ctx.from.id]) temp[ctx.from.id] = [];

  if (ctx.message.video) {
    temp[ctx.from.id].push({
      type: "video",
      file_id: ctx.message.video.file_id
    });
    return ctx.reply(`✅ Video added (${temp[ctx.from.id].length})`);
  }

  if (ctx.message.photo) {
    const photo = ctx.message.photo.pop();
    temp[ctx.from.id].push({
      type: "photo",
      file_id: photo.file_id
    });
    return ctx.reply(`🖼 Photo added (${temp[ctx.from.id].length})`);
  }
});

// ---------------- BUTTONS ----------------
bot.hears("➕ Add Media", async (ctx) => {
  ctx.reply("📥 Send videos/photos...");
});

// ---------------- MAKE LINK ----------------
bot.hears("🔗 Make Link", async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;

  const files = temp[ctx.from.id];

  if (!files || files.length === 0) {
    return ctx.reply("❌ No media added");
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

// ---------------- STATS ----------------
bot.hears("📊 Stats", async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;

  const total = await User.countDocuments();

  ctx.reply(`📊 Total Users: ${total}`);
});

// ---------------- ADD ADMIN ----------------
bot.hears("👑 Add Admin", async (ctx) => {
  ctx.reply("Reply to user with /addadmin");
});

bot.command("addadmin", async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;

  if (!ctx.message.reply_to_message) {
    return ctx.reply("Reply to user");
  }

  const uid = ctx.message.reply_to_message.from.id;

  await Admin.create({ user_id: uid });
  ctx.reply("✅ Admin added");
});

// ---------------- REMOVE ADMIN ----------------
bot.hears("❌ Remove Admin", async (ctx) => {
  ctx.reply("Use /removeadmin <id>");
});

bot.command("removeadmin", async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;

  const uid = Number(ctx.match);
  await Admin.deleteOne({ user_id: uid });

  ctx.reply("🗑️ Removed");
});

// ---------------- CANCEL ----------------
bot.hears("🧹 Cancel", async (ctx) => {
  delete temp[ctx.from.id];
  ctx.reply("🧹 Cancelled");
});

// ---------------- START BOT ----------------
bot.start();
