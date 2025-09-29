# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.4.x   | :white_check_mark: |
| 1.3.x   | :white_check_mark: |
| < 1.3   | :x:                |

## Reporting a Vulnerability

We take the security of Aszune AI Bot seriously. If you discover a security vulnerability, please
follow these steps:

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Send an email to the project maintainers with details about the vulnerability
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact assessment
   - Any suggested fixes (if available)

### What to Expect

- **Response Time**: We aim to acknowledge receipt within 48 hours
- **Investigation**: Security reports will be investigated within 5 business days
- **Updates**: You will receive regular updates on the progress
- **Resolution**: Critical vulnerabilities will be addressed in emergency releases

### Security Best Practices

When using Aszune AI Bot, please ensure:

- Environment variables (`.env` file) are properly secured and not committed to version control
- Discord bot tokens are kept secret and rotated regularly
- API keys are stored securely and have appropriate permissions
- The bot is run with minimal required permissions
- Regular updates are applied to keep dependencies secure

### Scope

This security policy applies to:

- The main application code in the `src/` directory
- Configuration files and deployment scripts
- Dependencies and third-party integrations
- CI/CD pipeline security

### Out of Scope

The following are generally out of scope:

- Issues in third-party dependencies (report to the respective maintainers)
- Denial of service attacks against the Discord API
- Social engineering attacks
- Physical security of deployment infrastructure

## Security Measures

The project implements several security measures:

- **Dependency Scanning**: Automated vulnerability scanning with npm audit
- **Secret Detection**: Gitleaks integration for detecting exposed secrets
- **Input Validation**: Comprehensive input sanitization and validation
- **Error Handling**: Secure error handling to prevent information disclosure
- **File Permissions**: Secure file permissions for sensitive data
- **Rate Limiting**: Built-in rate limiting to prevent abuse

## Contact

For security-related questions or concerns, please contact the project maintainers through the
repository's issue tracker (for non-sensitive matters) or via email for sensitive security issues.
