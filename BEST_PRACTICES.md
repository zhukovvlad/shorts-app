# Development Best Practices

This guide outlines best practices for developing and maintaining the shorts-app codebase.

## Table of Contents

- [Code Style](#code-style)
- [TypeScript](#typescript)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Performance](#performance)
- [Security](#security)
- [Git Workflow](#git-workflow)

---

## Code Style

### General Principles

1. **Prefer readability over cleverness**
   ```typescript
   // ❌ Avoid
   const r = d.filter(v => v.p && !v.f).map(v => v.id);
   
   // ✅ Prefer
   const readyVideos = videos
     .filter(video => video.processing && !video.failed)
     .map(video => video.id);
   ```

2. **Use descriptive variable names**
   ```typescript
   // ❌ Avoid
   const t = Date.now();
   const d = 1000;
   
   // ✅ Prefer
   const currentTimestamp = Date.now();
   const delayInMilliseconds = 1000;
   ```

3. **Keep functions small and focused**
   - Each function should do one thing well
   - If a function is > 50 lines, consider splitting it
   - Use helper functions to improve readability

### Imports

1. **Group imports logically**
   ```typescript
   // External dependencies
   import { useState } from 'react';
   import { toast } from 'sonner';
   
   // Internal utilities
   import { logger } from '@/lib/logger';
   import { prisma } from '@/lib/db';
   
   // Components
   import { Button } from '@/components/ui/button';
   
   // Types
   import type { Video } from '@prisma/client';
   ```

2. **Use absolute imports**
   ```typescript
   // ✅ Prefer
   import { createVideo } from '@/app/actions/create';
   
   // ❌ Avoid
   import { createVideo } from '../../../app/actions/create';
   ```

---

## TypeScript

### Type Safety

1. **Avoid `any` at all costs**
   ```typescript
   // ❌ Avoid
   function processData(data: any) {
     return data.value;
   }
   
   // ✅ Prefer
   interface DataWithValue {
     value: string;
   }
   
   function processData(data: DataWithValue) {
     return data.value;
   }
   ```

2. **Use `unknown` for truly unknown types**
   ```typescript
   // ✅ Good for error handling
   try {
     // code
   } catch (error: unknown) {
     if (error instanceof Error) {
       console.error(error.message);
     }
   }
   ```

3. **Define interfaces for complex objects**
   ```typescript
   // ✅ Create interfaces
   interface VideoProgress {
     status: 'script' | 'images' | 'audio' | 'captions' | 'render';
     step?: string;
     error?: string;
   }
   
   // Use the interface
   function updateProgress(progress: VideoProgress) {
     // TypeScript will ensure all required fields are present
   }
   ```

### Type Utilities

1. **Use utility types from constants**
   ```typescript
   // Define constants as const arrays
   const VIDEO_STATUSES = ['processing', 'completed', 'failed'] as const;
   
   // Extract type from constants
   type VideoStatus = typeof VIDEO_STATUSES[number];
   // Result: 'processing' | 'completed' | 'failed'
   ```

2. **Use type guards**
   ```typescript
   function isNetworkError(error: unknown): error is Error {
     return error instanceof Error && 
            error.message.includes('network');
   }
   
   // Usage
   if (isNetworkError(error)) {
     // TypeScript knows error is an Error here
     console.log(error.message);
   }
   ```

---

## Error Handling

### Use Centralized Error Utilities

```typescript
import { 
  getUserFriendlyErrorMessage, 
  logError,
  isAuthError 
} from '@/lib/errorHandling';

try {
  await createVideo(prompt);
} catch (error: unknown) {
  // Log for debugging
  logError('VideoCreation', error, { prompt });
  
  // Show user-friendly message
  const message = getUserFriendlyErrorMessage(error);
  toast.error(message);
  
  // Handle specific error types
  if (isAuthError(error)) {
    redirectToLogin();
  }
}
```

### Error Message Guidelines

1. **Be specific and actionable**
   ```typescript
   // ❌ Avoid
   throw new Error('Error occurred');
   
   // ✅ Prefer
   throw new Error('Failed to upload video to S3. Check AWS credentials and bucket permissions.');
   ```

2. **Include context in error logs**
   ```typescript
   logger.error('Video creation failed', {
     videoId,
     userId,
     step: 'image-generation',
     error: error.message
   });
   ```

---

## Testing

### Test Organization

1. **Follow AAA pattern** (Arrange, Act, Assert)
   ```typescript
   it('should create video successfully', async () => {
     // Arrange
     const prompt = 'Test video prompt';
     const userId = 'test-user-id';
     
     // Act
     const result = await createVideo(prompt);
     
     // Assert
     expect(result.videoId).toBeDefined();
     expect(result.message).toBe('Video creation started successfully');
   });
   ```

2. **Use descriptive test names**
   ```typescript
   // ✅ Good
   it('should retry 3 times on network error before failing')
   
   // ❌ Bad
   it('retries')
   ```

3. **Mock external dependencies**
   ```typescript
   // Mock OpenAI
   jest.mock('openai', () => ({
     OpenAI: jest.fn().mockImplementation(() => ({
       chat: {
         completions: {
           create: jest.fn().mockResolvedValue({
             choices: [{ message: { content: 'Test script' } }]
           })
         }
       }
     }))
   }));
   ```

### Environment Setup

- Use `jest.setup.js` for test environment configuration
- Never commit real API keys in test files
- Use `.env.test.local` for local test configuration

---

## Performance

### Redis Operations

1. **Use batching for multiple operations**
   ```typescript
   import { batchRedisOperations } from '@/lib/redisBatching';
   
   // ❌ Avoid (3 round-trips)
   await redis.set('key1', 'value1');
   await redis.set('key2', 'value2');
   await redis.set('key3', 'value3');
   
   // ✅ Prefer (1 round-trip)
   await batchRedisOperations(redis, [
     { type: 'set', key: 'key1', value: 'value1' },
     { type: 'set', key: 'key2', value: 'value2' },
     { type: 'set', key: 'key3', value: 'value3' },
   ]);
   ```

2. **Use debouncing for high-frequency updates**
   ```typescript
   import { RedisDebouncer } from '@/lib/redisBatching';
   
   const debouncer = new RedisDebouncer(redis, 500);
   
   // Only last update within 500ms is sent
   debouncer.debounce({ 
     type: 'setex', 
     key: `progress:${videoId}`, 
     value: JSON.stringify(progress),
     ttl: 3600
   });
   ```

### Database Queries

1. **Select only needed fields**
   ```typescript
   // ❌ Avoid
   const video = await prisma.video.findUnique({
     where: { videoId }
   });
   
   // ✅ Prefer
   const video = await prisma.video.findUnique({
     where: { videoId },
     select: { videoId: true, userId: true, status: true }
   });
   ```

2. **Use pagination for large lists**
   ```typescript
   const videos = await prisma.video.findMany({
     where: { userId },
     take: 20,
     skip: (page - 1) * 20,
     orderBy: { createdAt: 'desc' }
   });
   ```

### Constants

1. **Use centralized constants**
   ```typescript
   import { 
     PROMPT_MIN_LENGTH, 
     PROMPT_MAX_LENGTH,
     VIDEO_PROGRESS_TTL 
   } from '@/app/constants/video';
   
   // ❌ Avoid
   if (prompt.length < 10) { ... }
   
   // ✅ Prefer
   if (prompt.length < PROMPT_MIN_LENGTH) { ... }
   ```

---

## Security

### Input Validation

1. **Always validate user input**
   ```typescript
   function validatePrompt(prompt: string): string {
     if (!prompt || typeof prompt !== 'string') {
       throw new Error('Prompt is required and must be a string');
     }
     
     const trimmed = prompt.trim();
     
     if (trimmed.length < PROMPT_MIN_LENGTH) {
       throw new Error(`Prompt must be at least ${PROMPT_MIN_LENGTH} characters`);
     }
     
     if (trimmed.length > PROMPT_MAX_LENGTH) {
       throw new Error(`Prompt must be at most ${PROMPT_MAX_LENGTH} characters`);
     }
     
     return trimmed;
   }
   ```

2. **Sanitize error messages**
   - Don't expose internal paths, API keys, or sensitive data
   - Redis already sanitizes errors (see `lib/redis.ts` sanitizeError function)

### Environment Variables

1. **Never commit secrets**
   - Use `.env.local` for local development
   - Add `.env*.local` to `.gitignore`
   - Use `.env.example` as template

2. **Validate required environment variables**
   ```typescript
   if (!process.env.OPENAI_API_KEY) {
     throw new Error('OPENAI_API_KEY is required');
   }
   ```

---

## Git Workflow

### Commit Messages

Follow conventional commits:

```
feat: add Redis batching utility
fix: resolve TypeScript errors in worker
docs: update best practices guide
refactor: extract constants from worker
test: add tests for error handling
chore: update dependencies
```

### Branch Naming

```
feature/redis-batching
fix/typescript-errors
docs/best-practices
refactor/extract-constants
```

### Pull Requests

1. **Keep PRs focused**
   - One feature/fix per PR
   - Small, reviewable changes

2. **Write descriptive PR descriptions**
   - What problem does it solve?
   - How does it solve it?
   - Any breaking changes?

3. **Ensure tests pass**
   - Run `npm test` before creating PR
   - Run `npm run lint` to check code quality

---

## Code Review Checklist

When reviewing code, check for:

- [ ] TypeScript types are properly defined (no `any`)
- [ ] Error handling uses centralized utilities
- [ ] Tests are added/updated
- [ ] Constants are used instead of magic numbers
- [ ] Redis operations use batching where appropriate
- [ ] Database queries select only needed fields
- [ ] Input validation is present
- [ ] No secrets in code
- [ ] Descriptive variable/function names
- [ ] Comments explain "why" not "what"
- [ ] ESLint warnings are resolved

---

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Next.js Documentation](https://nextjs.org/docs)

---

## Questions?

If you have questions about these best practices or want to suggest improvements, please:

1. Open an issue for discussion
2. Submit a PR to update this guide
3. Ask in the team chat

**Remember**: These are guidelines, not rigid rules. Use your judgment, and when in doubt, prioritize readability and maintainability.
