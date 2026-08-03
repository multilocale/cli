# multilocale

Command-line access to your translations on
[app.multilocale.com](https://app.multilocale.com): projects and phrases,
machine translation into every configured locale, locale rollout,
cross-project phrase sharing, and translation-file download and import for
web and native app codebases.

## Install

```bash
npm install -g multilocale   # global install
npx multilocale --help       # or run without installing
```

Requires Node.js 16 or newer.

## Quick start

```bash
multilocale login            # opens the browser to authorize the CLI
multilocale projects list    # your projects with their ids
multilocale add "Save changes"   # add a phrase, translated to every project locale
```

```
Found 2 project(s):
1. example-app (64a1f2c9e4b0a1b2c3d4e5f6)
2. example-website (64a1f2c9e4b0a1b2c3d4e5f7)

en: Save changes
es: Guardar cambios
fr: Enregistrer les modifications
Added 3 phrases: https://app.multilocale.com/projects/64a1f2c9e4b0a1b2c3d4e5f6
```

## Signing up

No account yet? Create one from the terminal — the generated password prints
exactly once, and the session is stored so every other command works
immediately:

```bash
multilocale signup --email founder@example.com --json
```

## Authentication

There are two ways in:

```bash
multilocale login              # interactive: choose browser or API key
multilocale login --browser    # browser flow
multilocale login --with-key   # masked prompt for an API key secret
multilocale logout             # clear the stored session and any stored key
```

`multilocale login --browser` starts a temporary localhost server, opens your
browser to app.multilocale.com, and receives the session tokens on the
redirect back. If the browser does not open, the login URL is printed so you
can visit it by hand. Tokens are stored in `~/.multilocale/` and refreshed
automatically when they expire.

`multilocale login --with-key` prompts (masked) for an API key secret, created
per project on app.multilocale.com under the project's API keys page, verifies
it against the API, and stores it in `~/.multilocale/`. Alternatively export
`MULTILOCALE_API_KEY=<key secret>` — no login step needed, the key is read
from the environment on every command. The secret is never accepted as a
command-line argument. New keys default to read-only scopes; widen them on
the key's page before running write commands.

Precedence: a stored browser session wins over a stored key, which wins over
the environment variable — so an exported `MULTILOCALE_API_KEY` never silently
hijacks an interactive session.

In an interactive terminal, commands that need a session and find none start
the browser login on their own. Without a terminal (agents, CI, pipes) they
fail fast with exit code 1 and login instructions on stderr instead of opening
a browser.

## Machine-readable output

Every data command accepts `--json`: raw, parseable JSON on stdout, no color.
Mutations print a small result object (`{ "ok": true, … }`). Errors always go
to stderr with exit code 1 — as a single-line JSON object when `--json` is
set — and progress logs move to stderr in json mode, so stdout is exactly the
JSON result.

```bash
multilocale projects list --json
multilocale phrases get SOME_KEY --json
multilocale schema                  # the whole command tree as JSON
multilocale schema phrases list     # one subcommand's arguments and flags
```

## Commands

### Session

```bash
multilocale login    # log in via browser or API key; credentials land in ~/.multilocale/
multilocale logout   # clear the stored session and any stored key
```

### Projects

```bash
multilocale projects list                    # list projects with their ids
multilocale projects get [projectIdOrName]   # raw JSON; all projects when omitted
multilocale projects read <projectIdOrName>  # formatted single-project view
multilocale projects create <name> --locales en,es,fr --default-locale en
```

Project names are unique per organization, so commands accept a project by id
or by name interchangeably. `projects create` always includes the default
locale in the locale list.

### Phrases

```bash
multilocale phrases list                     # all phrases, grouped by language
multilocale phrases list -l fr               # one language (-l/--language)
multilocale phrases list -k SOME_KEY         # one key across languages (-k/--key)
multilocale phrases list --languages         # only the list of languages
multilocale phrases get [key] -l fr -n 20    # raw JSON rows (-n/--limit)

multilocale add "SOME_KEY" "Some value"      # add + machine-translate to all locales
multilocale add "Some value"                 # value defaults to the key
multilocale update "SOME_KEY" "New value" -l fr   # set one language's value
multilocale delete "SOME_KEY"                # delete the key's rows from the project
multilocale share "SOME_KEY" other-project   # attach another project to the phrase
```

`add` creates the phrase in the project's default locale and machine-translates
it into every other configured locale; it refuses a key that already exists in
the project. `update` sets the exact value for one key and language (default:
the project's default locale) and clears the machine-translated flags. Phrases
can be shared across projects: `update` warns and changes the value for every
project sharing the key, and `delete` removes shared rows outright rather than
detaching the current project — check `multilocale phrases get <key>` first.

`share` attaches one or more target projects (by id or name) to every locale
row of an existing phrase; `--project` selects the source project. The targets
receive only the locales the source phrase has.

### Locale rollout

```bash
multilocale localize fr,de,ja    # add locales and translate every phrase into them
multilocale localize all         # every supported locale
```

Adds the locales to the project, then machine-translates every existing phrase
into them. Interruptions are safe: a re-run translates only what is still
missing.

### Translation files

```bash
multilocale download             # write dictionary files into the working tree
multilocale download --format esm --extension js
multilocale download --header "/* generated */" --post-script "prettier --write translations/"
multilocale import               # upload existing local translation files
```

`download` detects the project type from the working directory:

- Android (an `AndroidManifest.xml` is present): writes
  `res/values-<locale>/strings.xml` per language, with Android's escaping
  rules applied.
- Everything else: writes one file per locale at the project's configured
  `paths` (with a `%lang%` placeholder), defaulting to
  `translations/<locale>.json` — or `<locale>.lproj/Localizable.strings` for
  the `swift` format.

| `--format` | Output                          | Default `--extension` |
| ---------- | ------------------------------- | --------------------- |
| `json`     | plain JSON object               | `json`                |
| `esm`      | `export default { … }`          | `js`                  |
| `js`       | `module.exports = { … }`        | `js`                  |
| `cjs`      | `module.exports = { … }`        | `js`                  |
| `swift`    | Apple `.strings` key/value file | `strings`             |

`import` is the reverse, for onboarding an existing codebase: it reads the
Android `strings.xml` files or the JSON dictionaries matching the project's
paths, uploads them as phrases, and machine-translates keys missing from some
configured locales. Import once per codebase — re-importing creates duplicate
rows rather than merging.

### Audits

```bash
multilocale duplicates   # keys sharing the same default-language value
multilocale unused       # keys not referenced in any local source file
```

`unused` scans JavaScript sources (`.js`, `.jsx`, `.ts`, `.tsx`, `.cjs`,
`.mjs`) for each key; keys assembled dynamically at runtime will look unused,
so treat the output as candidates. Android projects are not supported yet.

### Skills

```bash
multilocale skills list              # names and descriptions of the bundled agent guides
multilocale skills get multilocale   # print a bundled SKILL.md to stdout
```

### Schema

```bash
multilocale schema                   # the whole command tree as JSON
multilocale schema projects create   # one command's arguments and flags
```

## Machine translation

`add` and `localize` accept `-m/--model` to pick the translation model:
`gpt-5-nano` (default), `gpt-5-mini`, `gemini-3.5-flash`, or
`claude-haiku-4-5`. `add` also accepts `-c/--context` — a free-text hint
passed to the model. For short or ambiguous UI strings, always pass the
product domain, what the word means there, and the UI role; an isolated
two-word string routinely machine-translates to the wrong sense.

```bash
multilocale add "Max guests" \
  --model gpt-5-mini \
  --context "Hotel software; the maximum number of guests a room sleeps, not software users"
```

## Configuration

A `multilocale.json` anywhere under the working directory supplies the default
project:

```json
{ "organizationId": "…", "projectId": "…" }
```

When it is missing, commands list your projects, ask which one to use, and
write the file for next time. `--project <idOrName>` overrides it per
invocation. The same file can also hold `download` defaults: `format`,
`extension`, `header`, `postScript`, and `paths` (an array of file patterns
containing `%lang%`).

## Usage with AI agents

Install the Multilocale agent skills — `multilocale` (this CLI) and
`localization-workspace` (the MCP-based localization workflow) — for Claude
Code, Cursor, Codex, and any other agent that supports the Skills standard:

```bash
npx skills add multilocale/skills
```

The same guides ship inside the npm package, version-matched to the installed
CLI:

```bash
multilocale skills list              # what is bundled
multilocale skills get multilocale   # the CLI guide matching this version
```

Or paste this into your `AGENTS.md` / `CLAUDE.md`:

```markdown
## Translations

Use the `multilocale` CLI for translation management: adding and fixing
phrases, locale rollout, and translation-file download/import on
multilocale.com. Run `npx multilocale skills get multilocale` for the full
guide, and `multilocale --help` for the command reference. Log in once with
`multilocale login`.
```

Prefer a connector? The Multilocale MCP server at
`https://mcp.multilocale.com/mcp` exposes the same data as tools for Claude,
ChatGPT, and any MCP-capable host — see
[multilocale.com/developers](https://www.multilocale.com/developers/).

## License

[Apache-2.0](LICENSE)
