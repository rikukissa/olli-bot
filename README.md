# Conversational Telegram bot

This was made as a birthday present for one of our dear friends. The idea is pretty simple: 
A chatbot that can mimic the way he communicates in Telegram. 

We started with a deep learning model, but it turned out that training it to output anything half decent would've taken ages, 
so we quickly switched to a more simplistic approach: A decision tree based on the words in the received messages.

The example model would look something like this:

```js
{
  hello: [['Well hello there!'], {
    world: [['👋'], {}]
  }],
  what: [[], {
   time: [[], {
     is: [[], {
       it: [['16:34'], {}]
     }]
   },
   a: [[], {
     day: [['Tell me about it..'], {}] 
   }]]
  }]
}
```

so a recursive type

```typescript
type Answer = string
type Word = string
type Model = [
  Answer[],
  {
    [key: Word]: Model;
  }
];
```

It worked ~fairly well after some manual training few days prior the great release.
