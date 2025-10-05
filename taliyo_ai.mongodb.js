/* global use, db */

// 1) Select DB (created on first write)
use('taliyo_ai');

// 2) Ensure collections
db.createCollection('conversations');
db.createCollection('messages');

// 3) Indexes expected by backend ([chat_repo.py](cci:7://file:///d:/Taliyo%20Tech/sample/Taliyo%20Ai/taliyo-ai/backend/app/repositories/chat_repo.py:0:0-0:0))
db.conversations.createIndex({ updated_at: -1 }, { name: 'updated_at_desc' });
db.messages.createIndex({ conversation_id: 1 }, { name: 'by_conv' });
db.messages.createIndex({ conversation_id: 1, created_at: 1 }, { name: 'by_conv_created' });

// 4) Seed data if empty
if (db.conversations.countDocuments() === 0) {
  const now = new Date();
  const { insertedId } = db.conversations.insertOne({
    title: 'First conversation',
    created_at: now,
    updated_at: now,
  });
  db.messages.insertMany([
    { conversation_id: insertedId, role: 'user', content: 'Hello', created_at: now },
    { conversation_id: insertedId, role: 'assistant', content: 'Hi! 👋', created_at: now },
  ]);
  console.log('Seeded conversation:', insertedId.toString());
}

// 5) Quick verify (return data to the Result pane)
({
  collections: db.getCollectionInfos().map(i => i.name),
  conversations: db.conversations.find().limit(3).toArray(),
  messages: db.messages.find().limit(3).toArray()
})