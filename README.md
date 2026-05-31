# BGAMutation

BGAMutation is a SvelteKit web application for drawing and experimenting with
Brauer graphs and orbifold Brauer graphs. It provides numerical graph input,
interactive canvas editing, visual display controls, save/load support, and
animated Kaur mutation of selected edges.

The app is intended as a lightweight research and teaching tool for working with
ribbon graph combinatorics behind Brauer graph algebras and their skew/orbifold
variants.

## Development

Install dependencies:

```sh
bun install
```

Start the local development server:

```sh
bun run dev
```

Check TypeScript and Svelte diagnostics:

```sh
bun run check
```

Build the static GitHub Pages output:

```sh
bun run build
```

The static build is written to `docs/`.
