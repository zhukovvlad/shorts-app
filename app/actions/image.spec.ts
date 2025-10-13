/**
 * Unit tests for extractUrlFromValue function from image.ts
 * 
 * This helper extracts URLs from various Replicate model output formats.
 * Tests cover all edge cases and different output structures.
 */

import { extractUrlFromValue } from './image';

describe('extractUrlFromValue (image.ts)', () => {
  describe('String input', () => {
    it('should return string URL directly', () => {
      const url = 'https://example.com/image.png';
      expect(extractUrlFromValue(url)).toBe(url);
    });

    it('should return empty string as is', () => {
      expect(extractUrlFromValue('')).toBe('');
    });
  });

  describe('Object with url property', () => {
    it('should extract string from { url: "string" }', () => {
      const value = { url: 'https://example.com/image.png' };
      expect(extractUrlFromValue(value)).toBe('https://example.com/image.png');
    });

    it('should extract from nested { url: { href: "string" } }', () => {
      const value = { url: { href: 'https://example.com/nested.png' } };
      expect(extractUrlFromValue(value)).toBe('https://example.com/nested.png');
    });

    it('should call url() method and return string', () => {
      const value = {
        url: () => 'https://example.com/method.png'
      };
      expect(extractUrlFromValue(value)).toBe('https://example.com/method.png');
    });

    it('should call url() method and extract href from returned object', () => {
      const value = {
        url: () => ({ href: 'https://example.com/method-href.png' })
      };
      expect(extractUrlFromValue(value)).toBe('https://example.com/method-href.png');
    });

    it('should return null if url() returns non-string/non-object', () => {
      const value = {
        url: () => null
      };
      expect(extractUrlFromValue(value)).toBeNull();
    });

    it('should return null if url is undefined', () => {
      const value = { url: undefined };
      expect(extractUrlFromValue(value)).toBeNull();
    });

    it('should return null if url.href is not a string', () => {
      const value = { url: { href: 123 } };
      expect(extractUrlFromValue(value)).toBeNull();
    });
  });

  describe('Object with href property', () => {
    it('should extract string from { href: "string" }', () => {
      const value = { href: 'https://example.com/href.png' };
      expect(extractUrlFromValue(value)).toBe('https://example.com/href.png');
    });

    it('should return null if href is not a string', () => {
      const value = { href: 123 };
      expect(extractUrlFromValue(value)).toBeNull();
    });
  });

  describe('Object with output property', () => {
    it('should extract string from { output: "string" }', () => {
      const value = { output: 'https://example.com/output.png' };
      expect(extractUrlFromValue(value)).toBe('https://example.com/output.png');
    });

    it('should extract from { output: ["url"] } array', () => {
      const value = { output: ['https://example.com/output-array.png'] };
      expect(extractUrlFromValue(value)).toBe('https://example.com/output-array.png');
    });

    it('should extract from { output: { url: "string" } } nested object', () => {
      const value = { output: { url: 'https://example.com/output-nested.png' } };
      expect(extractUrlFromValue(value)).toBe('https://example.com/output-nested.png');
    });

    it('should recursively extract from deeply nested output', () => {
      const value = {
        output: {
          output: {
            url: 'https://example.com/deep-nested.png'
          }
        }
      };
      expect(extractUrlFromValue(value)).toBe('https://example.com/deep-nested.png');
    });

    it('should return null if output array is empty', () => {
      const value = { output: [] };
      expect(extractUrlFromValue(value)).toBeNull();
    });

    it('should return null if output is null', () => {
      const value = { output: null };
      expect(extractUrlFromValue(value)).toBeNull();
    });
  });

  describe('Priority order', () => {
    it('should prioritize url property over href', () => {
      const value = {
        url: 'https://example.com/url.png',
        href: 'https://example.com/href.png'
      };
      expect(extractUrlFromValue(value)).toBe('https://example.com/url.png');
    });

    it('should prioritize url property over output', () => {
      const value = {
        url: 'https://example.com/url.png',
        output: 'https://example.com/output.png'
      };
      expect(extractUrlFromValue(value)).toBe('https://example.com/url.png');
    });

    it('should prioritize href over output', () => {
      const value = {
        href: 'https://example.com/href.png',
        output: 'https://example.com/output.png'
      };
      expect(extractUrlFromValue(value)).toBe('https://example.com/href.png');
    });
  });

  describe('Edge cases', () => {
    it('should return null for null input', () => {
      expect(extractUrlFromValue(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(extractUrlFromValue(undefined)).toBeNull();
    });

    it('should return null for number input', () => {
      expect(extractUrlFromValue(123)).toBeNull();
    });

    it('should return null for boolean input', () => {
      expect(extractUrlFromValue(true)).toBeNull();
    });

    it('should return null for empty object', () => {
      expect(extractUrlFromValue({})).toBeNull();
    });

    it('should return null for object with unrelated properties', () => {
      const value = { foo: 'bar', baz: 123 };
      expect(extractUrlFromValue(value)).toBeNull();
    });

    it('should handle circular reference gracefully', () => {
      const value: any = { url: null };
      value.url = value; // Circular reference
      
      // Should not crash, but will return null eventually
      expect(extractUrlFromValue(value)).toBeNull();
    });
  });

  describe('Real-world Replicate output formats', () => {
    it('should handle flux-schnell model output (simple string)', () => {
      const output = 'https://replicate.delivery/pbxt/abc123/image.webp';
      expect(extractUrlFromValue(output)).toBe(output);
    });

    it('should handle stable-diffusion output (array of strings)', () => {
      const value = {
        output: [
          'https://replicate.delivery/pbxt/def456/image1.png',
          'https://replicate.delivery/pbxt/ghi789/image2.png'
        ]
      };
      expect(extractUrlFromValue(value)).toBe('https://replicate.delivery/pbxt/def456/image1.png');
    });

    it('should handle DALL-E style output (object with url)', () => {
      const value = {
        url: 'https://oaidalleapiprodscus.blob.core.windows.net/private/image.png'
      };
      expect(extractUrlFromValue(value)).toBe('https://oaidalleapiprodscus.blob.core.windows.net/private/image.png');
    });

    it('should handle Midjourney style output (nested object)', () => {
      const value = {
        output: {
          url: 'https://cdn.midjourney.com/abc123/image.png'
        }
      };
      expect(extractUrlFromValue(value)).toBe('https://cdn.midjourney.com/abc123/image.png');
    });
  });
});
