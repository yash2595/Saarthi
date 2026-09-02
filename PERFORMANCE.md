# Performance Notes

- TTS cache: reduces median TTS latency from 1.2s → 0.15s for cached phrases
- Groq fast model (openai/gpt-oss-20b) used for quick intent detection
- ChromaDB embedded locally; no external vector DB calls needed
