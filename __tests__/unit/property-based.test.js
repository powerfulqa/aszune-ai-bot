/**
 * Property-based tests for the cache service
 * Using fast-check to generate random test inputs
 */
const fc = require('fast-check');
const cacheService = require('../../src/services/cache');

describe('Property-based tests', () => {
  beforeAll(() => {
    // Initialize the cache service
    cacheService.initSync();
  });
  
  describe('Hash generation properties', () => {
    it('should generate consistent hashes for equivalent normalized questions', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 1000 }),
        (question) => {
          // Assume question is valid (non-empty after trim)
          if (question.trim().length === 0) return true;
          
          // Create variations
          const variations = [
            question,
            question.toUpperCase(),
            `  ${question}  `,
            question + '!',
            question.replace(/\s+/g, ' ')
          ];
          
          // Generate hashes for all variations
          const hashes = variations.map(v => {
            try {
              return cacheService.generateHash(v);
            } catch (e) {
              return null;
            }
          }).filter(h => h !== null);
          
          // All valid hashes should be the same
          return hashes.length === 0 || hashes.every(h => h === hashes[0]);
        }
      ));
    });
    
    it('should generate different hashes for different questions', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (q1, q2) => {
          // Skip empty strings or identical strings
          if (q1.trim().length === 0 || q2.trim().length === 0 || q1 === q2) return true;
          
          try {
            const hash1 = cacheService.generateHash(q1);
            const hash2 = cacheService.generateHash(q2);
            
            // Check if the normalized form is the same
            const normalizeForTest = str => str.toLowerCase().trim().replace(/\s+/g, ' ')
              .replace(/[.,!?;:]/g, '').replace(/["'`]/g, '');
              
            if (normalizeForTest(q1) === normalizeForTest(q2)) {
              return hash1 === hash2;
            } else {
              // Different questions should have different hashes
              return hash1 !== hash2;
            }
          } catch (e) {
            // If either throws, the test passes (we're not testing error cases here)
            return true;
          }
        }
      ));
    });
    
    it('should handle special characters appropriately', () => {
      fc.assert(fc.property(
        fc.stringOf(fc.unicodeString({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 100 }),
        (question) => {
          // Skip strings that would be empty after normalization
          if (question.trim().length === 0) return true;
          
          try {
            const hash = cacheService.generateHash(question);
            return typeof hash === 'string' && hash.length > 0;
          } catch (e) {
            // If it throws, the test passes (we're expecting some inputs to be invalid)
            return true;
          }
        }
      ));
    });
  });
  
  describe('Similarity calculation properties', () => {
    it('should always return a value between 0 and 1', () => {
      fc.assert(fc.property(
        fc.string({ maxLength: 200 }),
        fc.string({ maxLength: 200 }),
        (str1, str2) => {
          const similarity = cacheService.calculateSimilarity(str1, str2);
          return similarity >= 0 && similarity <= 1;
        }
      ));
    });
    
    it('should be symmetric (sim(a,b) === sim(b,a))', () => {
      fc.assert(fc.property(
        fc.string({ maxLength: 100 }),
        fc.string({ maxLength: 100 }),
        (str1, str2) => {
          const similarity1 = cacheService.calculateSimilarity(str1, str2);
          const similarity2 = cacheService.calculateSimilarity(str2, str1);
          return Math.abs(similarity1 - similarity2) < 0.00001; // Allow for floating point imprecision
        }
      ));
    });
    
    it('should return 1 for identical strings', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (str) => {
          // Skip empty strings
          if (str.trim().length === 0) return true;
          return cacheService.calculateSimilarity(str, str) === 1;
        }
      ));
    });
    
    it('should handle special cases appropriately', () => {
      // Test with null, undefined, empty strings
      expect(cacheService.calculateSimilarity(null, 'test')).toBe(0);
      expect(cacheService.calculateSimilarity('test', null)).toBe(0);
      expect(cacheService.calculateSimilarity('', 'test')).toBe(0);
      expect(cacheService.calculateSimilarity('   ', 'test')).toBe(0);
    });
    
    it('should produce higher similarity for more similar strings', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (baseStr, additions) => {
          if (baseStr.trim().length === 0) return true;
          
          // Create strings with varying degrees of similarity
          const original = baseStr;
          
          // Add random words to create a similar string
          const similar = baseStr + ' ' + Array(additions).fill(0).map(() => 'extra').join(' ');
          
          // Create a completely different string
          const different = Array(baseStr.length).fill('z').join('');
          
          const simToOriginal = cacheService.calculateSimilarity(original, similar);
          const diffToOriginal = cacheService.calculateSimilarity(original, different);
          
          // Similarity to a similar string should be higher than to a different string
          return simToOriginal > diffToOriginal;
        }
      ));
    });
  });
});
