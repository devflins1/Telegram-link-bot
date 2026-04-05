require("dotenv").config();

const { Bot } = require("grammy");
const mongoose = require("mongoose");

const bot = new Bot(process.env.BOT_TOKEN);

// DB connect
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"));

// Model
const Link = mongoose.model("Link", new mongoose.Schema({
  _id: String,
  files: Array,
  created_at: Number
}));

// 👑 Admin
const ADMINS = process.env.ADMIN_IDS.split(",").map(id => Number(id));

// 🧠 Temp store (per admin)
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

  // auto delete 30 min
  setTimeout(async () => {
    for (let mid of msgIds) {
      try {
        await bot.api.deleteMessage(ctx.chat.id, mid);
      } catch {}
    }
  }, 30 * 60 * 1000);
});

// ---------------- CAPTURE VIDEOS ----------------
bot.on("message", async (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return;

  if (!temp[ctx.from.id]) {
    temp[ctx.from.id] = [];
  }

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

  await ctx.reply(`🔗 Link created:\n${link}`);
});

// ---------------- ADMIN PANEL ----------------
bot.command("admin", async (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return;

  const msg = await ctx.reply(
`👑 Admin Panel

📌 Steps:
1. Send multiple videos
2. Then use /makelink

Commands:
/makelink
`
  );

  try {
    await bot.api.pinChatMessage(ctx.chat.id, msg.message_id);
  } catch {}
});

// ---------------- START BOT ----------------
bot.start();
