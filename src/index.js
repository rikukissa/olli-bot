require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const octokit = require("@octokit/rest")();

const {
  getRandomReplies,
  storeCandidate,
  getCandidates,
  getReply
} = require("./train");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GIST_ID = process.env.GIST_ID;
const REPLIES_GIST_ID = process.env.REPLIES_GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const POLL_TIME = process.env.POLL_TIME;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

async function askForCandidate(fromId, candidates, replies) {
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
          getRandomReplies(replies).map(text => ({ text, points: 0 }))
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
    }, POLL_TIME);
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

async function loop(tree, replies) {
  const { message, from, private } = await getMessage();

  if (private) {
    await bot.sendChatAction(from, "typing");
    await bot.sendMessage(from, getReply(tree, message, replies));

    loop(tree, replies);
    return;
  }

  const candidates = getCandidates(tree, message, replies);

  const sentMessage = await bot.sendMessage(from, candidates[0]);
  const candidate = await askForCandidate(from, candidates, replies);

  try {
    await bot.editMessageText(candidate, {
      chat_id: from,
      message_id: sentMessage.message_id
    });
  } catch (err) {}

  const newTree = storeCandidate(tree, message, candidate);

  await octokit.gists.edit({
    gist_id: GIST_ID,
    files: {
      "model.json": {
        filename: "model.json",
        content: JSON.stringify(newTree, null, 2)
      }
    }
  });

  loop(newTree, replies);
}

async function run() {
  await octokit.authenticate({
    type: "token",
    token: GITHUB_TOKEN
  });

  const modelGist = await octokit.gists.get({
    gist_id: GIST_ID
  });
  const repliesGist = await octokit.gists.get({
    gist_id: REPLIES_GIST_ID
  });

  const model = JSON.parse(modelGist.data.files["model.json"].content);
  const replies = JSON.parse(repliesGist.data.files["replies.json"].content);

  loop(model, replies);
}

run();
