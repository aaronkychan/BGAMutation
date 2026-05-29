<script lang="ts">
	import type { RenderOptions } from '$lib/graph/types';

	let {
		renderOptions,
		onRenderOptionsChange
	}: {
		renderOptions: RenderOptions;
		onRenderOptionsChange: (options: RenderOptions) => void;
	} = $props();

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
	<div class="section-title">Display toggles</div>
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
</section>

<style>
	.display-toggles {
		display: grid;
		gap: 10px;
		border-bottom: 1px solid var(--border);
		padding: 14px 0 16px;
	}

	.section-title {
		color: var(--section-title);
		font-size: 12px;
		font-weight: 800;
	}

	.toggle-list {
		display: grid;
		gap: 8px;
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
