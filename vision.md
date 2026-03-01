# Product Vision

## 1. Product Overview
An open-source (Apache 2.0), AI-native code editor built as a hard fork of Visual Studio Code. It embeds advanced AI capabilities directly into the core editor architecture to provide deep contextual awareness, multi-file editing, and agentic workflows without relying on constrained extension APIs.

## 2. Target Users and Personas
- **Professional Developers:** Require fast, reliable AI assistance integrated into their primary workflow without sacrificing existing ecosystem compatibility.
- **Privacy-Conscious & Enterprise Teams:** Work in regulated industries or require strict data control, mandating the use of local models or private enterprise API endpoints.
- **Cost-Conscious Power Users:** Heavy AI users who prefer a Bring-Your-Own-Key (BYOK) model over expensive fixed-rate SaaS subscriptions.

## 3. User Problems and Pain Points
- **Vendor Lock-in and High Costs:** Market leaders (e.g., Cursor, Windsurf) are proprietary, charge expensive per-seat subscriptions, and restrict model choice.
- **Extension API Limitations:** AI coding assistants running as standard VS Code extensions (e.g., Cline, GitHub Copilot) are bottlenecked by VS Code's extension host constraints, resulting in slower performance, limited UI control, and restricted codebase indexing.
- **Privacy Risks:** Proprietary AI IDEs operate as black boxes, creating intellectual property and telemetry compliance risks for enterprise codebases.

## 4. Core Value Proposition
- **Native AI Integration:** Deeply embedded multi-file AI editing, intelligent local codebase indexing, and agentic capabilities built directly into the core IDE UI and engine.
- **Unrestricted Model Choice:** Native support for 500+ LLMs via direct API connections (OpenAI, Anthropic, OpenRouter) and local inference engines (Ollama, LM Studio).
- **Seamless Compatibility:** Full, unmodified support for the existing VS Code extension marketplace, themes, settings, and keybindings.

## 5. Key Differentiators
- **Open-Source Architecture:** Fully transparent, Apache 2.0 licensed alternative to proprietary AI IDEs.
- **Data Sovereignty (BYOK):** Absolute control over AI costs, data routing, and prompt telemetry. 
- **Performance:** A customized, performance-tuned editor core optimized for instantaneous AI responsiveness, bypassing the legacy extension polling overhead.

## 6. Long-Term Vision
To become the definitive open-source standard for AI-assisted software development, enabling teams and individuals to deploy secure, high-performance, and deeply integrated AI coding workflows without proprietary platform lock-in.