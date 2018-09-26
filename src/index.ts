require("dotenv").config();

import * as TelegramBot from "node-telegram-bot-api";
import { merge } from "lodash";

import {
  storeCandidate,
  getCandidates,
  getBestMatchingCandidate,
  Replies,
  Model
} from "./candidate";
import { storeModel, getReplies, getModel } from "./storage";
import {
  pollForBestCandidate,
  MessageWithText,
  isTrainingMessage,
  removeTrainingCommandPrefix
} from "./poll";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN as string;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

function waitForChannelMessage(chatId: number) {
  return new Promise<TelegramBot.Message>(resolve => {
    const handler = (message: TelegramBot.Message) => {
      if (message.chat.id === chatId) {
        bot.removeListener("message", handler);
        resolve(message);
      }
    };
    bot.on("message", handler);
  });
}

async function sendBestMatchingCandidate(
  model: Model,
  replies: Replies,
  message: MessageWithText,
  chatId: number
): Promise<Model> {
  await bot.sendChatAction(chatId, "typing");
  await bot.sendMessage(
    chatId,
    getBestMatchingCandidate(model, replies, message.text)
  );
  return model;
}

async function handleMessage(
  model: Model,
  replies: Replies,
  message: MessageWithText,
  chatId: number
): Promise<Model> {
  if (!message.text) {
    return model;
  }

  if (!isTrainingMessage(message)) {
    await sendBestMatchingCandidate(model, replies, message, chatId);
    return model;
  }

  const text = removeTrainingCommandPrefix(message.text);

  const candidates = getCandidates(model, text, replies);
  const candidateWithHighestScore = candidates[0];

  const candidate = await pollForBestCandidate(
    bot,
    chatId,
    candidates,
    replies
  );

  if (candidateWithHighestScore !== candidate) {
    await bot.sendMessage(chatId, candidate);
  }

  return storeCandidate(model, text, candidate);
}

async function runBot() {
  let model = await getModel();
  const replies = await getReplies();
  const knownChannels: number[] = [];

  // Channel specific "process"
  async function messageLoop(chatId: number, message?: TelegramBot.Message) {
    const receivedMessage = message || (await waitForChannelMessage(chatId));

    if (!receivedMessage.text) {
      messageLoop(chatId);
      return;
    }
    const newModel = await handleMessage(
      model,
      replies,
      receivedMessage as MessageWithText,
      chatId
    );

    // Many running chats can modify the "global" messages model
    model = merge(model, newModel);

    storeModel(model);
    messageLoop(chatId);
  }

  bot.on("message", (message: TelegramBot.Message) => {
    const channelLoopAlreadyRunning =
      knownChannels.indexOf(message.chat.id) > -1;

    if (channelLoopAlreadyRunning) {
      return;
    }

    knownChannels.push(message.chat.id);

    if (message.text === "/start") {
      messageLoop(message.chat.id);
      return;
    }

    messageLoop(message.chat.id, message);
  });
}

runBot();
