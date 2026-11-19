# 07. Database and Application Integration Evidence

**Project:** CareerCompass — Secondary School Guidance Platform
**Component:** Data Engineering Deliverable #7
**Author:** Aradhya Tiwari (Data Engineering Lead)

---

## 1. Integration Architecture & Data Flow

The CareerCompass backend implements an enterprise-grade **Layered Repository Pattern** separating HTTP routing, validation, business orchestration, and database persistence.

```
+-----------------------------------------------------------------------------------+
|                                REQUEST LIFECYCLE                                  |
+-----------------------------------------------------------------------------------+
  HTTP Request (e.g. POST /api/v1/bookings)
      │
      ▼
  [Route & Middleware Layer]  ──> authenticate.js, rbac.js, rate-limit.js
      │
      ▼
  [Controller Layer]          ──> platform.controller.js (parses parameters & runs async handler)
      │
      ▼
  [Service Layer]             ──> platform.service.js (Zod schema validation & domain invariants)
      │
      ▼
  [Repository Layer]          ──> platform.repository.js (Prisma ORM & Raw SQL interactive tx)
      │
      ▼
  [Database Engines]          ──> PostgreSQL 16 (Tables) & MongoDB 6+ (Guidance Collections)
```

---

## 2. Actual Implementation Code Evidence

### Evidence A: Atomic Concurrency-Safe Booking Transaction (Prisma + Raw SQL)
*File:* `backend/src/repositories/platform.repository.js`

To eliminate race conditions when booking an appointment, the repository executes an interactive transaction (`tx.$transaction`) combining raw atomic row-locking with typed entity creation and transactional outbox recording:

```javascript
// Excerpt from backend/src/repositories/platform.repository.js
async createBooking({ studentId, slotId, note }) {
  try {
    return await this.dbClient.$transaction(async (tx) => {
      // 1. Atomic conditional update: Locks and flips status only if currently AVAILABLE
      const updated = await tx.$executeRaw`
        UPDATE availability_slots
        SET status = 'BOOKED'
        WHERE id = ${slotId}::uuid AND status = 'AVAILABLE'
      `;
      if (updated !== 1) {
        throw new AppError('CONFLICT', 'Slot is unavailable', 409, [
          { field: 'slotId', issue: 'SLOT_UNAVAILABLE' }
        ]);
      }

      // 2. Fetch locked slot details
      const slot = await tx.availabilitySlot.findUnique({ where: { id: slotId } });
      if (!slot || slot.startsAt <= new Date()) {
        throw new AppError('CONFLICT', 'Slot is unavailable', 409);
      }

      // 3. Create confirmed booking record
      const booking = await tx.booking.create({
        data: { studentId, counsellorId: slot.counsellorId, slotId, note },
        include: { slot: true },
      });

      // 4. Enqueue confirmation notification in transactional outbox
      await tx.emailOutbox.create({
        data: {
          eventType: 'BOOKING_CREATED',
          payload: { bookingId: booking.id, studentId, counsellorId: slot.counsellorId },
          idempotencyKey: booking.id,
        },
      });

      return mapBooking(booking);
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error?.code === 'P2002') throw new AppError('CONFLICT', 'Slot is unavailable', 409);
    throw error;
  }
}
```

---

### Evidence B: Assessment Answer Upsert & Dimension Recommendation Persistence
*File:* `backend/src/repositories/assessment.repository.adapter.js`

When a student answers a question, the backend performs an atomic upsert to maintain in-progress persistence. Upon submission, mathematical recommendation scores are recorded in the relational schema:

```javascript
// Excerpt from backend/src/repositories/assessment.repository.adapter.js
async saveAnswer({ studentId, attemptId, questionId, selectedOptionId }) {
  assertDelegate(this.dbClient, 'answer');
  try {
    const question = await this.dbClient.question.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new AppError('NOT_FOUND', 'Question not found', 404);

    const options = Array.isArray(question.options) ? question.options : [];
    const option = options.find((o) => o.id === selectedOptionId);
    if (!option) throw new AppError('VALIDATION_ERROR', 'Invalid option selected', 422);

    // Upsert ensures answering or re-answering is idempotent
    return await this.dbClient.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: {
        attemptId,
        questionId,
        selectedOptionId,
        score: option.score,
      },
      update: {
        selectedOptionId,
        score: option.score,
        answeredAt: new Date(),
      },
    });
  } catch (error) {
    mapDatabaseError(error, 'saveAnswer');
  }
}
```

---

### Evidence C: MongoDB Resilience & Fault-Tolerant Chat Session Lifecycle
*File:* `backend/src/repositories/guidance.repository.js`

The MongoDB connection pool enforces a strict 2000ms server selection timeout. If MongoDB experiences an outage, it throws a typed `DB_UNAVAILABLE` error, allowing the rest of the application to function:

```javascript
// Excerpt from backend/src/repositories/guidance.repository.js
async connect() {
  if (this.model) return this.model;
  if (!this.uri) throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);

  if (!this.connectionPromise) {
    this.connectionPromise = this.mongoose.connect(this.uri, {
      dbName: this.dbName || undefined,
      serverSelectionTimeoutMS: 2000, // Fast failure fail-safe
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

async appendMessage({ studentId, sessionId, message }) {
  const model = await this.connect();
  const result = await model.findOneAndUpdate(
    { studentId, sessionId },
    { $push: { messages: message } }, // Atomic array append
    { new: true }
  ).lean();
  if (!result) throw new AppError('NOT_FOUND', 'Guidance session not found', 404);
  return mapSession(result);
}
```

---

## 3. UI-Database Reflection Verification

Data entered through the frontend is immediately reflected in database state:
1. **User Profile & Consent:** When a student logs in and accepts the NEP 2020 guidance charter, `student_profiles.consent_accepted` is updated to `TRUE`.
2. **Assessment Stepper:** Selecting an option immediately triggers `PUT /attempts/:id/answers/:questionId`, writing the answer to PostgreSQL and enabling cross-device resumption.
3. **Appointment Lifecycle:** Booking a slot transitions `availability_slots.status` from `'AVAILABLE'` to `'BOOKED'` in real-time, instantly disabling the booking button for competing users in the React client.
