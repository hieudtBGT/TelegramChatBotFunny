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
const apiGPT = new ChatGPTAPI({ apiKey: process.env.OPENAI_API_KEY });

// Tracking conversation
let responseGPT;

// Handle anonymous object
function warningMessageToActiveGroup(unkndownObject, content) {
  let msgToActiveGroup = "`" + "[Unknown Request]" + "`" + "\n";

  for (const key in unkndownObject) {
    msgToActiveGroup += "*" + key + "*" + ": " + unkndownObject[key] + "\n";
  }

  msgToActiveGroup += "\n" + "*Command:*" + "\n" + content;
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
// create typing animation
bot.use(async (ctx, next) => {
  await ctx.sendChatAction("typing");
  await next();
});

// get chatId
bot.command("myid", async (ctx) => {
  const currentChatId = ctx.message.chat.id;

  if (WHITE_LIST_CHAT_ID.includes(currentChatId.toString()) === false) {
    await ctx.telegram.sendMessage(MY_HANDLER_GROUP, warningMessageToActiveGroup(ctx.message.from, "/myid"), { parse_mode: "Markdown" });
    return;
  }

  await ctx.reply(`Hello ${ctx.message.from.username}, your chatId is ${currentChatId}`);
});

// send request to openApi - chatGPT
bot.command("q", async (ctx) => {
  const currentChatId = ctx.message.chat.id;

  if (WHITE_LIST_CHAT_ID.includes(currentChatId.toString()) === false) {
    await ctx.telegram.sendMessage(MY_HANDLER_GROUP, warningMessageToActiveGroup(ctx.message.from, ctx.message.text), { parse_mode: "Markdown" });
    return;
  }

  const command = ctx.message.text;
  const userQuestion = command.substring(command.indexOf("/q") + 2).trim();

  if (!userQuestion) {
    await ctx.reply("Vui lòng cung cấp nội dung cần hỏi sau lệnh /q. Ví dụ: /q Câu_hỏi.", { reply_to_message_id: ctx.message.message_id });
    return;
  }

  if (responseGPT) {
    console.log("[INFO] " + getCurrentDateTime() + " | Đang tracking cuộc trò chuyện");
    responseGPT = await apiGPT.sendMessage(userQuestion, {
      conversationId: responseGPT.conversationId,
      parentMessageId: responseGPT.id,
    });
  } else {
    console.log("[INFO] " + getCurrentDateTime() + " | Bắt đầu cuộc trò chuyện");
    responseGPT = await apiGPT.sendMessage(userQuestion);
  }

  await ctx.reply(responseGPT.text, { reply_to_message_id: ctx.message.message_id });
});

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

const interval = setInterval(() => {
  bot.telegram.sendMessage(MY_HANDLER_GROUP, "`" + "THIS IS A NOTIFICATION TO KEEP BOT ALIVE, EXECUTED EVERY 30 MINUTES." + "`", { parse_mode: "Markdown" });
}, 1000 * 60 * 30); // ping every 30 minutes

bot.catch(async (error, ctx) => {
  const msgError = `[ERROR] ${getCurrentDateTime()} | Lỗi xảy ra khi thực hiện request:`;
  console.log(msgError);
  console.log(error);
  await ctx.reply(msgError + "\n\n" + JSON.stringify(error), { reply_to_message_id: ctx.message.message_id });
});

// Enable graceful stop
process.once("SIGINT", () => {
  clearInterval(interval);
  console.log("[INFO] " + getCurrentDateTime() + " | APP IS CLOSING");
  bot.telegram.sendMessage(MY_HANDLER_GROUP, "`" + "APP IS CLOSING, I WILL BE OFFLINE AFTER THIS MESSAGE" + "`", { parse_mode: "Markdown" });
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  clearInterval(interval);
  console.log("[INFO] " + getCurrentDateTime() + " | APP IS CLOSING");
  bot.telegram.sendMessage(MY_HANDLER_GROUP, "`" + "APP IS CLOSING, I WILL BE OFFLINE AFTER THIS MESSAGE" + "`", { parse_mode: "Markdown" });
  bot.stop("SIGTERM");
});
