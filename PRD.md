# Product Requirements Document (PRD)

## 1. Overview and Goals
**Problem Summary:** Professional developers are forced to choose between highly optimized, expensive, and closed-source AI IDEs (like Cursor) or clunky, slow AI extensions built on top of standard VS Code. Developers lack a fast, natively integrated AI editor that respects data sovereignty and open-source values.
**Product Summary:** An open-source, AI-native IDE built as a hard fork of VS Code. It provides deep, agentic AI integration (multi-file editing, chat, and codebase indexing) natively into the UI and editor core, supporting a Bring-Your-Own-Key (BYOK) model for over 500+ LLMs.
**Business and User Goals:**
- Deliver a fast, responsive AI coding experience indistinguishable in speed from native IDE functions.
- Enable users to connect their own LLM API keys or local models.
- Maintain 100% compatibility with the VS Code extension ecosystem.

## 2. In-Scope and Out-of-Scope
**In-Scope (v1):**
- VS Code hard fork compilation and packaging for macOS, Windows, and Linux.
- Native, dockable AI Chat sidebar with codebase context awareness.
- Multi-file AI editing ("Composer Mode") with inline diff generation and accept/reject controls.
- Inline autocomplete ("Ghost Text") powered by configurable fast models.
- "Bring Your Own Key" configuration supporting OpenAI, Anthropic, OpenRouter, and Ollama.
- Local codebase vector indexing and semantic search.

**Out-of-Scope (v1):**
- Built-in subscription billing or user account management (fully BYOK).
- Cloud-hosted indexing or synchronized user settings via proprietary servers.
- Collaborative multi-user editing (e.g., Live Share integration).
- Custom mobile or web-based editor clients.

## 3. Assumptions and Dependencies
**Dependencies:**
- Upstream Microsoft/VS Code repository updates.
- Availability and stability of third-party LLM APIs (OpenAI, Anthropic, OpenRouter).
- OpenVSX registry or compatible extension marketplace for extension distribution.

**Assumptions:**
- Developers will prefer supplying their own API keys over paying a single fixed subscription fee to a vendor.
- The performance overhead of local vector indexing is acceptable on modern developer workstations.
- Modifying the VS Code core will not irrevocably break critical language servers.

## 4. User Personas and Primary Use Cases
**Personas:**
- **The Power Developer:** Needs instantaneous AI responses across massive codebases; prioritizes speed and model capability (e.g., GPT-4o, Claude 3.5 Sonnet).
- **The Privacy Engineer:** Cannot send enterprise code to public APIs; relies strictly on local models (e.g., Llama 3 via Ollama) or self-hosted enterprise endpoints.

**Primary Use Cases:**
- **Zero-Shot Project Scaffolding:** Developer uses the AI Composer to generate a complete boilerplate application spanning multiple files in one prompt.
- **Contextual Debugging:** Developer pastes a terminal error into the AI Chat, which automatically reads the currently active file and relevant imported files to propose a fix.
- **Cost-Controlled Refactoring:** Developer switches to a cheaper model (e.g., GPT-4o-mini) for simple boilerplate generation and a high-tier model (e.g., Claude 3.5 Sonnet) for complex architectural refactoring.

## 5. Functional Requirements

### 5.1 AI Provider Management (BYOK)
- **Description:** A native settings UI for configuring AI providers and models.
- **Actors:** User.
- **Preconditions:** IDE is installed and running.
- **Main Flow:** User opens "AI Settings", selects a provider (e.g., OpenRouter), enters an API key, and selects default models for Chat, Composer, and Autocomplete.
- **Alternative Flows:** User selects "Local Model", inputs a custom localhost port (e.g., Ollama `http://127.0.0.1:11434`), and selects the downloaded model name.
- **Error Handling:** If an API key is invalid or network request fails, the IDE displays a non-blocking toast notification indicating connection failure.

### 5.2 Local Codebase Indexing
- **Description:** Background service that parses, chunks, and creates vector embeddings of the workspace.
- **Actors:** System.
- **Preconditions:** A workspace folder is opened.
- **Main Flow:** System detects a new workspace, respects `.gitignore`, chunks text files, generates local embeddings, and stores them in a local SQLite database.
- **Alternative Flows:** If the workspace is extremely large (>10k files), the system prompts the user to confirm indexing or configure a `.aiignore` file.
- **Error Handling:** Gracefully skip binary files, massive minified files, or files with unreadable encodings.

### 5.3 Native AI Chat Sidebar
- **Description:** A conversational interface embedded directly in the IDE layout.
- **Actors:** User, LLM Provider.
- **Preconditions:** Valid API key or local model configured.
- **Main Flow:** User submits a prompt. The system retrieves relevant context (active file, highlighted text, semantic search results from the index), constructs the prompt, streams the LLM response, and renders Markdown/code blocks. User clicks "Apply to active file" on a code block to trigger an inline diff.
- **Alternative Flows:** User uses `@` mentions to manually include specific files, folders, or terminal output in the context.
- **Error Handling:** Handle rate limits (HTTP 429) by pausing the stream and displaying an actionable error message ("Rate limit exceeded. Please wait or change providers").

### 5.4 Multi-File Editor (Composer Mode)
- **Description:** A dedicated floating or pane-based UI where the AI can propose, execute, and present diffs across multiple files simultaneously.
- **Actors:** User, LLM Provider.
- **Preconditions:** Valid API key configured.
- **Main Flow:** User presses `Cmd+I` to open Composer, types an instruction (e.g., "Implement authentication"). AI generates a plan and streams code changes to multiple files. The IDE displays inline, syntax-highlighted diffs (green/red) in the standard editor view. User clicks "Accept All" or selectively accepts/rejects changes per file.
- **Alternative Flows:** User modifies the prompt mid-stream; system cancels the current API request, reverts unaccepted diffs, and restarts generation.
- **Error Handling:** If the AI attempts to modify a file that has unsaved, conflicting manual changes, prompt the user to resolve the conflict before applying the AI diff.

### 5.5 Inline Autocomplete (Ghost Text)
- **Description:** Extremely low-latency, single-line or multi-line code completions that appear as grayed-out "ghost text" ahead of the cursor.
- **Actors:** User, LLM Provider.
- **Preconditions:** Fast model (e.g., StarCoder, Claude 3.5 Haiku) configured.
- **Main Flow:** User pauses typing for >200ms. System sends immediate prefix/suffix context to the LLM. Ghost text appears. User presses `Tab` to accept.
- **Error Handling:** If request takes >1000ms, abort silently to prevent jarring UX.

## 6. Non-Functional Requirements
- **Performance and Latency:** UI interactions (opening chat, opening Composer) must respond in <50ms. Autocomplete (Ghost Text) generation should target <500ms latency depending on the provider.
- **Scalability:** The local indexing engine must support workspaces up to 100,000 files without degrading editor typing performance.
- **Security and Privacy:** API keys must be stored in the OS-native secure keychain (macOS Keychain, Windows Credential Manager, Secret Service API). The IDE must **never** send telemetry containing source code or prompts to its own servers.
- **Availability:** Core IDE functionality must remain 100% operational offline (without AI features).
- **Maintainability:** The fork architecture must minimize conflicts with upstream VS Code updates to allow for merging new VS Code releases within 14 days.
- **Browser/Device Support:** Supported on macOS (Apple Silicon and Intel), Windows 10/11 (x64 and ARM), and major Linux distributions (Ubuntu, Fedora, Arch).

## 7. Data and Integration Requirements
- **Key Entities:**
  - `ProviderConfig`: Model name, API key, Base URL.
  - `ChatHistory`: Session ID, Messages (Role, Content), Timestamps.
  - `VectorIndex`: File Path, Chunk ID, Embedding Vector.
- **Data Lifecycle:** `ChatHistory` and `VectorIndex` are stored locally. Users can clear them via the command palette.
- **Integrations:**
  - VS Code Extension API (fully preserved).
  - Native integration with standard LLM REST/Streaming APIs (OpenAI format, Anthropic format).
- **Authentication:** Relies entirely on third-party API keys provided by the user. No centralized user authentication is required.

## 8. Risks and Open Questions
- **Risk:** Upstream VS Code structural changes break the native UI modifications required for Composer and Chat.
  - *Mitigation:* Maintain strict isolation of custom UI components and rely on VS Code's internal grid layout system.
- **Risk:** Local vector indexing consumes too much CPU/RAM, causing the editor to freeze.
  - *Mitigation:* Run indexing entirely in a background worker thread or standalone process, paused during high user activity.
- **Open Question:** What embedding model should be used by default for local indexing, and how will its weights be distributed without bloating the installer?
- **Open Question:** How will we handle the onboarding UX to explain BYOK to users who are accustomed to "it just works" subscriptions?

## 9. Release Criteria and Success Metrics
- **Functional Acceptance Criteria:**
  - User can configure an OpenAI API key and successfully chat with the codebase.
  - User can generate a multi-file diff using Composer Mode and accept changes without editor crashes.
  - Ghost text autocomplete functions with sub-second latency.
  - Existing popular VS Code extensions (e.g., Python, Prettier, ESLint) install and run without error.
- **Non-Functional Acceptance Criteria:**
  - App startup time is within 10% of the upstream VS Code startup time.
  - API keys are verified to be stored in the OS keychain.
- **Success Metrics (for v1):**
  - >1,000 weekly active users (measured via opt-in anonymous startup ping, if applicable and compliant, or GitHub stars/downloads).
  - 0 reported data leaks or telemetry violations.
  - >90% success rate on multi-file Composer diff applications (tracked qualitatively or via optional telemetry).