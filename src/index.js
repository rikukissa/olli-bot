const TelegramBot = require("node-telegram-bot-api");

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
  function getReplyMarkup(options) {
    return {
      inline_keyboard: options.map(({ text, points }, i) => [
        {
          text: `${text} ${points > 0 ? `(${points})` : ""}`,
          callback_data: i
        }
      ])
    };
  }

  let options = candidates.map(text => ({ text, points: 0 }));

  const markup = getReplyMarkup(options);

  const sentMessage = await bot.sendMessage(
    fromId,
    "Mikä olis bestest vastaus?",
    {
      reply_markup: {
        ...markup,
        inline_keyboard: [
          ...markup.inline_keyboard,
          [{ text: "➕ MORE", callback_data: "more" }]
        ]
      }
    }
  );

  return new Promise(resolve => {
    const listener = async callbackQuery => {
      const input = callbackQuery.data.trim().toLowerCase();

      if (input === "more") {
        options = options.concat(
          getRandomReplies().map(text => ({ text, points: 0 }))
        );
        bot.editMessageReplyMarkup(getReplyMarkup(options), {
          chat_id: fromId,
          message_id: sentMessage.message_id
        });
        return;
      }

      const number = parseInt(input, 10);

      options[number].points++;

      bot.editMessageReplyMarkup(getReplyMarkup(options), {
        chat_id: fromId,
        message_id: sentMessage.message_id
      });
    };

    bot.on("callback_query", listener);
    setTimeout(async () => {
      bot.removeListener("callback_query", listener);
      await bot.deleteMessage(fromId, sentMessage.message_id);

      const topOption = options.reduce(
        (best, option) => (option.points > best.points ? option : best)
      );
      const topScore = topOption.points;

      const allWithTopScore = options.filter(
        ({ points }) => points === topScore
      );
      const result =
        allWithTopScore[Math.floor(Math.random() * allWithTopScore.length)];

      resolve(result.text);
    }, 20000);
  });
}

function getMessage() {
  return new Promise(resolve => {
    const listener = msg => {
      const hasPrefix = msg.text.indexOf("!olli ") === 0;
      const privateChat = !hasPrefix;

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
    await bot.sendChatAction(from, "typing");
    await bot.sendMessage(from, getReply(tree, message));

    loop(tree);
    return;
  }

  const candidates = getCandidates(tree, message);

  const sentMessage = await bot.sendMessage(from, candidates[0]);
  const candidate = await askForCandidate(from, candidates);

  try {
    await bot.editMessageText(candidate, {
      chat_id: from,
      message_id: sentMessage.message_id
    });
  } catch (err) {}

  const newTree = storeCandidate(tree, message, candidate);

  persistTree(newTree);
  loop(newTree);
}

loop(loadFile());
