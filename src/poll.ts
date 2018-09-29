import * as TelegramBot from 'node-telegram-bot-api';
import { Candidates, Replies, Candidate, getRandomReplies } from './candidate';

type Options = Array<{ text: string; points: number }>;

const POLL_TIME = parseInt(process.env.POLL_TIME as string, 10);

export type MessageWithText = TelegramBot.Message & { text: string };

export function isTrainingMessage(message: MessageWithText) {
  return message.text.indexOf('!olli ') === 0;
}

export function removeTrainingCommandPrefix(text: string) {
  return text.replace('!olli ', '');
}

function createPollButtons(options: Options) {
  return {
    inline_keyboard: [
      ...options.map(({ text, points }, i) => [
        {
          text: `${text} ${points > 0 ? `(${points})` : ''}`,
          callback_data: i.toString(),
        },
      ]),
      MORE_BUTTON,
    ],
  };
}

const MORE_BUTTON = [{ text: '➕ Lisää', callback_data: 'more' }];
export async function pollForBestCandidate(
  bot: TelegramBot,
  chatId: number,
  candidates: Candidates,
  replies: Replies,
): Promise<Candidate> {
  // Value changes every time a candidate is selected by someone
  let pollOptions = candidates.map(text => ({ text, points: 0 }));

  const pollButtons = createPollButtons(pollOptions);

  const getPollTitle = (timeLeft: number) =>
    `Mikä olis bestest vastaus? (${Math.floor(timeLeft / 1000)}s vastausaikaa)`;

  const titleMessage = await bot.sendMessage(chatId, getPollTitle(POLL_TIME));
  const buttonMessage = await bot.sendMessage(chatId, 'Vaihtoehdot:', {
    reply_markup: pollButtons,
  });

  const rerenderText = (timeLeft: number) =>
    bot.editMessageText(getPollTitle(timeLeft), {
      chat_id: chatId,
      message_id: titleMessage.message_id,
    });

  const rerenderButtons = () =>
    bot.editMessageReplyMarkup(createPollButtons(pollOptions), {
      chat_id: chatId,
      message_id: buttonMessage.message_id,
    });

  return new Promise<string>(resolve => {
    function clear() {
      bot.removeListener('callback_query', listener);
      return Promise.all([
        bot.deleteMessage(chatId, titleMessage.message_id.toString()),
        bot.deleteMessage(chatId, buttonMessage.message_id.toString()),
      ]);
    }

    async function onceASecond(timeLeft: number) {
      if (timeLeft <= 0) {
        await clear();

        const topOption = pollOptions.reduce(
          (best, option) => (option.points > best.points ? option : best),
        );
        const topScore = topOption.points;

        const allWithTopScore = pollOptions.filter(
          ({ points }) => points === topScore,
        );
        const result =
          allWithTopScore[Math.floor(Math.random() * allWithTopScore.length)];

        return resolve(result.text);
      }

      await rerenderText(timeLeft - 1000);
      setTimeout(() => onceASecond(timeLeft - 1000), 1000);
    }

    let firstAnswerReceived = false;

    const listener = async (callbackQuery: TelegramBot.CallbackQuery) => {
      if (chatId !== (callbackQuery.message && callbackQuery.message.chat.id)) {
        return;
      }

      const selectedOptionData = callbackQuery.data as string;

      if (selectedOptionData === 'more') {
        pollOptions = pollOptions.concat(
          getRandomReplies(replies).map(text => ({ text, points: 0 })),
        );
      } else {
        const num = parseInt(selectedOptionData, 10);
        pollOptions[num].points++;

        if (!firstAnswerReceived) {
          firstAnswerReceived = true;
          onceASecond(POLL_TIME);
        }
      }

      await rerenderButtons();
    };

    bot.on('callback_query', listener);
  });
}
