// --------------- IMPORT REGION --------------------------
import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import { ChatGPTAPI } from "chatgpt";
// --------------- IMPORT REGION --------------------------

// --------------- DECLARE REGION --------------------------
dotenv.config();

const MY_HANDLER_GROUP = process.env.HANDLER_GROUP;
const WHITE_LIST_CHAT_ID = [process.env.MY_ID, process.env.CO_CHITCHAT_GROUP, process.env.HANDLER_GROUP];

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const apiGPT = new ChatGPTAPI({ apiKey: process.env.OPENAI_API_KEY, debug: true });

// Tracking conversation
const CONVERSATIONS = [];
for (const chatId of WHITE_LIST_CHAT_ID) {
  CONVERSATIONS.push({
    chatId: chatId,
    conversationId: "",
    parentMessageId: "",
  });
}

// let responseGPT;

// Handle anonymous object
function warningMessageToActiveGroup(unkndownObject, content) {
  let msgToActiveGroup = "`" + "[Unknown Request]" + "`" + "\n";

  for (const key in unkndownObject) {
    msgToActiveGroup += "*" + key + "*" + ": " + unkndownObject[key] + "\n";
  }

  msgToActiveGroup += "\n" + "*CONTENT:*" + "\n" + content;
  return msgToActiveGroup;
}

// get full date time with format
function getCurrentDateTime() {
  const dateOptions = {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  const currentDate = new Date();
  const currentDateTime = currentDate.toLocaleString("default", dateOptions);
  return currentDateTime;
}

// --------------- EXECUTE BOT REGION --------------------------
if (process.env.NODE_ENV == "PRODUCTION") {
  bot.launch({
    webhook: {
      domain: process.env.DOMAIN,
      port: process.env.PORT || 443,
    },
  });
  console.log("[INFO] " + getCurrentDateTime() + " | APP IS RUNNING - PRODUCTION DETECTED");
} else {
  bot.launch(); // if local use Long-polling
  console.log("[INFO] " + getCurrentDateTime() + " | APP IS RUNNING - DEVELOPMENT DETECTED");
}

bot.telegram.getMe().then((botInfo) => {
  bot.telegram.sendMessage(MY_HANDLER_GROUP, "`" + "HELLO, I'M ONLINE AND READY TO SERVE" + "`", { parse_mode: "Markdown" });
});

// middleware
bot.use(async (ctx, next) => {
  if (WHITE_LIST_CHAT_ID.includes(ctx.message.chat.id.toString()) === false) {
    await ctx.telegram.sendMessage(MY_HANDLER_GROUP, warningMessageToActiveGroup(ctx.message.from, ctx.message.text), { parse_mode: "Markdown" });
    return;
  }

  await ctx.sendChatAction("typing"); // typing animation
  await next();
});

// get chatId
bot.command("myid", async (ctx) => {
  await ctx.reply(`Hello ${ctx.message.from.username}, your chatId is ${ctx.message.chat.id}`);
});

// send request to openApi - chatGPT
bot.command("q", async (ctx) => {
  const command = ctx.message.text;
  const userQuestion = command.substring(command.indexOf("/q") + 2).trim();

  if (!userQuestion) {
    await ctx.reply("Vui lòng cung cấp nội dung cần hỏi sau lệnh /q. Ví dụ: /q Câu_hỏi.", { reply_to_message_id: ctx.message.message_id });
    return;
  }

  const conversationObj = CONVERSATIONS.find((item) => item.chatId === ctx.message.chat.id.toString());
  let responseGPT;

  if (conversationObj.conversationId === "") {
    console.log(`[INFO] ${getCurrentDateTime()} | ${ctx.message.chat.title} | ${ctx.message.chat.id} | START CONVERSATION`);
    responseGPT = await apiGPT.sendMessage(userQuestion, {
      timeoutMs: 5 * 60 * 1000,
    });
  } else {
    console.log(`[INFO] ${getCurrentDateTime()} | ${ctx.message.chat.title} | ${ctx.message.chat.id} | TRACKING CONVERSATION`);
    responseGPT = await apiGPT.sendMessage(userQuestion, {
      conversationId: conversationObj.conversationId,
      parentMessageId: conversationObj.parentMessageId,
      timeoutMs: 5 * 60 * 1000,
    });
  }
  conversationObj.conversationId = responseGPT.conversationId;
  conversationObj.parentMessageId = responseGPT.id;

  await ctx.replyWithMarkdownV2(responseGPT.text, { reply_to_message_id: ctx.message.message_id, parse_mode: "Markdown" });
});

bot.catch(async (error, ctx) => {
  const msgError = `[ERROR] ${getCurrentDateTime()} | Lỗi xảy ra khi thực hiện request:`;
  console.log(msgError);
  console.log(error);
  await ctx.reply(msgError + "\n\n" + JSON.stringify(error), { reply_to_message_id: ctx.message.message_id });
});

// Enable graceful stop
process.once("SIGINT", () => {
  console.log("[INFO] " + getCurrentDateTime() + " | APP IS CLOSING");
  bot.telegram.sendMessage(MY_HANDLER_GROUP, "`" + "APP IS CLOSING, I WILL BE OFFLINE AFTER THIS MESSAGE" + "`", { parse_mode: "Markdown" });
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.log("[INFO] " + getCurrentDateTime() + " | APP IS CLOSING");
  bot.telegram.sendMessage(MY_HANDLER_GROUP, "`" + "APP IS CLOSING, I WILL BE OFFLINE AFTER THIS MESSAGE" + "`", { parse_mode: "Markdown" });
  bot.stop("SIGTERM");
});
