<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import type { RenderOptions } from '$lib/graph/types';

	let {
		renderOptions,
		onRenderOptionsChange
	}: {
		renderOptions: RenderOptions;
		onRenderOptionsChange: (options: RenderOptions) => void;
	} = $props();

	let open = $state(true);

	function updateDisplayToggle(
		toggle: keyof Pick<
			RenderOptions,
			'showOrderArrows' | 'showHalfEdgeLabels' | 'showMultiplicityLabels' | 'showEdgeLabels'
		>,
		checked: boolean
	) {
		onRenderOptionsChange({ ...renderOptions, [toggle]: checked });
	}
</script>

<section class="display-toggles" aria-label="Display toggles">
	<button class="section-trigger" type="button" aria-expanded={open} onclick={() => (open = !open)}>
		<span>Display toggles</span>
		<ChevronDown class={open ? 'open' : ''} size={18} />
	</button>
	{#if open}
		<div class="toggle-list">
			<label class="switch">
				<input
					type="checkbox"
					checked={renderOptions.showOrderArrows}
					onchange={(event) => updateDisplayToggle('showOrderArrows', event.currentTarget.checked)}
				/>
				Show cyclic ordering as arrows
			</label>
			<label class="switch">
				<input
					type="checkbox"
					checked={renderOptions.showHalfEdgeLabels}
					onchange={(event) => updateDisplayToggle('showHalfEdgeLabels', event.currentTarget.checked)}
				/>
				Half-edge labels
			</label>
			<label class="switch">
				<input
					type="checkbox"
					checked={renderOptions.showMultiplicityLabels}
					onchange={(event) => updateDisplayToggle('showMultiplicityLabels', event.currentTarget.checked)}
				/>
				Multiplicity labels
			</label>
			<label class="switch">
				<input
					type="checkbox"
					checked={renderOptions.showEdgeLabels}
					onchange={(event) => updateDisplayToggle('showEdgeLabels', event.currentTarget.checked)}
				/>
				Edge labels
			</label>
		</div>
	{/if}
</section>

<style>
	.display-toggles {
		display: grid;
		gap: 10px;
		border-bottom: 1px solid var(--border);
		padding: 0;
	}

	.section-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		border: 0;
		background: transparent;
		color: var(--section-title);
		padding: 14px 0;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
	}

	:global(.open) {
		transform: rotate(180deg);
	}

	.toggle-list {
		display: grid;
		gap: 8px;
		padding-bottom: 16px;
	}

	.switch {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 8px;
		color: var(--text-primary);
		font-size: 14px;
	}

	.switch input {
		width: 16px;
		height: 16px;
	}
</style>
