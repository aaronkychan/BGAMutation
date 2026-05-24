<script lang="ts">
	import { ChevronDown, Plus } from 'lucide-svelte';
	import { examples } from '$lib/math/examples';
	import { computeH } from '$lib/math/ribbon';
	import type { BrauerGraph } from '$lib/math/types';
	import type { RenderOptions } from '$lib/graph/types';
	import CycleRow from './CycleRow.svelte';

	type GraphType = 'brauer' | 'skew';
	type LayoutMode = 'circle' | 'grid' | 'line';
	type Direction = 'CW' | 'CCW';

	interface CycleFormRow {
		cycle: string;
		multiplicity: number;
	}

	let {
		open,
		disabled = false,
		onToggle,
		onDraw,
		onClear,
		errors = []
	}: {
		open: boolean;
		disabled?: boolean;
		onToggle: () => void;
		onDraw: (graph: BrauerGraph, options: RenderOptions) => void;
		onClear: () => void;
		errors?: { field: string; message: string }[];
	} = $props();

	let graphType = $state<GraphType>('brauer');
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

	let orbifoldEdges = $derived(
		orbifoldEdgesInput
			.split(',')
			.map((part) => Number.parseInt(part.trim(), 10))
			.filter((value) => Number.isInteger(value) && value > 0 && value <= edgeCount)
	);
	let halfEdges = $derived(computeH(Math.max(0, edgeCount), graphType === 'skew' ? orbifoldEdges : []));
	let hDisplay = $derived(`H = {${halfEdges.join(', ')}}`);

	function errorFor(field: string): string | undefined {
		return errors.find((error) => error.field === field)?.message;
	}

	function resetRows() {
		rows = [{ cycle: '', multiplicity: 1 }];
		selectedExample = '';
	}

	function setGraphType(nextType: GraphType) {
		if (graphType === nextType) return;
		graphType = nextType;
		edgeCount = 0;
		orbifoldEdgesInput = '';
		resetRows();
	}

	function setEdgeCount(value: number) {
		edgeCount = Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
		resetRows();
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
			...(graphType === 'skew' && orbifoldEdges.length ? { orbifoldEdges } : {}),
			sigma0,
			multiplicity
		};
	}

	function loadExample(name: string) {
		selectedExample = name;
		const example = examples.find((candidate) => candidate.name === name);
		if (!example) return;

		edgeCount = example.graph.n;
		orbifoldEdgesInput = example.graph.orbifoldEdges?.join(', ') ?? '';
		graphType = example.graph.orbifoldEdges?.length ? 'skew' : 'brauer';
		rows = example.graph.sigma0.map((cycle, index) => ({
			cycle: cycle.join(', '),
			multiplicity: example.graph.multiplicity[index] ?? 1
		}));
	}

	function clearForm() {
		graphType = 'brauer';
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
		onClear();
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
</script>

<section class:disabled class="accordion">
	<button class="accordion-trigger" type="button" aria-expanded={open} onclick={onToggle}>
		<span>Numerical input</span>
		<ChevronDown class={open ? 'open' : ''} size={18} />
	</button>

	{#if open}
		<div class="accordion-body">
			<div class="field-group">
				<span class="label">Graph type</span>
				<div class="segmented" role="group" aria-label="Graph type">
					<button
						type="button"
						class:active={graphType === 'brauer'}
						disabled={disabled}
						onclick={() => setGraphType('brauer')}
					>
						Brauer
					</button>
					<button
						type="button"
						class:active={graphType === 'skew'}
						disabled={disabled}
						onclick={() => setGraphType('skew')}
					>
						Skew Brauer
					</button>
				</div>
			</div>

			<div class="field-group">
				<label>
					<span class="label">Edge count</span>
					<input
						type="number"
						min="0"
						value={edgeCount}
						disabled={disabled}
						onchange={(event) => setEdgeCount(event.currentTarget.valueAsNumber)}
					/>
				</label>
				{#if errorFor('edgeCount')}
					<p class="field-error">{errorFor('edgeCount')}</p>
				{/if}
				{#if graphType === 'skew'}
					<label>
						<span class="label">Orbifold edges</span>
						<input
							type="text"
							value={orbifoldEdgesInput}
							placeholder="3, 4"
							disabled={disabled}
							oninput={(event) => {
								orbifoldEdgesInput = event.currentTarget.value;
								resetRows();
							}}
						/>
					</label>
					{#if errorFor('orbifoldEdges')}
						<p class="field-error">{errorFor('orbifoldEdges')}</p>
					{/if}
				{/if}
				<div class="readonly-line">{hDisplay}</div>
			</div>

			<div class="field-group">
				<span class="label">Cyclic ordering σ₀</span>
				<div class="cycle-list">
					{#each rows as row, index}
						<CycleRow
							{index}
							cycle={row.cycle}
							multiplicity={row.multiplicity}
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
					onclick={() => {
						rows = [...rows, { cycle: '', multiplicity: 1 }];
					}}
				>
					<Plus size={14} />
					Add vertex
				</button>
			</div>

			<div class="field-group">
				<span class="label">Display toggles</span>
				<label class="switch"><input type="checkbox" bind:checked={showOrderArrows} disabled={disabled} /> Cyclic order arrows</label>
				<label class="switch"><input type="checkbox" bind:checked={showHalfEdgeLabels} disabled={disabled} /> Half-edge labels</label>
				<label class="switch"><input type="checkbox" bind:checked={showMultiplicityLabels} disabled={disabled} /> Multiplicity labels</label>
				<label class="switch"><input type="checkbox" bind:checked={showEdgeLabels} disabled={disabled} /> Edge labels</label>
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
				<label class="radio"><input type="radio" bind:group={layout} value="circle" disabled={disabled} /> Circle</label>
				<label class="radio"><input type="radio" bind:group={layout} value="grid" disabled={disabled} /> Grid</label>
				<label class="radio"><input type="radio" bind:group={layout} value="line" disabled={disabled} /> Line</label>
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
		text-transform: uppercase;
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

	.readonly-line {
		overflow-wrap: anywhere;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-primary);
		color: var(--text-secondary);
		padding: 7px 8px;
		font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
		font-size: 12px;
	}

	.field-error {
		margin: 0;
		color: var(--danger);
		font-size: 12px;
		line-height: 1.35;
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
