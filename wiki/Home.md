# Aszune AI Bot Documentation

Welcome to the **Aszune AI Bot** Wiki – your complete guide to setup, usage, and development.

## Quick Links

| Getting Started                                    | Reference                          | Advanced                                  |
| -------------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| [Installation](Getting-Started)                    | [Commands](Command-Reference)      | [Dashboard](Dashboard-Features-Complete)  |
| [Usage Guide](Usage-Guide)                         | [Troubleshooting](Troubleshooting) | [Technical Docs](Technical-Documentation) |
| [Configuration](Getting-Started#create-a-env-file) | [Testing](Testing-Guide)           | [Pi Optimisation](Pi-Optimization-Guide)  |

## What is Aszune AI Bot?

A Discord bot providing gaming lore, guides, and advice using the **Perplexity Agent API**
(`/v1/agent`). Features include:

- 🤖 **AI Chat** – Back-and-forth conversations with web search, link reading and numbered source
  citations; the model comes from a configurable preset (`AGENT_PRESET`, default `medium`)
- ⏰ **Reminders** – Natural language scheduling
- 📊 **Analytics** – Server insights via Discord commands
- 🌐 **Dashboard** – Real-time web monitoring at `http://localhost:3000`
- 🍓 **Pi Optimised** – Runs efficiently on Raspberry Pi

## Current Version: v2.3.0

**2,036 tests passing** • 70%+ coverage • [Changelog](../CHANGELOG.md)

### Recent Updates

- v2.3.0 – Agent API is the only chat path (Sonar retired 2026-09-27); tuned for conversation
  (`medium` preset, link reading, 30-message history, 2h sessions); owner-only `/diag` command
- v2.2.1 – Fix: stop sending `temperature` with Agent API presets (bot had stopped answering)
- v2.2.0 – Dashboard security hardening, shared page shell and dark theme
- v2.1.0 – Node 22+ toolchain refresh, migration to the Perplexity Agent API
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
