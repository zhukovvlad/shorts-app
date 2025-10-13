# Stripe Payment Flow - Webhook & Manual Credit Addition

## Overview

The application uses a **dual-path** credit addition system with full idempotency guarantees:

1. **Webhook path** (production) - automatic, triggered by Stripe
2. **Manual API path** (development fallback) - explicit call from client

Both paths are **coordinated via `CreditTransaction` table** to prevent double-crediting.

---

## Architecture

### Shared Components

#### 1. `CreditTransaction` Table (Coordination Point)
```prisma
model CreditTransaction {
  id              String   @id @default(cuid())
  stripeSessionId String   @unique  // ← KEY: Prevents duplicates
  userId          String
  amount          Int
  type            String
  createdAt       DateTime @default(now())
}
```

The `stripeSessionId` unique constraint ensures **only one** credit addition per payment session, regardless of which path processes it.

#### 2. Credit Mapping (`lib/creditMapping.ts`)
- Single source of truth for credit amounts
- Environment variable support
- Used by both webhook and manual handler

---

## Flow Diagrams

### Scenario 1: Webhook Processes First ✅

```
User pays → Stripe → Webhook receives event
                      ↓
              Check CreditTransaction(sessionId)
                      ↓ (not found)
              Atomic Transaction:
                - Increment user.credits
                - Create CreditTransaction(sessionId)
                      ↓
              Return 200 OK
```

If manual API is later called with same sessionId:
```
Client → /api/stripe/add-credits
              ↓
      Check CreditTransaction(sessionId)
              ↓ (FOUND!)
      Return { success: true, creditsAdded: 0, message: "already added" }
```

**Result**: Credits added once ✅

---

### Scenario 2: Manual API Processes First ✅

```
User pays → Client → /api/stripe/add-credits
                      ↓
              Check CreditTransaction(sessionId)
                      ↓ (not found)
              Atomic Transaction:
                - Increment user.credits
                - Create CreditTransaction(sessionId)
                      ↓
              Return 200 OK
```

When webhook arrives later:
```
Stripe → Webhook receives event
              ↓
      Check CreditTransaction(sessionId)
              ↓ (FOUND!)
      Return 200 OK (silently skip)
```

**Result**: Credits added once ✅

---

### Scenario 3: Race Condition (Both Start Simultaneously) ✅

```
Webhook                          Manual API
   ↓                                ↓
Check CreditTransaction          Check CreditTransaction
   ↓ (not found)                    ↓ (not found)
Start Transaction                Start Transaction
   ↓                                ↓
Increment credits                Increment credits
   ↓                                ↓
Create CreditTransaction         Create CreditTransaction
   ↓ (SUCCESS)                      ↓ (P2002 ERROR!)
Return 200 OK                    Catch P2002 → Return 200 OK
```

**P2002 Handling:**
- Prisma throws unique constraint violation
- Catch block recognizes P2002 error code
- Fetch current user balance
- Return success response (credits already added by other path)

**Result**: Credits added once ✅

---

## Code Implementation

### Webhook Handler (`app/api/stripe/webhook/route.ts`)

```typescript
// 1. Check if already processed (idempotency)
const existing = await prisma.creditTransaction.findUnique({
    where: { stripeSessionId: sessionId },
});
if (existing) {
    return new Response('Ok', { status: 200 });
}

// 2. Atomic operation: credits + transaction record
try {
    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: { credits: { increment: creditsToAdd } },
        });
        await tx.creditTransaction.create({
            data: {
                stripeSessionId: sessionId,
                userId,
                amount: creditsToAdd,
                type: CreditTransactionType.CREDIT,
            },
        });
    });
} catch (transactionError: any) {
    // 3. Handle race condition
    if (transactionError.code === 'P2002') {
        return new Response('Ok', { status: 200 });
    }
    throw transactionError;
}
```

### Manual Handler (`app/api/stripe/add-credits/route.ts`)

```typescript
// 1. Check if already processed (idempotency)
const existingTransaction = await prisma.creditTransaction.findUnique({
    where: { stripeSessionId: sessionId }
});
if (existingTransaction) {
    return NextResponse.json({
        success: true,
        creditsAdded: 0,
        message: "Credits already added for this session"
    });
}

// 2. Atomic operation: credits + transaction record
try {
    const updatedUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
            where: { id: session.user.id },
            data: { credits: { increment: creditsToAdd } }
        });
        await tx.creditTransaction.create({
            data: {
                stripeSessionId: sessionId,
                userId: session.user.id,
                amount: creditsToAdd,
                type: CreditTransactionType.CREDIT
            }
        });
        return user;
    });
    
    return NextResponse.json({
        success: true,
        creditsAdded: creditsToAdd,
        newBalance: updatedUser.credits
    });
} catch (transactionError: any) {
    // 3. Handle race condition
    if (transactionError.code === 'P2002') {
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { credits: true }
        });
        return NextResponse.json({
            success: true,
            creditsAdded: 0,
            newBalance: currentUser?.credits,
            message: "Credits already added (concurrent request)"
        });
    }
    throw transactionError;
}
```

---

## Safety Guarantees

### 1. Idempotency (First Line of Defense)
- Both handlers check `CreditTransaction` table first
- If record exists → skip processing
- Handles most cases (Stripe retries, user refreshes)

### 2. Atomicity (Database Level)
- `prisma.$transaction()` ensures both operations succeed or fail together
- No partial state (credits without record, or record without credits)

### 3. Race Condition Handling (Second Line of Defense)
- Unique constraint on `stripeSessionId` at database level
- P2002 error caught and handled gracefully
- Window between check and create is protected

### 4. Coordination (Cross-Path)
- Webhook and manual API use **same table** for coordination
- `stripeSessionId` is the coordination key
- No matter which path wins, credits are added exactly once

---

## Testing Scenarios

### Manual Testing

1. **Webhook only** (production normal flow):
   - Pay via Stripe
   - Wait for webhook
   - Check credits added once ✅

2. **Manual API only** (development):
   - Pay via Stripe
   - Get sessionId from URL
   - Call `/api/stripe/add-credits`
   - Check credits added once ✅

3. **Manual API then webhook**:
   - Pay via Stripe
   - Call `/api/stripe/add-credits` immediately
   - Webhook arrives later
   - Check credits added once ✅

4. **Webhook then manual API**:
   - Pay via Stripe
   - Webhook processes
   - Try calling `/api/stripe/add-credits`
   - Should return "already added" message ✅

### Automated Tests

See:
- `lib/creditSystem.race.spec.ts` - Race condition documentation
- `lib/creditMapping.spec.ts` - Credit amount consistency

---

## Troubleshooting

### Credits not added?

1. Check webhook logs: `[webhook]` prefix
2. Check if `CreditTransaction` was created:
   ```sql
   SELECT * FROM "CreditTransaction" 
   WHERE "stripeSessionId" = 'cs_test_...';
   ```
3. Check user credits:
   ```sql
   SELECT credits FROM "User" WHERE id = '...';
   ```

### Double-crediting?

**Should be impossible** with current implementation. If it happens:

1. Check `CreditTransaction` table for duplicate `stripeSessionId`:
   ```sql
   SELECT "stripeSessionId", COUNT(*) 
   FROM "CreditTransaction" 
   GROUP BY "stripeSessionId" 
   HAVING COUNT(*) > 1;
   ```
   *(Should return no results)*

2. Check if unique constraint exists:
   ```sql
   SELECT * FROM pg_indexes 
   WHERE tablename = 'CreditTransaction' 
   AND indexname LIKE '%stripeSessionId%';
   ```

3. File a bug report with:
   - User ID
   - Stripe session ID
   - CreditTransaction records
   - Webhook logs
   - Manual API logs

---

## Summary

✅ **Both webhook and manual API create `CreditTransaction`**  
✅ **Coordination via unique `stripeSessionId` constraint**  
✅ **Idempotency at multiple levels**  
✅ **Race condition handling via P2002 catch**  
✅ **Credits added exactly once per payment**  

**Double-crediting is prevented by design.**
