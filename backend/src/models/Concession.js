import mongoose from 'mongoose';

const concessionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'COMBO',
    },
    badge: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.image = ret.image || ret.imageUrl || '';
        ret.imageUrl = ret.imageUrl || ret.image || '';
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.image = ret.image || ret.imageUrl || '';
        ret.imageUrl = ret.imageUrl || ret.image || '';
        return ret;
      },
    },
  }
);

const Concession = mongoose.models.Concession || mongoose.model('Concession', concessionSchema);
export default Concession;

