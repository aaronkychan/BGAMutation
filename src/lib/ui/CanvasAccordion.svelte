<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';

	const editActions = [
		'Add vertex',
		'(Re)connect arc',
		'Add orbifold edge',
		'Edit curve',
		'Remove vertex',
		'Remove arc/half-edge',
		'Modify multiplicity'
	];

	let {
		open,
		onToggle
	}: {
		open: boolean;
		onToggle: () => void;
	} = $props();
</script>

<section class="accordion">
	<button class="accordion-trigger" type="button" aria-expanded={open} onclick={onToggle}>
		<span>Edit graph on canvas</span>
		<ChevronDown class={open ? 'open' : ''} size={18} />
	</button>

	{#if open}
		<div class="button-list" aria-label="Canvas editing tools">
			{#each editActions as action}
				<button type="button" disabled title="Canvas editing is scheduled for a later stage">
					{action}
				</button>
			{/each}
		</div>
	{/if}
</section>

<style>
	.accordion {
		border-bottom: 1px solid var(--border);
	}

	.accordion-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		border: 0;
		background: transparent;
		color: var(--section-title);
		padding: 14px 0;
		font-weight: 700;
		cursor: pointer;
	}

	:global(.open) {
		transform: rotate(180deg);
	}

	.button-list {
		display: grid;
		gap: 8px;
		padding-bottom: 16px;
	}

	button:not(.accordion-trigger) {
		min-height: 34px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--button-bg);
		color: var(--text-primary);
		text-align: left;
		padding: 6px 10px;
	}

	button:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}
</style>
