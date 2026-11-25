import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminEmail: {
      type: String,
      default: '',
    },
    actionType: {
      type: String,
      enum: ['BULK_DELETE', 'SINGLE_DELETE', 'CANCEL_SHOWTIME', 'RECURRING_CREATE', 'BATCH_CREATE', 'UNDO_BATCH'],
      required: true,
      index: true,
    },
    requestId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    batchId: {
      type: String,
      default: null,
      index: true,
    },
    selectionScope: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    showtimeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Showtime',
      },
    ],
    deletedShowtimesInfo: [
      {
        showtimeId: String,
        movieTitle: String,
        roomName: String,
        startTime: Date,
        totalSeats: Number,
      },
    ],
    reason: {
      type: String,
      default: '',
    },
    resultSummary: {
      requestedCount: { type: Number, default: 0 },
      deletedCount: { type: Number, default: 0 },
      skippedCount: { type: Number, default: 0 },
      failedCount: { type: Number, default: 0 },
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
