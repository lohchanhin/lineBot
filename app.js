require('dotenv').config();

const line = require('@line/bot-sdk');
const express = require('express');
const openai = require('openai');

// Configure OpenAI API client
openai.apiKey = process.env.OPENAI_API_KEY;

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.Client(config);

// create Express app
const app = express();

app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  // Get a response from OpenAI Chat API
  const openaiResponse = await openai.ChatCompletion.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: event.message.text },
    ],
    max_tokens: 50,
  });

  // Extract the assistant's reply from the API response
  const assistantReply = openaiResponse.choices[0].message.content;

  // Create a text message with the assistant's reply
  const reply = { type: 'text', text: assistantReply };

  // Use reply API to send the message
  return client.replyMessage(event.replyToken, reply);
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
