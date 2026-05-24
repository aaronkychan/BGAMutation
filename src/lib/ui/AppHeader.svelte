<script lang="ts">
	import { Menu, Moon, Sun, X } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let {
		drawerOpen,
		onToggleDrawer
	}: {
		drawerOpen: boolean;
		onToggleDrawer: () => void;
	} = $props();

	let theme = $state<'light' | 'dark'>('light');

	function applyTheme(nextTheme: 'light' | 'dark') {
		theme = nextTheme;
		document.documentElement.dataset.theme = nextTheme;
		localStorage.setItem('bga-theme', nextTheme);
	}

	onMount(() => {
		const savedTheme = localStorage.getItem('bga-theme');
		const preferredDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		applyTheme(savedTheme === 'dark' || (!savedTheme && preferredDark) ? 'dark' : 'light');
	});
</script>

<header class="app-header">
	<button
		class="icon-button drawer-button"
		type="button"
		aria-label={drawerOpen ? 'Close controls' : 'Open controls'}
		aria-expanded={drawerOpen}
		onclick={onToggleDrawer}
	>
		{#if drawerOpen}
			<X size={18} />
		{:else}
			<Menu size={18} />
		{/if}
	</button>

	<div class="title-block">
		<h1>Brauer Graph Mutation Visualiser</h1>
	</div>

	<button
		class="theme-button"
		type="button"
		aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
		title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
		onclick={() => applyTheme(theme === 'light' ? 'dark' : 'light')}
	>
		{#if theme === 'light'}
			<Moon size={18} />
		{:else}
			<Sun size={18} />
		{/if}
	</button>
</header>

<style>
	.app-header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 14px;
		box-sizing: border-box;
		width: 100%;
		min-height: 64px;
		border-bottom: 1px solid var(--border);
		background: var(--bg-panel);
		padding: 10px 18px;
	}

	.title-block {
		min-width: 0;
	}

	h1 {
		margin: 0;
	}

	h1 {
		font-size: 19px;
		font-weight: 700;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	button {
		border: 1px solid var(--border);
		background: var(--button-bg);
		color: var(--text-primary);
	}

	.icon-button,
	.theme-button {
		display: inline-grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 6px;
		cursor: pointer;
	}

	.drawer-button {
		display: none;
	}

	.theme-button {
		justify-self: end;
	}

	button:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	@media (max-width: 1024px) and (min-width: 641px) {
		.drawer-button {
			display: inline-grid;
		}
	}

	@media (max-width: 640px) {
		.app-header {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.drawer-button {
			display: none;
		}

		h1 {
			font-size: 17px;
		}
	}
</style>
