require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Listen for new messages
function listenToMessages(conversationId) {
  const subscription = supabase
    .channel('messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        console.log('New message:', payload.new);
      }
    )
    .subscribe();

  return subscription;
}
/*
// Example
const conversationId = 'your-conversation-id-here';
listenToMessages(conversationId);

console.log('Listening for messages...');
*/