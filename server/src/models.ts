import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    firebaseUid: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const User = mongoose.model('User', userSchema);

const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
});
export const Session = mongoose.model('Session', sessionSchema);

const inputsSchema = new Schema(
  {
    L: { type: Number, default: 6 },
    W: { type: Number, default: 4 },
    stack: { type: Number, default: 8 },
    layout: { type: String, default: 'standard' },
    floor: { type: Number, default: 12 },
    budget: { type: Number, default: 4000 },
    basement: { type: Boolean, default: true },
    vent: { type: Boolean, default: false },
    permit: { type: Boolean, default: false },
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, default: 'Philly rowhouse half bath' },
    inputs: { type: inputsSchema, default: () => ({}) },
    owned: { type: Map, of: Boolean, default: {} },
    doneTaskIds: { type: [String], default: [] },
    log: { type: [String], default: ['Project created'] },
  },
  { timestamps: true },
);
export const Project = mongoose.model('Project', projectSchema);
export type ProjectDoc = InferSchemaType<typeof projectSchema>;
