<p align="center">
  <img src="apps/web/public/sudarshan.svg" width="120" alt="Sudarshan Chakra logo" />
</p>

<h1 align="center">Sudarshan</h1>

<p align="center"><b>Goes out. Finishes the task. Returns.</b><br/>
A job application agent that runs on your own laptop - LinkedIn, Naukri and any career site.<br/>
Bring any AI key, use a free local model, or no AI at all. Free and open source.</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-e8a317" /></a>
  <img alt="Node 22.13+" src="https://img.shields.io/badge/node-%E2%89%A5%2022.13-339933" />
  <img alt="Windows, macOS, Linux" src="https://img.shields.io/badge/runs%20on-Windows%20%7C%20macOS%20%7C%20Linux-555" />
  <img alt="Local-first" src="https://img.shields.io/badge/data-stays%20on%20your%20computer-1b1814" />
</p>

---

## Why "Sudarshan"?

In the **Dwapar Yug**, Shri Krishna's **Sudarshan Chakra** was released once - and did the rest on its own. It went out, completed its task with perfect precision, and **returned to his finger**.

That is exactly what this agent does:

- **Goes out** - searches LinkedIn, Naukri and career sites for you.
- **Finishes the task** - fills and submits the applications, answering screening questions from what it knows about you.
- **Returns** - comes back with results: what was applied, what needs your answer, and why.

*Sudarshan* (सुदर्शन) also means **"auspicious vision"** - it sees every job, and applies only where you truly fit.

The logo is the chakra itself: a gold saw-toothed rim around twelve spokes. Inside the app it **spins while the agent is out working** and rests when it stops.

---

## Contents

1. [What it does](#what-it-does)
2. [Why it is fast](#why-it-is-fast)
3. [Quick start](#quick-start)
4. [First-run setup](#first-run-setup)
5. [Connecting an AI model (every provider, step by step)](#connecting-an-ai-model)
6. [The Excel sheet](#the-excel-sheet)
7. [Daily use](#daily-use)
8. [When something goes wrong](#when-something-goes-wrong)
9. [Safety and privacy](#safety-and-privacy)
10. [Configuration](#configuration)
11. [Updating and removing](#updating-and-removing)
12. [For developers](#for-developers)
13. [Status and known gaps](#status-and-known-gaps)
14. [Contributing](#contributing)

---

## What it does

- **Reads your resume (PDF)** into a profile: name, contact, title, city, links, years of experience, skills (with years), education.
- **Imports an Excel sheet** of your known answers, extra job links (any site) and preferences.
- **Searches** LinkedIn and Naukri for your keywords and locations, and queues links you add from any career site.
- **Scores every job** against your profile and explains the score (matched / missing skills, salary, location).
- **Applies** - LinkedIn Easy Apply, Naukri (including its chat-style questions), and generic career sites - in its own browser window you can watch.
- **Remembers every answer**, so forms get faster and cheaper over time.
- **Asks you only what it cannot know**, once, and reuses your answer forever.
- **Explains itself** - the "What needs attention" panel tells you, in plain words, anything stopping it and how to fix it.

## Why it is fast

Browser agents that "look at a screenshot, think, click, repeat" need 30-60 AI calls and minutes per application. Sudarshan never lets the AI drive the browser:

| | Screenshot-driven agent | Sudarshan |
|---|---|---|
| Finding jobs | Scroll and read pages | LinkedIn's public job listings over plain HTTP (your account untouched); Naukri's own search data read from the page |
| Reading a form | One screenshot per step | **One pass** reads every question, type, option, required flag and error |
| Answering | An AI call per field | **Profile rules -> answer memory -> one batched AI call** for whatever is left |
| Filling | One click per AI turn | **One pass** fills everything (typeaheads, uploads, radios, dropdowns) |
| Unknown sites | Re-think every visit | The first visit's path is saved as a per-site **recipe** and replayed without AI |
| Scoring jobs | 1 call per job | Free rules first, then **8 jobs per AI call** |

**Answer memory** compounds: after a few dozen applications most forms fill with **zero** AI calls - the dashboard shows this as **"Filled without AI"**.

---

## Quick start

**You need**

- [Node.js](https://nodejs.org) **22.13 or newer** (the LTS download is fine). Check with `node -v`.
- **Google Chrome**, **Microsoft Edge** or **Brave** (already on most computers).
- Works on **Windows, macOS and Linux**. No database, Docker or Python to install.

**Run**

```bash
git clone https://github.com/ankurpandey27/sudarshan-ai.git
cd sudarshan-ai
npm start
```

No Git? Click **Code -> Download ZIP** on this page, unzip it, open a terminal in the `sudarshan-ai` folder and run `npm start`.

That's the only command. The first run installs and builds (a few minutes), then opens **http://localhost:4747** in your browser. Later runs start in seconds and rebuild automatically after you pull updates.

**Stop:** press `Ctrl + C` in the terminal.

---

## First-run setup

The wizard has four steps (all but the resume are optional):

1. **Choose a brain** - pick an AI provider and model, or skip. See [Connecting an AI model](#connecting-an-ai-model).
2. **Your resume** - drop your PDF. Then fill **notice period, current CTC and expected CTC** - nearly every Indian job form asks for them.
3. **Your answers** - download the Excel template, fill what you know, upload it. See [The Excel sheet](#the-excel-sheet).
4. **Where to look** - job titles and locations (add `Remote` for remote roles), then **log in to LinkedIn and Naukri** inside the browser window Sudarshan opens. It keeps its own browser profile, so you log in once and it never sees your password.

Then open **Mission control** and press **Start agent**.

> **Tip for your first run:** in **Settings**, turn on **"Stop before the final Submit"**. Sudarshan fills every form and waits for you to press Submit - check a few, then turn it off.

---

## Connecting an AI model

Open **Settings -> AI model** (or step 1 of the wizard), then for any provider:

1. Click the provider.
2. Paste the key (if it needs one).
3. Pick a model - press the **refresh button** next to the Model box to load the provider's live model list.
4. Press **Test connection** (makes one real call), then **Save model**.

Keys are stored **encrypted on your computer** and are never shown again (only a hint like `sk-...3456`).

You can also add a **Fallback model** (Settings -> AI model -> *Fallback model (optional)*). If the main one fails or runs out of credits, Sudarshan switches automatically. A local Ollama model is a great fallback.

### Which one should I pick?

| Your situation | Pick | Cost |
|---|---|---|
| Want zero cost, have internet | **Google Gemini** (`gemini-2.5-flash`) | Free tier |
| Want zero cost, fastest | **Groq** (`llama-3.3-70b-versatile`) | Free tier |
| Want zero cost, fully offline and private | **Ollama** (`qwen2.5:7b`) | Free, runs on your PC |
| Want the best answers on long free-text questions | **Anthropic Claude** or **OpenAI** | Pay per use |
| One key for many models | **OpenRouter** or **OpenCode Zen** | Pay per use |

Because of answer memory, usage is small: typically one short call for a brand-new form, and none for repeated questions. The **daily token budget** in Settings caps paid spend (local models are unlimited).

### Anthropic (Claude)

1. Create a key at **https://console.anthropic.com/settings/keys** (add a little credit under Billing).
2. Settings -> **Anthropic Claude** -> paste the key.
3. Model: **`claude-haiku-4-5`** (fast, cheapest), **`claude-sonnet-5`** (balanced) or **`claude-opus-5`** (most capable).
4. Test connection -> Save model.

### OpenAI

1. Create a key at **https://platform.openai.com/api-keys** and add credit under *Settings -> Billing*. (A key with no credit returns *"You have no credits remaining"* - Sudarshan will show exactly that on the dashboard.)
2. Settings -> **OpenAI** -> paste the key.
3. Model: **`gpt-5-mini`** (recommended), or press refresh to choose another.
4. Test connection -> Save model.

### Google Gemini - free tier

1. Get a key at **https://aistudio.google.com/apikey** (sign in with Google, *Create API key*).
2. Settings -> **Google Gemini** -> paste the key.
3. Model: **`gemini-2.5-flash`** (free tier, fast) or `gemini-2.5-pro`.
4. Test connection -> Save model.

### Groq - free tier

1. Create a key at **https://console.groq.com/keys**.
2. Settings -> **Groq** -> paste the key.
3. Model: **`llama-3.3-70b-versatile`** (or press refresh for the current list).
4. Test connection -> Save model.

### OpenRouter

1. Create a key at **https://openrouter.ai/keys** and add credit.
2. Settings -> **OpenRouter** -> paste the key.
3. Model: e.g. `google/gemini-2.5-flash`, `anthropic/claude-sonnet-5`, `deepseek/deepseek-chat` - press refresh to browse all.
4. Test connection -> Save model.

### OpenCode Zen

1. Create a key at **https://opencode.ai/zen** (pay-as-you-go).
2. Settings -> **OpenCode Zen** -> paste the key.
3. Model: press refresh and pick any Zen model (for example a DeepSeek, Qwen, Kimi, GLM, Claude, GPT or Gemini model). Sudarshan detects the right protocol for each model family automatically.
4. Test connection -> Save model.

> **What about OpenCode Go?** Go is a subscription meant **only for coding agents** - its terms ask clients to *"send typical coding agent traffic"* and say traffic is monitored for abuse. Job-application traffic is not coding traffic, so using a Go key here could get your subscription flagged. Sudarshan therefore does not offer Go; use **Zen** (above), which has no such restriction, and keep Go for coding in OpenCode.

### Ollama - free, offline, private

1. Install from **https://ollama.com** (Windows, macOS, Linux).
2. Download a model in a terminal:
   ```bash
   ollama pull qwen2.5:7b      # recommended: good JSON, ~5 GB, 8 GB RAM
   # smaller machines:  ollama pull llama3.2:3b   (~2 GB)
   # bigger machines:   ollama pull qwen2.5:14b   (16 GB+ RAM)
   ```
3. Make sure Ollama is running (it starts automatically after install; or run `ollama serve`).
4. Settings -> **Ollama (local, free)** -> Model **`qwen2.5:7b`** (press refresh to list the models you have). No key needed.
5. Test connection -> Save model. The first call can take a while as the model loads.

### LM Studio - free, offline

1. Install **https://lmstudio.ai**, download a model (e.g. *Qwen2.5 7B Instruct*), load it.
2. In LM Studio open the **Developer / Local Server** tab and press **Start Server** (default `http://localhost:1234`).
3. Settings -> **LM Studio (local, free)** -> press refresh -> pick the loaded model.
4. Test connection -> Save model.

### Custom (any OpenAI-compatible server)

For DeepSeek, Together, Fireworks, a self-hosted vLLM, etc.:

1. Settings -> **Custom (OpenAI-compatible)**.
2. **Server URL** - the base URL including `/v1`, e.g. `https://api.deepseek.com/v1`.
3. Paste the key (if the server needs one) and the model id (e.g. `deepseek-chat`).
4. Test connection -> Save model.

### No AI at all

Skip the step. Sudarshan still works from your profile and answer memory: rule-based scoring, and any question it cannot answer comes to your **Questions** page instead of being drafted by AI.

---

## The Excel sheet

Download the template from the wizard or **Settings -> Spreadsheet -> Template**. One `.xlsx` (or `.csv`) with up to three sheets - all optional:

**Answers** - questions you already know the answers to. They go straight into answer memory.

| Question | Answer |
|---|---|
| What is your notice period? | 30 days |
| Expected CTC (in lakhs per annum) | 18 |
| Are you willing to relocate? | Yes |
| How many years of experience do you have with Node.js? | 4 |

**Job Links** - any job URLs. LinkedIn and Naukri links use their own adapters; everything else uses the generic career-site engine. They are queued straight away.

| URL | Title | Company | Notes |
|---|---|---|---|

**Preferences** - `Setting | Value` rows: Keywords, Locations, Remote only, Easy Apply only, Posted within days, Exclude companies, Exclude title words, Mode (`review`/`auto`), Min apply score, LinkedIn daily limit, Naukri daily limit, Notice period days, Current CTC, Expected CTC (e.g. `18 LPA`), Willing to relocate.

---

## Daily use

| Page | What it is for |
|---|---|
| **Mission control** | Start/stop, **What needs attention**, today's applications vs limits, the live **flight log**, AI spend |
| **Review** | Scored jobs with the reason. Approve them one by one, or all strong matches at once (*Approve all N jobs scoring 70+*). In **Auto** mode strong matches are queued for you |
| **Questions** | Questions only you can answer - answer once, every waiting job continues |
| **Applications** | Everything applied / needing attention, with the step-by-step trace of each attempt. Export to Excel, paste more links |
| **Answer memory** | See and edit everything Sudarshan has learned |
| **Profile** | Your details, skills (with years), CTC, notice period, resume |
| **Settings** | AI model, search, per-site daily limits, pacing, active hours, dry-run mode |

**Modes** - *Review* (default): Sudarshan finds and scores, you approve, it applies. *Auto*: it applies to anything above your auto-apply score on its own.

---

## When something goes wrong

Look at **Mission control -> What needs attention** first. Every problem is listed there with **what happened, how to fix it, and a button** that takes you there. Common ones:

| You see | Meaning | Fix |
|---|---|---|
| *Your \<provider\> account has no credits* | The AI key works but has no balance | Add credit, or switch to Gemini / Groq / Ollama (free) |
| *API key was rejected* | Wrong or expired key | Paste a new key, press Test connection |
| *All N jobs were skipped* | Nothing matched - the reasons are listed (skills, salary, location...) | Follow the fix shown; press **Re-score jobs** after changing your profile |
| *N jobs waiting for your approval* | You are in Review mode | Approve jobs in **Review** |
| *Not logged in to LinkedIn / Naukri* | The agent's browser session expired | Press **Log in** and sign in in the window that opens |
| *Profile is missing ...* | Forms will ask for these | Fill them on **Profile** |
| *Port 4747 is already in use* (terminal) | Sudarshan is already running | Open http://localhost:4747, or stop the other one |
| *No Chrome, Edge or Brave found* | No supported browser | Install Google Chrome |
| A captcha appears | The site wants a human | Solve it in the agent's browser window - Sudarshan waits and continues |

Each failed application also keeps a **screenshot** and a **step-by-step trace** (Applications -> open the job -> Attempts).

---

## Safety and privacy

- **Everything stays on your computer**, in `~/.sudarshan` (`%USERPROFILE%\.sudarshan` on Windows): the database, your resume, the agent's browser profile, logs and screenshots of failed attempts.
- **API keys are encrypted** (AES-256-GCM) with a key generated on your machine, and never sent back to the page.
- **No passwords stored** - you log in to job sites in the agent's own browser window.
- **Local only** - the server listens on `127.0.0.1` and rejects requests from other websites.
- The only traffic leaving your machine goes to the job sites you use and the AI provider you chose (none with a local model).

**Protect your accounts.** LinkedIn does not allow automated applications and restricts accounts that apply too fast. Defaults are deliberately conservative: **25 LinkedIn / 40 Naukri applications per day**, random 40-110 s gaps, a real visible browser, and captchas always handed to you. Raise limits at your own risk; you are responsible for how you use this tool.

---

## Configuration

Everything is set from the UI. For power users, environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `SUDARSHAN_PORT` | `4747` | Port of the local app |
| `SUDARSHAN_DATA_DIR` | `~/.sudarshan` | Where data is stored |
| `SUDARSHAN_OPEN_BROWSER` | `true` | Set `false` to not open the browser on start |
| `LOG_LEVEL` | `info` | `debug` for more detail |



---

## Updating and removing

**Update** to the latest version:

```bash
cd sudarshan-ai
git pull
npm start          # installs and rebuilds only what changed
```

Your data is not in the project folder, so updating never touches it.

**Remove Sudarshan completely:**

1. Stop it (`Ctrl + C`) and delete the `sudarshan-ai` folder.
2. Delete your data folder: `~/.sudarshan` (`%USERPROFILE%.sudarshan` on Windows). This erases your profile, resume copy, answers, encrypted keys and the agent's logged-in browser profile.

---

## For developers

```bash
npm run dev         # server (watch) on :4747 + UI with hot reload on :5173
npm test            # unit tests + a real-browser run of a LinkedIn-style multi-step form
npm run typecheck
npm run lint
```

```
apps/
  server/   NestJS + TypeScript, SQLite (node:sqlite), puppeteer-core
    modules/
      settings      user settings, encrypted keys
      llm           Anthropic SDK / OpenAI-compatible / OpenCode Zen transports, fallback,
                    daily budget, auth & credit-error circuit breaker, usage log
      profile       resume PDF -> profile (rules + AI), self-repair
      answers       answer memory (normalised keys + guarded fuzzy match), pending questions
      jobs          the jobs table is also the queue (crash-safe)
      discovery     LinkedIn guest API (HTTP), Naukri (its own search data in the browser)
      scoring       exclusions -> keyword filter -> weighted engine -> batched AI score
      browser       one persistent Chrome/Edge profile, per-site login state
      form-engine   in-page extractor + filler, profile rules, answer engine, recipes
      apply         LinkedIn Easy Apply, Naukri (incl. chat questions), generic career sites
      agent         the loop (discovery, one-at-a-time applying, caps, pacing) + insights
      workbook      Excel import / template / tracker export
  web/      React 19 + Vite + Tailwind v4 + TanStack Query, live updates over SSE
scripts/    start.mjs (the one command), dev.mjs
```

## Status and known gaps

- **Verified:** resume parsing, Excel import, LinkedIn discovery and scoring against the live site, the full multi-step form engine in a real browser, profile self-repair, security and key encryption.
- **Not yet verified against live logged-in accounts:** LinkedIn Easy Apply submission and the Naukri chat questionnaire. Their pages change often - use **Stop before the final Submit** for your first applications and report what the flight log shows.
- Workday-style portals that require creating an account usually end up as **"Do by hand"**.

## Contributing

Bug reports and pull requests are welcome. Job sites change their pages often, so the most useful report is:

1. What you expected and what happened.
2. The lines from the **flight log** around the problem (Mission control).
3. For a failed application: the step-by-step trace from **Applications -> the job -> Attempts**.

Please **remove personal details** (name, email, phone, salary) before posting logs or screenshots. For code changes, run `npm test`, `npm run typecheck` and `npm run lint` before opening a pull request.

## Disclaimer

Sudarshan automates actions in your own browser, on your own accounts. Automated applying may break a job site's terms of service, and sites can restrict accounts that apply too fast. The defaults are conservative, but **you are responsible for how you use it**. It is not affiliated with LinkedIn, Naukri or any AI provider.

## License

MIT - see [LICENSE](LICENSE).
