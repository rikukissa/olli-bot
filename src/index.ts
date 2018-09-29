import * as dotenv from 'dotenv';
dotenv.config();

import * as TelegramBot from 'node-telegram-bot-api';
import * as Levenshtein from 'levenshtein';
import { merge } from 'lodash';
import { greetings, emojis, greetingTo } from './greetings';

import {
  storeCandidate,
  getCandidates,
  getBestMatchingCandidate,
  Replies,
  Model,
} from './candidate';
import { storeModel, getReplies, getModel } from './storage';
import {
  pollForBestCandidate,
  MessageWithText,
  isTrainingMessage,
  removeTrainingCommandPrefix,
} from './poll';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN as string;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

function waitForChannelMessage(chatId: number) {
  return new Promise<TelegramBot.Message>(resolve => {
    const handler = (message: TelegramBot.Message) => {
      if (message.chat.id === chatId) {
        bot.removeListener('message', handler);
        resolve(message);
      }
    };
    bot.on('message', handler);
  });
}

function wait(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
}

function resemblesMeaningOfLife(message: string): boolean {
  const { distance } = new Levenshtein(message, 'mikä on elämän tarkoitus');

  return distance < 3;
}
function resemblesGreetings(message: string): string[] {
  return greetings.filter(greeting => {
    const { distance } = new Levenshtein(message, greeting);
    return distance < 2;
  });
}

function constructGreeting() {
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  const to = greetingTo[Math.floor(Math.random() * greetingTo.length)];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];

  if (to === '' && emoji === '') {
    return `${greeting}!!`;
  }

  if (to === '') {
    return `${greeting} ${emoji}${emoji}`;
  }

  return `${greeting} ${to} ${emoji}`;
}

async function sendBestMatchingCandidate(
  model: Model,
  replies: Replies,
  message: MessageWithText,
  chatId: number,
): Promise<Model> {
  await wait(Math.random() * 2000);
  await bot.sendChatAction(chatId, 'typing');

  const matchingGreetings = resemblesGreetings(message.text);

  if (matchingGreetings.length > 0) {
    const randomizedGreeting = constructGreeting();

    await wait(Math.random() * 4000 + randomizedGreeting.length * 300);
    await bot.sendMessage(chatId, randomizedGreeting);

    return model;
  }

  if (resemblesMeaningOfLife(message.text)) {
    await bot.sendMessage(chatId, '42');
    await wait(1800);
    await bot.sendMessage(chatId, 'ja rööki :D');

    return model;
  }

  const candidate = getBestMatchingCandidate(model, replies, message.text);
  await wait(Math.random() * 4000 + candidate.length * 300);

  await bot.sendMessage(chatId, candidate);
  return model;
}

async function handleMessage(
  model: Model,
  replies: Replies,
  message: MessageWithText,
  chatId: number,
): Promise<Model> {
  if (!message.text) {
    return model;
  }

  if (!isTrainingMessage(message)) {
    await sendBestMatchingCandidate(model, replies, message, chatId);
    return model;
  }

  const text = removeTrainingCommandPrefix(message.text);

  const candidates = getCandidates(model, text, replies).slice(0, 5);
  const candidateWithHighestScore = candidates[0];

  const candidate = await pollForBestCandidate(
    bot,
    chatId,
    candidates,
    replies,
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
      chatId,
    );

    // Many running chats can modify the "global" messages model
    model = merge(model, newModel);

    storeModel(model);
    messageLoop(chatId);
  }

  bot.on('message', (message: TelegramBot.Message) => {
    const channelLoopAlreadyRunning =
      knownChannels.indexOf(message.chat.id) > -1;

    if (channelLoopAlreadyRunning) {
      return;
    }

    knownChannels.push(message.chat.id);

    if (message.text === '/start') {
      messageLoop(message.chat.id);
      return;
    }

    messageLoop(message.chat.id, message);
  });
}

runBot();
