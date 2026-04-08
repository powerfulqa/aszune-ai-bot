# Aszune AI Bot Documentation

Welcome to the **Aszune AI Bot** Wiki – your complete guide to setup, usage, and development.

## Quick Links

| Getting Started                                    | Reference                          | Advanced                                  |
| -------------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| [Installation](Getting-Started)                    | [Commands](Command-Reference)      | [Dashboard](Dashboard-Features-Complete)  |
| [Usage Guide](Usage-Guide)                         | [Troubleshooting](Troubleshooting) | [Technical Docs](Technical-Documentation) |
| [Configuration](Getting-Started#create-a-env-file) | [Testing](Testing-Guide)           | [Pi Optimisation](Pi-Optimization-Guide)  |

## What is Aszune AI Bot?

A Discord bot providing gaming lore, guides, and advice using Perplexity AI's **sonar** and
**sonar-pro** models. Features include:

- 🤖 **AI Chat** – Context-aware conversations with intelligent model selection and source citations
- ⏰ **Reminders** – Natural language scheduling
- 📊 **Analytics** – Server insights via Discord commands
- 🌐 **Dashboard** – Real-time web monitoring at `http://localhost:3000`
- 🍓 **Pi Optimised** – Runs efficiently on Raspberry Pi

## Current Version: v2.0.0

**1,845 tests passing** • 70%+ coverage • [Release Notes](../docs/RELEASE-NOTES-v2.0.0.md)

### Recent Updates

- v2.0.0 – Security fixes, Perplexity API enhancements (citations, sonar-pro, search filters),
  architecture cleanup
- v1.11.0 – Enhanced `/userinfo` and `/serverinfo` utility commands
- v1.10.0 – Code quality improvements, documentation cleanup
- v1.9.0 – Dashboard features: logs, services, config, network, reminders
- v1.8.0 – Web dashboard with Socket.IO

## Code Quality

This project uses [QLTY](https://qlty.sh/) for automated code quality:

- [QLTY Integration Guide](../docs/qlty/QLTY_INTEGRATION.md)
- [Security Policy](../SECURITY.md)
- [Contributing](../CONTRIBUTING.md)
