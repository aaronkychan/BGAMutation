<script lang="ts">
	import { AlertTriangle, CheckCircle2, ChevronDown, Plus } from 'lucide-svelte';
	import { tick } from 'svelte';
	import { examples } from '$lib/math/examples';
	import type { BrauerGraph } from '$lib/math/types';
	import type { RenderOptions } from '$lib/graph/types';
	import CycleRow from './CycleRow.svelte';

	type LayoutMode = 'circle' | 'grid' | 'line';
	type Direction = 'CW' | 'CCW';

	interface CycleFormRow {
		cycle: string;
		multiplicity: number;
	}

	let {
		open,
		currentGraph,
		disabled = false,
		onToggle,
		onDraw,
		onRenderOptionsChange,
		onClear,
		renderOptions,
		errors = []
	}: {
		open: boolean;
		currentGraph: BrauerGraph | null;
		disabled?: boolean;
		onToggle: () => void;
		onDraw: (graph: BrauerGraph, options: RenderOptions) => void;
		onRenderOptionsChange: (options: RenderOptions) => void;
		onClear: () => void;
		renderOptions: RenderOptions;
		errors?: { field: string; message: string }[];
	} = $props();

	let edgeCount = $state(0);
	let orbifoldEdgesInput = $state('');
	let rows = $state<CycleFormRow[]>([{ cycle: '', multiplicity: 1 }]);
	let showOrderArrows = $state(false);
	let showHalfEdgeLabels = $state(false);
	let showMultiplicityLabels = $state(false);
	let showEdgeLabels = $state(false);
	let direction = $state<Direction>('CW');
	let layout = $state<LayoutMode>('circle');
	let selectedExample = $state('');
	let focusedCycleRowIndex = $state<number | null>(null);
	let showUnusedHalfEdges = $state(false);
	let syncedGraph: BrauerGraph | null = null;

	let orbifoldEdges = $derived(
		orbifoldEdgesInput
			.split(',')
			.map((part) => Number.parseInt(part.trim(), 10))
			.filter((value) => Number.isInteger(value) && value > 0)
	);
	let ordinaryEdgeCount = $derived(Math.max(0, edgeCount - orbifoldEdges.length));
	let expectedHalfEdges = $derived(computeExpectedHalfEdges());
	let usedHalfEdges = $derived(computeUsedHalfEdges());
	let missingHalfEdges = $derived(expectedHalfEdges.filter((halfEdge) => !usedHalfEdges.has(halfEdge)));
	let invalidHalfEdges = $derived(computeInvalidHalfEdges());

	function errorFor(field: string): string | undefined {
		return errors.find((error) => error.field === field)?.message;
	}

	function resetRows() {
		rows = [{ cycle: '', multiplicity: 1 }];
		selectedExample = '';
		focusedCycleRowIndex = null;
		showUnusedHalfEdges = false;
	}

	function setEdgeCount(value: number) {
		edgeCount = Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
		selectedExample = '';
	}

	function parseCycle(value: string): number[] {
		return value
			.split(',')
			.map((part) => Number.parseInt(part.trim(), 10))
			.filter((part) => Number.isInteger(part) && part !== 0);
	}

	function graphFromRows(): BrauerGraph {
		const sigma0 = rows.map((row) => parseCycle(row.cycle));
		const multiplicity = rows.map((row) => row.multiplicity);
		return {
			n: edgeCount,
			...(orbifoldEdges.length ? { orbifoldEdges } : {}),
			sigma0,
			multiplicity
		};
	}

	function computeExpectedHalfEdges(): number[] {
		const orbifoldSet = new Set(orbifoldEdges);
		const halfEdges: number[] = [];

		for (let edge = 1; edge <= edgeCount; edge += 1) {
			halfEdges.push(edge);
			if (!orbifoldSet.has(edge)) halfEdges.push(-edge);
		}

		return halfEdges;
	}

	function computeUsedHalfEdges(): Set<number> {
		return new Set(rows.flatMap((row) => parseCycle(row.cycle)));
	}

	function computeInvalidHalfEdges(): number[] {
		const expected = new Set(expectedHalfEdges);
		const invalid = rows
			.flatMap((row) => parseCycle(row.cycle))
			.filter((halfEdge) => !expected.has(halfEdge));

		return [...new Set(invalid)].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
	}

	function formatHalfEdges(halfEdges: number[]): string {
		return halfEdges.length ? halfEdges.join(', ') : 'none';
	}

	function loadExample(name: string) {
		selectedExample = name;
		const example = examples.find((candidate) => candidate.name === name);
		if (!example) return;

		edgeCount = example.graph.n;
		orbifoldEdgesInput = example.graph.orbifoldEdges?.join(', ') ?? '';
		rows = example.graph.sigma0.map((cycle, index) => ({
			cycle: cycle.join(', '),
			multiplicity: example.graph.multiplicity[index] ?? 1
		}));
		focusedCycleRowIndex = null;
	}

	function syncFromGraph(graph: BrauerGraph) {
		edgeCount = graph.n;
		orbifoldEdgesInput = graph.orbifoldEdges?.join(', ') ?? '';
		rows = graph.sigma0.map((cycle, index) => ({
			cycle: cycle.join(', '),
			multiplicity: graph.multiplicity[index] ?? 1
		}));
		selectedExample = '';
		focusedCycleRowIndex = null;
		showUnusedHalfEdges = false;
		syncedGraph = graph;
	}

	function clearForm() {
		edgeCount = 0;
		orbifoldEdgesInput = '';
		rows = [{ cycle: '', multiplicity: 1 }];
		showOrderArrows = false;
		showHalfEdgeLabels = false;
		showMultiplicityLabels = false;
		showEdgeLabels = false;
		direction = 'CW';
		layout = 'circle';
		selectedExample = '';
		focusedCycleRowIndex = null;
		onClear();
	}

	async function addVertexRow() {
		const nextIndex = rows.length;
		rows = [...rows, { cycle: '', multiplicity: 1 }];
		focusedCycleRowIndex = nextIndex;
		await tick();
		focusedCycleRowIndex = null;
	}

	function drawCurrentGraph() {
		onDraw(graphFromRows(), {
			showOrderArrows,
			showHalfEdgeLabels,
			showMultiplicityLabels,
			showEdgeLabels,
			direction,
			layout
		});
	}

	function currentRenderOptions(): RenderOptions {
		return {
			showOrderArrows,
			showHalfEdgeLabels,
			showMultiplicityLabels,
			showEdgeLabels,
			direction,
			layout
		};
	}

	function updateDisplayToggle(toggle: keyof Pick<RenderOptions, 'showOrderArrows' | 'showHalfEdgeLabels' | 'showMultiplicityLabels' | 'showEdgeLabels'>, checked: boolean) {
		if (toggle === 'showOrderArrows') showOrderArrows = checked;
		if (toggle === 'showHalfEdgeLabels') showHalfEdgeLabels = checked;
		if (toggle === 'showMultiplicityLabels') showMultiplicityLabels = checked;
		if (toggle === 'showEdgeLabels') showEdgeLabels = checked;
		onRenderOptionsChange(currentRenderOptions());
	}

	$effect(() => {
		showOrderArrows = renderOptions.showOrderArrows;
		showHalfEdgeLabels = renderOptions.showHalfEdgeLabels;
		showMultiplicityLabels = renderOptions.showMultiplicityLabels;
		showEdgeLabels = renderOptions.showEdgeLabels;
		direction = renderOptions.direction;
		layout = renderOptions.layout;
	});

	$effect(() => {
		if (disabled && currentGraph && currentGraph !== syncedGraph) {
			syncFromGraph(currentGraph);
		}
	});
</script>

<section class:disabled class="accordion">
	<button class="accordion-trigger" type="button" aria-expanded={open} onclick={onToggle}>
		<span>Numerical edit</span>
		<ChevronDown class={open ? 'open' : ''} size={18} />
	</button>

	{#if open}
		<div class="accordion-body">
			<div class="field-group">
				<div class="edge-count-row">
					<label class="edge-count-field">
						<span class="label">#ordinary+orbifold edges: </span>
						<input
							type="number"
							min="0"
							value={edgeCount}
							disabled={disabled}
							onchange={(event) => setEdgeCount(event.currentTarget.valueAsNumber)}
						/>
					</label>
					<div class="compact-h-field">
						<span class="label">#ordinary edges</span>
						<div class="compact-h-display" aria-label="Ordinary edge count">{ordinaryEdgeCount}</div>
					</div>
				</div>
				{#if errorFor('edgeCount')}
					<p class="field-error">{errorFor('edgeCount')}</p>
				{/if}
				<label>
					<span class="label">Orbifold edges</span>
					<input
						type="text"
						value={orbifoldEdgesInput}
						placeholder="empty, or 3, 4"
						disabled={disabled}
						oninput={(event) => {
							orbifoldEdgesInput = event.currentTarget.value;
							selectedExample = '';
						}}
					/>
				</label>
				{#if errorFor('orbifoldEdges')}
					<p class="field-error">{errorFor('orbifoldEdges')}</p>
				{/if}
			</div>

			<div class="field-group">
				<div class="cycle-heading">
					<span class="label">Cyclic ordering σ₀ + multiplicity m</span>
					<div class="unused-info">
						<button
							class="info-button"
							class:complete={!missingHalfEdges.length}
							class:incomplete={missingHalfEdges.length > 0}
							type="button"
							aria-expanded={showUnusedHalfEdges}
							aria-label={missingHalfEdges.length
								? 'Show unused half-edges'
								: 'All half-edges are attached to vertices'}
							disabled={disabled}
							onclick={() => (showUnusedHalfEdges = !showUnusedHalfEdges)}
						>
							{#if missingHalfEdges.length}
								<AlertTriangle size={14} />
							{:else}
								<CheckCircle2 size={15} />
							{/if}
						</button>
						{#if showUnusedHalfEdges}
							<div class="unused-popover" role="status">
								{#if missingHalfEdges.length}
									<strong>Unused half-edges</strong>
									<span>{formatHalfEdges(missingHalfEdges)}</span>
								{:else}
									<strong>All half-edges are attached to vertices</strong>
								{/if}
							</div>
						{/if}
					</div>
				</div>
				{#if invalidHalfEdges.length}
					<p class="field-warning">
						Out of range for current edge count/orbifold edges: {formatHalfEdges(invalidHalfEdges)}
					</p>
				{/if}
				<div class="cycle-list">
					{#each rows as row, index}
						<CycleRow
							{index}
							cycle={row.cycle}
							multiplicity={row.multiplicity}
							focusCycleInput={focusedCycleRowIndex === index}
							{disabled}
							onCycleInput={(value) => {
								rows[index] = { ...rows[index], cycle: value };
							}}
							onMultiplicityInput={(value) => {
								rows[index] = { ...rows[index], multiplicity: value };
							}}
							onRemove={() => {
								rows = rows.filter((_, rowIndex) => rowIndex !== index);
							}}
						/>
						{#if errorFor(`cycle-${index}`)}
							<p class="field-error">{errorFor(`cycle-${index}`)}</p>
						{/if}
						{#if errorFor(`multiplicity-${index}`)}
							<p class="field-error">{errorFor(`multiplicity-${index}`)}</p>
						{/if}
					{/each}
				</div>
				{#if errorFor('sigma0')}
					<p class="field-error">{errorFor('sigma0')}</p>
				{/if}
				<button
					class="link-button"
					type="button"
					disabled={disabled}
					onclick={addVertexRow}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							addVertexRow();
						}
					}}
				>
					<Plus size={14} />
					Add vertex
				</button>
			</div>

			<div class="field-group">
				<span class="label">Display toggles</span>
				<label class="switch"><input type="checkbox" checked={showOrderArrows} disabled={disabled} onchange={(event) => updateDisplayToggle('showOrderArrows', event.currentTarget.checked)} /> Show cyclic ordering as arrows</label>
				<label class="switch"><input type="checkbox" checked={showHalfEdgeLabels} disabled={disabled} onchange={(event) => updateDisplayToggle('showHalfEdgeLabels', event.currentTarget.checked)} /> Half-edge labels</label>
				<label class="switch"><input type="checkbox" checked={showMultiplicityLabels} disabled={disabled} onchange={(event) => updateDisplayToggle('showMultiplicityLabels', event.currentTarget.checked)} /> Multiplicity labels</label>
				<label class="switch"><input type="checkbox" checked={showEdgeLabels} disabled={disabled} onchange={(event) => updateDisplayToggle('showEdgeLabels', event.currentTarget.checked)} /> Edge labels</label>
			</div>

			<div class="field-group">
				<span class="label">Ordering direction</span>
				<div class="segmented" role="group" aria-label="Ordering direction">
					<button type="button" class:active={direction === 'CW'} disabled={disabled} onclick={() => (direction = 'CW')}>CW</button>
					<button type="button" class:active={direction === 'CCW'} disabled={disabled} onclick={() => (direction = 'CCW')}>CCW</button>
				</div>
			</div>

			<div class="field-group">
				<span class="label">Initial vertices layout</span>
				<div class="layout-radio-row">
					<label class="radio"><input type="radio" bind:group={layout} value="circle" disabled={disabled} /> Circle</label>
					<label class="radio"><input type="radio" bind:group={layout} value="grid" disabled={disabled} /> Grid</label>
					<label class="radio"><input type="radio" bind:group={layout} value="line" disabled={disabled} /> Line</label>
				</div>
			</div>

			<div class="field-group">
				<label>
					<span class="label">Predefined examples</span>
					<select bind:value={selectedExample} disabled={disabled} onchange={(event) => loadExample(event.currentTarget.value)}>
						<option value="">Select example</option>
						<optgroup label="Ordinary Brauer graphs">
							{#each examples.filter((example) => !example.graph.orbifoldEdges?.length) as example}
								<option value={example.name}>{example.name}</option>
							{/each}
						</optgroup>
						<optgroup label="Skew Brauer graphs">
							{#each examples.filter((example) => example.graph.orbifoldEdges?.length) as example}
								<option value={example.name}>{example.name}</option>
							{/each}
						</optgroup>
					</select>
				</label>
			</div>

			<div class="actions">
				<button class="primary" type="button" disabled={disabled} onclick={drawCurrentGraph}>Draw graph</button>
				<button type="button" disabled={disabled} onclick={clearForm}>Clear</button>
			</div>
		</div>
	{/if}
</section>

<style>
	.accordion {
		border-bottom: 1px solid var(--border);
	}

	.disabled .accordion-body {
		opacity: 0.54;
		pointer-events: none;
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

	.accordion-body,
	.field-group,
	label {
		display: grid;
		gap: 8px;
	}

	.accordion-body {
		padding-bottom: 16px;
	}

	.field-group {
		margin-bottom: 14px;
	}

	.label {
		color: var(--text-secondary);
		font-size: 12px;
		font-weight: 700;
	}

	input,
	select {
		box-sizing: border-box;
		width: 100%;
		height: 34px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--input-bg);
		color: var(--text-primary);
		padding: 5px 8px;
	}

	.segmented {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--bg-primary);
		padding: 3px;
	}

	.segmented button,
	.actions button,
	.link-button {
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
	}

	.segmented button {
		min-height: 30px;
		font-size: 13px;
	}

	.segmented .active {
		background: var(--accent);
		color: var(--accent-contrast);
	}

	.edge-count-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
		gap: 8px;
	}

	.edge-count-field,
	.compact-h-field {
		display: grid;
		gap: 8px;
	}

	.compact-h-display {
		min-width: 70px;
		border: 1px solid color-mix(in srgb, var(--border) 65%, var(--text-secondary));
		border-radius: 6px;
		background: color-mix(in srgb, var(--bg-primary) 82%, var(--text-secondary));
		color: var(--text-primary);
		padding: 8px;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		line-height: 1;
		text-align: center;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bg-primary) 60%, var(--border));
	}

	.field-error,
	.field-warning {
		margin: 0;
		font-size: 12px;
		line-height: 1.35;
	}

	.field-error {
		color: var(--danger);
	}

	.field-warning {
		border-left: 3px solid var(--warning);
		background: color-mix(in srgb, var(--warning) 12%, transparent);
		color: var(--text-primary);
		padding: 6px 8px;
	}

	.cycle-heading {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.unused-info {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.info-button {
		display: inline-grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border: 0;
		border-bottom: 1px dashed currentColor;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}

	.info-button.incomplete {
		color: var(--warning);
	}

	.info-button.complete {
		color: var(--success);
	}

	.unused-popover {
		position: absolute;
		z-index: 3;
		top: calc(100% + 6px);
		right: 0;
		display: grid;
		gap: 4px;
		width: min(220px, 70vw);
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-panel);
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
		padding: 8px 10px;
		font-size: 12px;
		line-height: 1.35;
	}

	.unused-popover strong {
		color: var(--text-primary);
	}

	.unused-popover span {
		color: var(--text-secondary);
		font-family: var(--font-mono);
	}

	.cycle-list {
		display: grid;
		gap: 8px;
	}

	.link-button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		justify-self: start;
		color: var(--accent);
		padding: 4px 0;
	}

	.switch,
	.radio {
		grid-template-columns: auto 1fr;
		align-items: center;
		color: var(--text-primary);
		font-size: 14px;
	}

	.layout-radio-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 14px;
	}

	.layout-radio-row .radio {
		display: inline-grid;
		width: auto;
	}

	.switch input,
	.radio input {
		width: 16px;
		height: 16px;
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.actions button {
		min-height: 36px;
		border: 1px solid var(--border);
		background: var(--button-bg);
	}

	.actions .primary {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 700;
	}
</style>
