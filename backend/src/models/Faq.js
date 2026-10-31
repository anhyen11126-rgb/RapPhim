import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['ALL', 'TICKET_CINEMA', 'PAYMENT', 'MEMBERSHIP'],
      default: 'TICKET_CINEMA',
      index: true,
    },
    likes: {
      type: Number,
      default: 120,
    },
    dislikes: {
      type: Number,
      default: 2,
    },
    isDefaultOpen: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        return ret;
      },
    },
  }
);

const Faq = mongoose.models.Faq || mongoose.model('Faq', faqSchema);
export default Faq;
