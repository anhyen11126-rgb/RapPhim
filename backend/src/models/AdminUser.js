import mongoose from 'mongoose';

const adminUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      default: 'Ban Quản Trị',
    },
    role: {
      type: String,
      default: 'ADMIN',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.password;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.password;
        return ret;
      },
    },
  }
);

const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema);
export default AdminUser;
