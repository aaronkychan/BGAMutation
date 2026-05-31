<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import { computeTopologyMetrics, validateBrauerGraph } from '$lib/math/ribbon';
	import type { BrauerGraph } from '$lib/math/types';

	let {
		graph,
		open = true,
		onToggle
	}: {
		graph: BrauerGraph | null;
		open?: boolean;
		onToggle?: () => void;
	} = $props();

	let metrics = $derived(graph ? computeTopologyMetrics(graph) : null);
	let validationErrors = $derived(graph ? validateBrauerGraph(graph) : []);
	let orbifoldCount = $derived(metrics?.orbifoldEdges ?? 0);
	let graphType = $derived(orbifoldCount > 0 ? 'Orbifold ribbon graph' : 'Ordinary ribbon graph');
</script>

<section class="info-box" aria-live="polite">
	<button class="section-trigger" type="button" aria-expanded={open} onclick={onToggle}>
		<span>Graph info</span>
		<span class="trigger-tools">
			<ChevronDown class={open ? 'open' : ''} size={18} />
		</span>
	</button>
	{#if open}
		{#if graph}
			{#if validationErrors.length > 0}
				<p class="warning">Current graph is not a valid ribbon graph.</p>
			{/if}
			<dl>
				<div><dt>Type</dt><dd>{graphType}</dd></div>
				<div><dt>Vertices</dt><dd>{metrics?.vertices}</dd></div>
				<div><dt>Edges</dt><dd>{metrics?.edges}</dd></div>
				<div><dt>Faces</dt><dd>{metrics?.faces}</dd></div>
				<div><dt>Connected</dt><dd>{metrics?.connected ? 'Yes' : 'No'}</dd></div>
				{#if orbifoldCount > 0}
					<div><dt>Orbifold edges</dt><dd>{orbifoldCount}</dd></div>
				{:else}
					<div><dt>Genus</dt><dd>{metrics?.genus}</dd></div>
				{/if}
			</dl>
		{:else}
			<p>No graph has been drawn.</p>
		{/if}
	{/if}
</section>

<style>
	.info-box {
		border-bottom: 1px solid var(--border);
		padding: 16px 0;
	}

	.section-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		border: 0;
		background: transparent;
		color: var(--section-title);
		padding: 0 0 10px;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
	}

	:global(.open) {
		transform: rotate(180deg);
	}

	.trigger-tools {
		display: inline-flex;
		align-items: center;
	}

	.trigger-tools {
		gap: 8px;
	}

	p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 14px;
		line-height: 1.4;
	}

	.warning {
		margin-bottom: 10px;
		color: var(--danger);
	}

	dl {
		display: grid;
		gap: 8px;
		margin: 0;
	}

	div {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 14px;
	}

	dt {
		color: var(--text-secondary);
	}

	dd {
		margin: 0;
		font-weight: 700;
		text-align: right;
	}
</style>
