<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';

	const editActions: Array<{ label: string; action: string; enabled: boolean }> = [
		{ label: 'Add vertex', action: 'add-vertex', enabled: false },
		{ label: '(Re)connect arc', action: 'reconnect-arc', enabled: false },
		{ label: 'Add orbifold edge', action: 'add-orbifold-edge', enabled: false },
		{ label: 'Edit curve', action: 'edit-curve', enabled: false },
		{ label: 'Adjust emanating angle', action: 'adjust-emanating-angle', enabled: true },
		{ label: 'Rotate vertex', action: 'rotate-vertex', enabled: false },
		{ label: 'Undo', action: 'undo', enabled: false },
		{ label: 'Remove vertex', action: 'remove-vertex', enabled: false },
		{ label: 'Remove arc/half-edge', action: 'remove-edge', enabled: false },
		{ label: 'Modify multiplicity', action: 'modify-multiplicity', enabled: false }
	];

	let {
		open,
		activeAction = '',
		onToggle,
		onAction
	}: {
		open: boolean;
		activeAction?: string;
		onToggle: () => void;
		onAction?: (action: string) => void;
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
				<button
					type="button"
					class:active={activeAction === action.action}
					disabled={!action.enabled}
					title={action.enabled ? action.label : 'Canvas editing is scheduled for a later stage'}
					onclick={() => onAction?.(action.action)}
				>
					{action.label}
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

	button.active:not(:disabled) {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 700;
	}
</style>
