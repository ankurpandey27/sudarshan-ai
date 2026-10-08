# models

The answer-matching model lives here: a small multilingual model (about 130 MB) that finds your saved answers to questions that mean the same thing, in any wording or language, so the AI can reuse them.

- **Filled automatically.** `npm install` downloads it here once, and `npm start` fetches it if it is still missing. Nothing to set up.
- **Not in Git.** The file is larger than GitHub allows (100 MB per file), so this folder is ignored except for this note.
- **Offline machines.** Copy this folder from a computer that has it; Sudarshan AI uses it as it is.
- **Elsewhere.** Set `SUDARSHAN_MODELS_DIR` to keep it in another folder, or `SUDARSHAN_SKIP_MODEL=1` to never download it. Without it, Sudarshan AI works as before.

Model: [`Xenova/paraphrase-multilingual-MiniLM-L12-v2`](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2), an ONNX version of [`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2), Apache License 2.0.
