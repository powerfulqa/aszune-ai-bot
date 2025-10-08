const { InputValidator } = require('./src/utils/input-validator');

const result = InputValidator.validateAndSanitize('<script>alert("xss")</script>', { type: 'message', strict: false });
console.log('Input: <script>alert("xss")</script>');
console.log('Valid:', result.valid);
console.log('Sanitized:', JSON.stringify(result.sanitized));
console.log('Length:', result.sanitized ? result.sanitized.length : 0);
console.log('Trimmed length:', result.sanitized ? result.sanitized.trim().length : 0);