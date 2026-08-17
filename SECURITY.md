# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

We take the security of Aszune AI Bot seriously. If you discover a security vulnerability, please
follow these steps:

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities.
2. Use **GitHub's private vulnerability reporting**: on the repository, open the **Security** tab and
   click **"Report a vulnerability"**
   (<https://github.com/powerfulqa/aszune-ai-bot/security/advisories/new>). This opens a private
   advisory visible only to the maintainers.
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

- **Dependency scanning**: `npm audit` runs in CI and **fails the build** on high-severity
  production advisories; Dependabot proposes updates weekly
- **Secret detection**: Gitleaks (via qlty); secrets are read from environment only and validated at
  startup — none are committed
- **Input validation**: sanitisation of user content before it reaches the AI or storage
- **Parameterised SQL**: all `better-sqlite3` access uses prepared statements with bound parameters
- **Dashboard access control**: the admin dashboard binds to `127.0.0.1` by default; destructive
  operations require `DASHBOARD_TOKEN` (Socket.IO handshake auth with constant-time comparison), and
  without a token the dashboard is read-only
- **Command execution**: service control uses `execFile` with allowlisted arguments (no shell
  interpolation)
- **Rate limiting**: per-user request throttling

## Contact

For **sensitive security issues**, use GitHub's private vulnerability reporting (see
[How to Report](#how-to-report)) — do not open a public issue. For non-sensitive questions, the
public issue tracker is fine.
