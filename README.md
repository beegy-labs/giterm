# Giterm

> Vibe Coding Orchestrator: Developer thinks, agents execute.

## Vision

**giterm** is a cross-platform application that implements the [agentic-dev-protocol](https://github.com/beegy-labs/agentic-dev-protocol) (CDD, SDD, ADD) in practice.

```
┌─────────────────────────────────────────────────────────────┐
│                        giterm                               │
│              Vibe Coding Orchestrator                       │
│                                                             │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│   │ macOS   │  │ Windows │  │Terminal │                    │
│   │  App    │  │   App   │  │  (TUI)  │                    │
│   └─────────┘  └─────────┘  └─────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## What is Giterm?

**Giterm = VSCode for Vibe Coding**

Instead of editing code directly, giterm orchestrates N terminal agents to develop your project based on approved specs.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Spec Editor (SDD)                        │
│                                                             │
│  - Manage .specs/ with developer                            │
│  - Human reviews and approves specs                         │
│  - Connect to GitHub repos                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Approved Spec
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 Agent Orchestrator (ADD)                    │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Claude   │ │ Claude   │ │ Gemini   │ │ Qwen     │       │
│  │ Code #1  │ │ Code #2  │ │ CLI      │ │ Code     │       │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤       │
│  │ commit   │ │ PR       │ │ code     │ │ commit   │       │
│  │feature A │ │feature B │ │ review   │ │ tests    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  - Distribute tasks based on spec                           │
│  - Monitor progress in real-time                            │
│  - Collect outputs (commits, PRs, reviews)                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Target Repository                         │
│                                                             │
│  my-girok/                                                  │
│  ├── .specs/          ← Managed by giterm                   │
│  ├── src/             ← Developed by N agents               │
│  └── ...                                                    │
└─────────────────────────────────────────────────────────────┘
```

## Workflow

```
1. Connect
   └── Link GitHub repository to giterm

2. Spec (SDD)
   └── Developer + giterm manage .specs/
   └── Human approves spec

3. Execute (ADD)
   └── giterm distributes tasks to N agents
       ├── Terminal 1 (Claude Code): Feature A → commit
       ├── Terminal 2 (Claude Code): Feature B → PR
       ├── Terminal 3 (Gemini CLI): Code review
       └── Terminal N (Qwen Code): Write tests → commit

4. Collect
   └── giterm aggregates all outputs
   └── Commits, PRs, review comments

5. Review
   └── Human final approval
```

## Supported Agents

| Agent | Status |
|-------|--------|
| Claude Code | Planned |
| Gemini CLI | Planned |
| Qwen Code | Planned |
| Open Code | Planned |
| Aider | Planned |

Multiple instances of the same agent can run in parallel.

## Key Features

### 1. Spec Management (SDD)

- Visual editor for `.specs/` files
- Human-in-the-loop approval workflow
- Spec versioning and history

### 2. Multi-Agent Orchestration (ADD)

- Run N terminal agents simultaneously
- Any combination: 3x Claude Code, 2x Gemini CLI, etc.
- Real-time output monitoring

### 3. Git Operations

| Operation | Description |
|-----------|-------------|
| Commit | Agents commit their changes |
| PR | Agents create pull requests |
| Review | Agents perform code reviews |
| Merge | Human approves and merges |

### 4. Output Sucking

Real-time collection from all terminals:
- Progress tracking
- Error detection
- Result aggregation

## Policy Foundation

Giterm implements the [agentic-dev-protocol](https://github.com/beegy-labs/agentic-dev-protocol):

| Layer | Implementation in Giterm |
|-------|--------------------------|
| **CDD** | Context management across agents |
| **SDD** | Spec Editor - manage .specs/ with human |
| **ADD** | Agent Orchestrator - N agents execute |

**Auto-sync**: GitHub Actions updates policies every 6 hours.

## Platforms

| Platform | Status |
|----------|--------|
| macOS App | Planned |
| Windows App | Planned |
| Terminal (TUI) | Planned |

## License

MIT
