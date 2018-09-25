import * as TelegramBot from "node-telegram-bot-api";
import { Candidates, Replies, Candidate, getRandomReplies } from "./candidate";

type Options = Array<{ text: string; points: number }>;

const POLL_TIME = parseInt(process.env.POLL_TIME as string, 10);

export type MessageWithText = TelegramBot.Message & { text: string };

export function isTrainingMessage(message: MessageWithText) {
  return message.text.indexOf("!olli ") === 0;
}

export function removeTrainingCommandPrefix(text: string) {
  return text.replace("!olli ", "");
}

function createPollButtons(options: Options) {
  return {
    inline_keyboard: options.map(({ text, points }, i) => [
      {
        text: `${text} ${points > 0 ? `(${points})` : ""}`,
        callback_data: i.toString()
      }
    ])
  };
}

export async function pollForBestCandidate(
  bot: TelegramBot,
  channelId: number,
  candidates: Candidates,
  replies: Replies
): Promise<Candidate> {
  // Value changes every time a candidate is selected by someone
  let pollOptions = candidates.map(text => ({ text, points: 0 }));

  const pollButtons = createPollButtons(pollOptions);

  const sentMessage = await bot.sendMessage(
    channelId,
    "Mikä olis bestest vastaus?",
    {
      reply_markup: {
        ...pollButtons,
        inline_keyboard: [
          ...pollButtons.inline_keyboard,
          [{ text: "➕ MORE", callback_data: "more" }]
        ]
      }
    }
  );

  const rerenderButtons = () =>
    bot.editMessageReplyMarkup(createPollButtons(pollOptions), {
      chat_id: channelId,
      message_id: sentMessage.message_id
    });

  const listener = async (callbackQuery: TelegramBot.CallbackQuery) => {
    const selectedOptionData = callbackQuery.data as string;

    if (selectedOptionData === "more") {
      pollOptions = pollOptions.concat(
        getRandomReplies(replies).map(text => ({ text, points: 0 }))
      );
      rerenderButtons();
      return;
    }

    const number = parseInt(selectedOptionData, 10);
    pollOptions[number].points++;

    rerenderButtons();
  };

  bot.on("callback_query", listener);

  return new Promise<string>(resolve => {
    setTimeout(async () => {
      bot.removeListener("callback_query", listener);
      await bot.deleteMessage(channelId, sentMessage.message_id.toString());

      const topOption = pollOptions.reduce(
        (best, option) => (option.points > best.points ? option : best)
      );
      const topScore = topOption.points;

      const allWithTopScore = pollOptions.filter(
        ({ points }) => points === topScore
      );
      const result =
        allWithTopScore[Math.floor(Math.random() * allWithTopScore.length)];

      resolve(result.text);
    }, POLL_TIME);
  });
}
