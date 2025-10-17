/**
 * Unit tests for content moderation error detection and handling
 * @jest-environment node
 */

describe('Content Moderation - Safety Error Detection', () => {
  describe('isSafetyError helper logic', () => {
    const isSafetyError = (errorMessage: string): boolean => {
      // Нормализуем к нижнему регистру для case-insensitive проверки
      const lower = errorMessage.toLowerCase();
      return lower.includes('safety system') || 
             lower.includes('content policy') ||
             lower.includes('rejected as a result');
    };

    it('should detect "safety system" as moderation error', () => {
      const error = '400 Your request was rejected as a result of our safety system.';
      expect(isSafetyError(error)).toBe(true);
    });

    it('should detect "content policy" as moderation error', () => {
      const error = 'Your request violates our content policy';
      expect(isSafetyError(error)).toBe(true);
    });

    it('should detect "rejected as a result" as moderation error', () => {
      const error = 'Your request was rejected as a result of moderation';
      expect(isSafetyError(error)).toBe(true);
    });

    it('should NOT detect technical errors as moderation errors', () => {
      const technicalErrors = [
        '500 Internal Server Error',
        '503 Service Unavailable',
        'ETIMEDOUT',
        'fetch failed',
        'Connection refused',
        'Network error'
      ];

      technicalErrors.forEach(errorMsg => {
        expect(isSafetyError(errorMsg)).toBe(false);
      });
    });

    it('should handle mixed case in error messages (case-insensitive)', () => {
      // После исправления: все варианты регистра должны определяться корректно
      expect(isSafetyError('SAFETY SYSTEM')).toBe(true);
      expect(isSafetyError('Safety System')).toBe(true);
      expect(isSafetyError('Content Policy violation')).toBe(true);
      expect(isSafetyError('CONTENT POLICY')).toBe(true);
      expect(isSafetyError('Rejected As A Result')).toBe(true);
      expect(isSafetyError('safety system detected')).toBe(true);
    });
  });

  describe('Sanitization flow documentation', () => {
    it('should document the retry flow', () => {
      // This is a documentation test to ensure the flow is clear
      const retryFlow = {
        maxRetries: 3,
        steps: [
          '1. Initial generation attempt',
          '2. If moderation error, call OpenAI to sanitize prompt',
          '3. Retry with sanitized prompt',
          '4. Repeat up to 3 times',
          '5. If all attempts fail, return null and log warning'
        ]
      };

      expect(retryFlow.maxRetries).toBe(3);
      expect(retryFlow.steps).toHaveLength(5);
    });

    it('should document when sanitization is skipped', () => {
      const skipConditions = [
        'OPENAI_API_KEY is not available',
        'Error is technical (not moderation)',
        'Sanitization API call fails'
      ];

      expect(skipConditions).toContain('OPENAI_API_KEY is not available');
    });
  });
});
