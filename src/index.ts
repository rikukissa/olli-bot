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
import { promisifyCallback } from "./promisifyCallback";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN as string;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

function once<T>(event: string) {
  return promisifyCallback<T>(bot.once.bind(bot))(event);
}

async function sendBestMatchingCandidate(
  model: Model,
  replies: Replies,
  message: MessageWithText,
  channelId: number
): Promise<Model> {
  await bot.sendChatAction(channelId, "typing");
  await bot.sendMessage(
    channelId,
    getBestMatchingCandidate(model, replies, message.text)
  );
  return model;
}

async function handleMessage(
  model: Model,
  replies: Replies,
  message: MessageWithText,
  channelId: number
): Promise<Model> {
  if (!message.text) {
    return model;
  }

  if (!isTrainingMessage(message)) {
    await sendBestMatchingCandidate(model, replies, message, channelId);
    return model;
  }

  const text = removeTrainingCommandPrefix(message.text);

  const candidates = getCandidates(model, text, replies);
  const candidateWithHighestScore = candidates[0];

  const sentMessage = await bot.sendMessage(
    channelId,
    candidateWithHighestScore
  );
  const candidate = await pollForBestCandidate(
    bot,
    channelId,
    candidates,
    replies
  );

  if (candidateWithHighestScore !== candidate) {
    await bot.editMessageText(candidate, {
      chat_id: channelId,
      message_id: sentMessage.message_id
    });
  }

  return storeCandidate(model, text, candidate);
}

async function runBot() {
  let model = await getModel();
  const replies = await getReplies();
  const knownChannels: number[] = [];

  // Channel specific "process"
  async function messageLoop(channelId: number, message?: TelegramBot.Message) {
    const receivedMessage =
      message || (await once<TelegramBot.Message>("message"));

    if (!receivedMessage.text) {
      messageLoop(channelId);
      return;
    }
    const newModel = await handleMessage(
      model,
      replies,
      receivedMessage as MessageWithText,
      channelId
    );

    // Many running chats can modify the "global" messages model
    model = merge(model, newModel);

    storeModel(model);
    messageLoop(channelId);
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
