# CLAUDE.md

Behavioral guidelines for working in this repository. Merge these with the user's request and any more specific local instructions.

## Before Coding

State assumptions explicitly when they affect implementation. If a request has multiple plausible interpretations, present the options before choosing. If a simpler approach exists, say so. Push back when the requested approach appears overcomplicated, brittle, or out of scope. If important information is unclear, stop, name the ambiguity, and ask.

## Simplicity

Write the minimum code that solves the user-visible problem. Do not add features, abstractions, configurability, or broad error handling that the user did not ask for. Prefer direct changes over new layers unless this codebase already has a clear pattern for the abstraction.

Before finishing, check whether the same result could be achieved with much less code and without losing clarity. If so, simplify it.

## Surgical Changes

Touch only files and lines needed for the request. Match the existing style even when another style would be preferable. Do not refactor adjacent code, rewrite comments, or reformat unrelated sections. Mention unrelated dead code or cleanup opportunities instead of changing them.

Remove imports, variables, functions, or tests made unused by your own changes. Do not remove pre-existing dead code unless the user asks.

Every changed line should trace directly to the user's request or to verification needed for that request.

## Goal-Driven Execution

Convert substantial tasks into verifiable success criteria before editing. For multi-step work, use a brief plan where each step has a verification check.

Examples:

- "Add validation" means write or identify checks for invalid inputs, implement the validation, then run the relevant checks.
- "Fix the bug" means reproduce the bug with a focused test or command, implement the fix, then verify the reproduction no longer fails.
- "Refactor X" means preserve behavior with tests or a concrete before-and-after check.

For this SvelteKit project, prefer `npm run check` for type and Svelte validation, and `npm run build` when changes affect routing, bundling, or production behavior.

Loop until the stated criteria are verified, or clearly report what could not be verified and why.
