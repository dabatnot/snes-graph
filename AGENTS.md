# Engineering principles

Keep the simplest solution that meets the current need. Apply KISS and YAGNI.
Avoid speculative abstractions, frameworks, wrappers and configuration layers.
Use DRY only when a shared concept is established; small duplication is preferable
to the wrong abstraction. Tests protect real behavior, not metrics.
Design interfaces for users: include only information that helps them understand,
decide or act. Do not fill empty space with developer details or decorative content.

# Language and documentation

English is the default for the product and all project-authored Markdown, working
notes, commits, pull requests and releases. Preserve French UI/manual translations,
user content and original third-party notices. Do not rewrite historical evidence.
For every user-visible feature or command change, apply the repository-local
[snes-graph-docs](.agents/skills/snes-graph-docs/SKILL.md) skill in the same task.
Internal changes without user impact do not require manual edits.

# Versions and delivery

`package.json` owns the application version, independently of the project format.
Use `npm run version:set -- VERSION` and `npm run version:check`.
Use [snes-graph-release](.agents/skills/snes-graph-release/SKILL.md) for version
preparation, packaging and releases. Develop on `develop`; release annotated
stable tags from `main`. Preparing a release does not authorize merging or tagging.
Run targeted checks, then the shared checks required by CI. Report unavailable
platform checks explicitly; building does not prove graphical behavior.
