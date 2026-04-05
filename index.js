require("dotenv").config();

const { Bot, InlineKeyboard } = require("grammy");
const { BOT_TOKEN, ADMIN_IDS } = require("./config");

require("./db");

const Admin = require("./models/Admin");
const Link = require("./models/Link");

const bot = new Bot(BOT_TOKEN);

// 🔐 ADMIN CHECK
async function isAdmin(id) {
  if (ADMIN_IDS.includes(id)) return true;
  const a = await Admin.findOne({ user_id: id });
  return !!a;
}

// 🧠 TEMP STORE
const tempStore = {};

// ---------------- START ----------------
bot.command("start", async (ctx) => {
  const param = ctx.match;

  if (!param) return ctx.reply("👋 Send valid link");

  const data = await Link.findById(param);
  if (!data) return ctx.reply("❌ Invalid link");

  const kb = new InlineKeyboard()
    .text("🎬 All Videos", `videos_${param}`)
    .text("🔗 All Links", `links_${param}`)
    .row()
    .text("🔁 Renew Again", `renew_${param}`);

  await ctx.reply("📦 Select option:", { reply_markup: kb });
});

// ---------------- CAPTURE ----------------
bot.on("message", async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;

  if (!tempStore[ctx.from.id]) {
    tempStore[ctx.from.id] = { files: [], links: [] };
  }

  const store = tempStore[ctx.from.id];

  if (ctx.message.video) {
    store.files.push(ctx.message.video.file_id);
    return ctx.reply("🎬 Video saved");
  }

  if (ctx.message.text) {
    store.links.push(ctx.message.text);
    return ctx.reply("🔗 Link saved");
  }
});

// ---------------- ADDLINK ----------------
bot.command("addlink", async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) {
    return ctx.reply("❌ Only admin");
  }

  const data = tempStore[ctx.from.id];
  if (!data) return ctx.reply("❌ No data");

  const id = Math.random().toString(36).substring(2, 8);

  await Link.create({
    _id: id,
    files: data.files,
    links: data.links,
    created_at: Date.now()
  });

  delete tempStore[ctx.from.id];

  const link = `https://t.me/${ctx.me.username}?start=${id}`;
  await ctx.reply(`✅ Link:\n${link}`);
});

// ---------------- BUTTONS ----------------
bot.callbackQuery(/videos_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const data = await Link.findById(id);
  if (!data) return;

  let msgIds = [];

  for (let f of data.files) {
    const m = await ctx.replyWithVideo(f);
    msgIds.push(m.message_id);
    await new Promise(r => setTimeout(r, 800));
  }

  autoDelete(ctx.chat.id, msgIds);
});

bot.callbackQuery(/links_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const data = await Link.findById(id);
  if (!data) return;

  const txt = data.links.map((l, i) => `${i + 1}. ${l}`).join("\n");
  await ctx.reply(txt || "No links");
});

bot.callbackQuery(/renew_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const data = await Link.findById(id);
  if (!data) return;

  let msgIds = [];

  for (let f of data.files) {
    const m = await ctx.replyWithVideo(f);
    msgIds.push(m.message_id);
  }

  autoDelete(ctx.chat.id, msgIds);
});

// ---------------- AUTO DELETE ----------------
function autoDelete(chatId, msgIds) {
  setTimeout(async () => {
    for (let id of msgIds) {
      try {
        await bot.api.deleteMessage(chatId, id);
      } catch {}
    }
  }, 30 * 60 * 1000);
}

// ---------------- ADD ADMIN ----------------
bot.command("addadmin", async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;

  if (!ctx.message.reply_to_message) {
    return ctx.reply("Reply to user");
  }

  const uid = ctx.message.reply_to_message.from.id;

  if (ADMIN_IDS.includes(uid)) {
    return ctx.reply("Already super admin");
  }

  const exists = await Admin.findOne({ user_id: uid });
  if (exists) return ctx.reply("Already admin");

  await Admin.create({ user_id: uid });
  await ctx.reply("✅ Admin added");
});

// ---------------- START BOT ----------------
bot.start();
