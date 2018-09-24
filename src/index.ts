require("dotenv").config();

import * as TelegramBot from "node-telegram-bot-api";
import * as Octo from "@octokit/rest";

const octokit = new Octo();

import {
  getRandomReplies,
  storeCandidate,
  getCandidates,
  getReply,
  Replies,
  Tree,
  Candidates,
  Candidate
} from "./train";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN as string;
const GIST_ID = process.env.GIST_ID as string;
const REPLIES_GIST_ID = process.env.REPLIES_GIST_ID as string;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN as string;
const POLL_TIME = parseInt(process.env.POLL_TIME as string, 10);

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

type Options = Array<{ text: string; points: number }>;

async function askForCandidate(
  fromId: number,
  candidates: Candidates,
  replies: Replies
): Promise<Candidate> {
  function getReplyMarkup(options: Options) {
    return {
      inline_keyboard: options.map(({ text, points }, i) => [
        {
          text: `${text} ${points > 0 ? `(${points})` : ""}`,
          callback_data: i.toString()
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
      } as TelegramBot.InlineKeyboardMarkup
    }
  );

  return new Promise<string>(resolve => {
    const listener = async (callbackQuery: TelegramBot.CallbackQuery) => {
      const selectedOptionData = callbackQuery.data as string;
      const input = selectedOptionData.trim().toLowerCase();

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
      await bot.deleteMessage(fromId, sentMessage.message_id.toString());

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

function getMessage(): Promise<{
  message: string;
  from: number;
  isPrivate: boolean;
}> {
  return new Promise(resolve => {
    const listener = (msg: TelegramBot.Message) => {
      if (!msg.text) {
        return;
      }

      const hasPrefix = msg.text.indexOf("!olli ") === 0;
      const isPrivate = !hasPrefix;

      if (isPrivate || hasPrefix) {
        resolve({
          message: msg.text.replace("!olli ", ""),
          from: msg.chat.id,
          isPrivate
        });

        bot.removeListener("message", listener);
      }
    };
    bot.on("message", listener);
  });
}

async function loop(tree: Tree, replies: Replies) {
  const { message, from, isPrivate } = await getMessage();

  if (isPrivate) {
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
    } as any // TODO
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
