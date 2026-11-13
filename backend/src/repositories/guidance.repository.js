import mongoose from 'mongoose';
import { AppError } from '../utils/app-error.js';

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  text: { type: String, required: true, maxlength: 2000 },
  groundingCareerIds: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const guidanceSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  studentId: { type: String, required: true, index: true },
  attemptId: { type: String, required: true },
  careerIds: { type: [String], required: true },
  messages: { type: [messageSchema], default: [] },
  model: { type: String, required: true },
  consentVersion: { type: String, required: true, default: 'v1' },
}, { timestamps: true, collection: 'guidance_sessions' });

guidanceSessionSchema.index({ studentId: 1, updatedAt: -1 });

const mapSession = (session) => ({
  sessionId: session.sessionId,
  attemptId: session.attemptId,
  careerIds: session.careerIds,
  messages: session.messages || [],
  model: session.model,
  consentVersion: session.consentVersion,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

export class GuidanceRepository {
  constructor({ uri, dbName, model = null, mongooseInstance = mongoose, retentionDays = 180 } = {}) {
    this.uri = uri;
    this.dbName = dbName;
    this.mongoose = mongooseInstance;
    this.model = model;
    this.retentionDays = retentionDays;
    this.connectionPromise = null;
  }

  async connect() {
    if (this.model) return this.model;
    if (!this.uri) throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);
    if (!this.connectionPromise) {
      this.connectionPromise = this.mongoose.connect(this.uri, {
        dbName: this.dbName || undefined,
        serverSelectionTimeoutMS: 2000,
      }).then(() => {
        this.model = this.mongoose.models.GuidanceSession ||
          this.mongoose.model('GuidanceSession', guidanceSessionSchema);
        return this.model;
      }).catch(() => {
        this.connectionPromise = null;
        throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);
      });
    }
    return this.connectionPromise;
  }

  async purgeExpired(model) {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    await model.deleteMany({ updatedAt: { $lt: cutoff } });
  }

  async create({ studentId, attemptId, careerIds, modelName }) {
    const model = await this.connect();
    try {
      await this.purgeExpired(model);
      const session = await model.create({
        sessionId: new mongoose.Types.ObjectId().toString(),
        studentId,
        attemptId,
        careerIds,
        model: modelName,
      });
      return mapSession(session);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);
    }
  }

  async list({ studentId, page = 1, limit = 20 }) {
    const model = await this.connect();
    try {
      await this.purgeExpired(model);
      const [sessions, total] = await Promise.all([
        model.find({ studentId }).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        model.countDocuments({ studentId }),
      ]);
      return {
        data: sessions.map(mapSession),
        meta: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 },
      };
    } catch {
      throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);
    }
  }

  async get({ studentId, sessionId }) {
    const model = await this.connect();
    try {
      await this.purgeExpired(model);
      const session = await model.findOne({ studentId, sessionId }).lean();
      if (!session) throw new AppError('NOT_FOUND', 'Guidance session not found', 404);
      return mapSession(session);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);
    }
  }

  async appendMessages({ studentId, sessionId, messages }) {
    const model = await this.connect();
    try {
      const session = await model.findOneAndUpdate(
        { studentId, sessionId },
        { $push: { messages: { $each: messages, $slice: -20 } } },
        { new: true, lean: true },
      );
      if (!session) throw new AppError('NOT_FOUND', 'Guidance session not found', 404);
      return mapSession(session);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);
    }
  }

  async remove({ studentId, sessionId }) {
    const model = await this.connect();
    try {
      const result = await model.deleteOne({ studentId, sessionId });
      if (result.deletedCount === 0) {
        throw new AppError('NOT_FOUND', 'Guidance session not found', 404);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);
    }
  }
}

export { guidanceSessionSchema };
