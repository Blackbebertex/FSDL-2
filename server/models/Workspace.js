import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    semester: { type: String, required: true, trim: true, index: true },
    visibility: {
      type: String,
      enum: ['private', 'shared-readonly'],
      default: 'private',
    },
    shareToken: { type: String, default: null, index: true },
    auditTrail: {
      type: [
        {
          at: { type: Date, default: Date.now },
          actorId: { type: String, required: true },
          action: { type: String, required: true },
          details: { type: String, default: '' },
        },
      ],
      default: [],
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Workspace', workspaceSchema);
