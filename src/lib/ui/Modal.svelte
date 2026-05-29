<script lang="ts">
	import { onMount } from 'svelte';

	let {
		title,
		placeholder,
		labels,
		initialValues,
		inputTypes,
		minValues,
		onConfirm,
		onCancel
	}: {
		title: string;
		placeholder: string[];
		labels?: string[];
		initialValues?: string[];
		inputTypes?: string[];
		minValues?: string[];
		onConfirm: (value: string[]) => void;
		onCancel: () => void;
	} = $props();

	let values = $state<string[]>([]);
	let dialogElement: HTMLDivElement;

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onCancel();
		}

		if (event.key === 'Enter') {
			onConfirm(values);
		}

		if (event.key === 'Tab') {
			const focusable = Array.from(
				dialogElement.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
			).filter((element) => !element.hasAttribute('disabled'));
			const first = focusable[0];
			const last = focusable.at(-1);

			if (!first || !last) return;

			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	onMount(() => {
		values = placeholder.map((_, index) => initialValues?.[index] ?? '');
		dialogElement.focus();
		dialogElement.querySelector('input')?.focus();
	});
</script>

<div class="backdrop" role="presentation" onclick={onCancel}></div>
<div
	class="modal"
	role="dialog"
	aria-modal="true"
	aria-label={title}
	tabindex="-1"
	bind:this={dialogElement}
	onkeydown={handleKeydown}
>
	<h2>{title}</h2>
	<div class="inputs">
		{#each placeholder as inputPlaceholder, index}
			<label>
				<span>{labels?.[index] ?? inputPlaceholder}</span>
				<input
					type={inputTypes?.[index] ?? 'text'}
					min={minValues?.[index]}
					placeholder={inputPlaceholder}
					bind:value={values[index]}
				/>
			</label>
		{/each}
	</div>
	<div class="actions">
		<button type="button" onclick={onCancel}>Cancel</button>
		<button class="primary" type="button" onclick={() => onConfirm(values)}>Confirm</button>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		background: rgba(0, 0, 0, 0.42);
	}

	.modal {
		position: fixed;
		z-index: 21;
		top: 50%;
		left: 50%;
		display: grid;
		width: min(420px, calc(100vw - 32px));
		gap: 16px;
		box-sizing: border-box;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-panel);
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
		padding: 20px;
		transform: translate(-50%, -50%);
	}

	h2 {
		margin: 0;
		font-size: 18px;
	}

	.inputs {
		display: grid;
		gap: 8px;
	}

	label {
		display: grid;
		gap: 5px;
		color: var(--text-secondary);
		font-size: 12px;
		font-weight: 700;
	}

	input {
		box-sizing: border-box;
		width: 100%;
		height: 36px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--input-bg);
		color: var(--text-primary);
		padding: 6px 9px;
	}

	.actions {
		display: flex;
		justify-content: end;
		gap: 8px;
	}

	button {
		min-height: 34px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--button-bg);
		color: var(--text-primary);
		padding: 6px 12px;
		cursor: pointer;
	}

	.primary {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 700;
	}
</style>
