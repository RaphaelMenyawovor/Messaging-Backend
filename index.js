require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(express.json());
app.use(cors());

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Messaging API',
      version: '1.0.0'
    }
  },
  apis: ['./index.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const PORT = process.env.PORT || 3000;

// Get or create conversation between two users
async function getOrCreateConversation(user1, user2) {
  if (user1 > user2) [user1, user2] = [user2, user1];
  
  let { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('user1_id', user1)
    .eq('user2_id', user2)
    .single();
  
  if (!conv) {
    ({ data: conv } = await supabase
      .from('conversations')
      .insert({ user1_id: user1, user2_id: user2 })
      .select()
      .single());
  }
  
  return conv.id;
}

/**
 * @swagger
 * /messages:
 *   post:
 *     summary: Send message
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sender_id:
 *                 type: string
 *               receiver_id:
 *                 type: string
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent
 */
app.post('/messages', async (req, res) => {
  const { sender_id, receiver_id, text } = req.body;
  
  if (!sender_id || !receiver_id || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const conv_id = await getOrCreateConversation(sender_id, receiver_id);
    
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conv_id, sender_id, text })
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({ error: 'Failed to send message' });
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /messages/{conversation_id}:
 *   get:
 *     summary: Get messages
 *     parameters:
 *       - in: path
 *         name: conversation_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages
 */
app.get('/messages/:conversation_id', async (req, res) => {
  const { conversation_id } = req.params;
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation_id)
    .order('timestamp', { ascending: true });
  
  if (error) {
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
  
  res.json(data);
});

/**
 * @swagger
 * /conversations/{user_id}:
 *   get:
 *     summary: Get conversations
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversations
 */
app.get('/conversations/:user_id', async (req, res) => {
  const { user_id } = req.params;
  
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`)
    .order('created_at', { ascending: false });
  
  if (error) {
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
  
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API docs: http://localhost:${PORT}/api-docs`);
});