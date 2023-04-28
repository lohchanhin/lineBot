require('dotenv').config();

const line = require('@line/bot-sdk');
const express = require('express');
const { Configuration, OpenAIApi } = require('openai');

// 配置 LINE 令牌和密钥
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// 获取 OpenAI API 密钥
const apiKey2 = process.env.OPENAI_API_KEY;

// 创建 LINE 客户端
const client = new line.Client(config);
// 创建 Express 应用
const app = express();

// 存储用户会话的对象
const userConversations = {};

// 设置回调路由
app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// 定义事件处理函数
async function handleEvent(event) {
  // 如果事件类型不是消息或消息类型不是文本，则忽略
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  // 检查前两个字符是否是 "畫圖"
  if (event.message.text.slice(0, 2) === "畫圖") {
    const configuration = new Configuration({ apiKey: apiKey2 });
    const openai = new OpenAIApi(configuration);
    const response = await openai.createImage({
      prompt: event.message.text,
      n: 1,
      size: "1024x1024",
    });

    // 获取生成的图片链接
    const imageUrl = response.data.data[0].url;

    // 构造图片消息
    const imageMessage = {
      type: "image",
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    };

    // 使用 LINE API 发送图片消息
    return client.replyMessage(event.replyToken, imageMessage);
    
  }else{

    // 预设回复
  const presetReply = { type: 'text', text: '回答正在生成，請耐心等待...' };
  await client.replyMessage(event.replyToken, presetReply);

    // 获取用户 ID
  const userId = event.source.userId;
  // 如果不存在该用户的对话，为其创建一个
  if (!userConversations[userId]) {
    userConversations[userId] = [
      { role: 'system', content: '你是一個社工助手' }
    ];
  }

  // 将用户消息添加到会话中
  userConversations[userId].push({ role: 'user', content: event.message.text });

  // 如果会话长度超过 6 条消息，则删除最早的一条
  if (userConversations[userId].length > 4) {
    userConversations[userId].shift();
  }

  // 配置 OpenAI API
  const configuration = new Configuration({ apiKey: apiKey2 });
  const openai = new OpenAIApi(configuration);

  // 使用 OpenAI API 获取回复
  const openaiResponse = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: userConversations[userId] +'回答字數限制在1000內',
    max_tokens: 2000,
    temperature: 0.2
  });

  // 获取助手回复的文本
  const assistantReply = openaiResponse.data.choices[0].message.content;
  // 构造回复消息
  const reply = { type: 'text', text: assistantReply };

  // 将助手回复添加到会话中
  userConversations[userId].push({ role: 'assistant', content: assistantReply });

  // 使用 LINE API 回复用户
  return client.pushMessage(userId, reply);
  }
}

  

// 监听端口
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
