const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const {
  loadFile,
  getRandomReplies,
  storeCandidate,
  persistTree,
  getCandidates,
  getReply
} = require("./train");
// replace the value below with the Telegram token you receive from @BotFather
const token = "";

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

async function askForCandidate(fromId, candidates) {
  const options = candidates.map((candidate, i) => [
    {
      text: candidate,
      callback_data: i
    }
  ]);

  const opts = {
    reply_markup: {
      inline_keyboard: [
        ...options,
        [{ text: "Get a new random selection", callback_data: "r" }]
      ]
    }
  };

  const sentMessage = await bot.sendMessage(
    fromId,
    "Mikä olis bestest vastaus?",
    opts
  );

  return new Promise(resolve => {
    const listener = async callbackQuery => {
      await bot.deleteMessage(fromId, sentMessage.message_id);
      const input = callbackQuery.data.trim().toLowerCase();

      if (input === "r") {
        bot.removeListener("callback_query", listener);
        const candi = await askForCandidate(fromId, getRandomReplies());
        return resolve(candi);
      }

      const number = parseInt(input, 10);
      bot.sendMessage(
        fromId,
        "Gotcha 👍 " + "tästä eteenpäin tohon vastataan: " + candidates[number]
      );
      bot.removeListener("callback_query", listener);
      resolve(candidates[number]);
    };
    bot.on("callback_query", listener);
  });
}

function getMessage() {
  return new Promise(resolve => {
    const listener = msg => {
      const hasPrefix = msg.text.indexOf("!olli ") === 0;
      const privateChat = msg.chat.type === "private" && !hasPrefix;

      if (privateChat || hasPrefix) {
        resolve({
          message: msg.text.replace("!olli ", ""),
          from: msg.chat.id,
          private: privateChat
        });
        bot.removeListener(listener);
      }
    };
    bot.on("message", listener);
  });
}

async function loop(tree) {
  const { message, from, private } = await getMessage();

  if (private) {
    await bot.sendMessage(from, getReply(tree, message));

    loop(tree);
    return;
  }

  const candidates = getCandidates(tree, message);

  await bot.sendMessage(from, candidates[0]);
  const candidate = await askForCandidate(from, candidates);

  const newTree = storeCandidate(tree, message, candidate);

  persistTree(newTree);
  loop(newTree);
}

loop(loadFile());
