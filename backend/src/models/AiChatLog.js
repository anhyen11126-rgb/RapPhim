import mongoose from 'mongoose';

const aiChatLogSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      default: 'Khách vãng lai',
      trim: true,
    },
    userEmail: {
      type: String,
      default: '',
      trim: true,
    },
    userMessage: {
      type: String,
      required: true,
      trim: true,
    },
    botReply: {
      type: String,
      required: true,
    },
    intent: {
      type: String,
      default: 'GENERAL',
    },
    source: {
      type: String,
      default: 'DATABASE_RAG',
    },
    recommendedMovie: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.model('AiChatLog', aiChatLogSchema);

