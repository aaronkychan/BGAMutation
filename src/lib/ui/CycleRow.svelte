<script lang="ts">
	import { X } from 'lucide-svelte';

	let {
		index,
		cycle,
		multiplicity,
		focusCycleInput = false,
		disabled = false,
		onCycleInput,
		onMultiplicityInput,
		onRemove
	}: {
		index: number;
		cycle: string;
		multiplicity: number;
		focusCycleInput?: boolean;
		disabled?: boolean;
		onCycleInput: (value: string) => void;
		onMultiplicityInput: (value: number) => void;
		onRemove: () => void;
	} = $props();

	let cycleInput: HTMLInputElement;

	$effect(() => {
		if (focusCycleInput && cycleInput) {
			cycleInput.focus();
		}
	});
</script>

<div class:disabled class="cycle-row">
	<label class="cycle-label">
		<span>v{index + 1}</span>
		<input
			class="cycle-input"
			type="text"
			bind:this={cycleInput}
			value={cycle}
			placeholder="1, -2, 3"
			disabled={disabled}
			oninput={(event) => onCycleInput(event.currentTarget.value)}
		/>
	</label>
	<label class="multiplicity-label">
		<span>m</span>
		<input
			type="number"
			min="1"
			value={multiplicity}
			disabled={disabled}
			oninput={(event) => onMultiplicityInput(Math.max(1, event.currentTarget.valueAsNumber || 1))}
		/>
	</label>
	<button type="button" aria-label={`Remove vertex ${index + 1}`} disabled={disabled} onclick={onRemove}>
		<X size={14} />
	</button>
</div>

<style>
	.cycle-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 60px 30px;
		align-items: center;
		gap: 8px;
	}

	.disabled {
		opacity: 0.54;
		pointer-events: none;
	}

	.cycle-label {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 4px;
		min-width: 0;
		color: var(--text-secondary);
		font-size: 12px;
	}

	.cycle-input {
		width: 100%;
		min-width: 0;
		font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
	}

	input {
		box-sizing: border-box;
		height: 30px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--input-bg);
		color: var(--text-primary);
		padding: 4px 8px;
	}

	.multiplicity-label {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 4px;
		color: var(--text-secondary);
		font-size: 12px;
	}

	.multiplicity-label input {
		width: 42px;
		padding-inline: 6px;
	}

	button {
		display: inline-grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--button-bg);
		color: var(--text-secondary);
		cursor: pointer;
	}

	button:hover {
		border-color: var(--danger);
		color: var(--danger);
	}
</style>
