<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { downloadJson, readJsonFile } from '$lib/io/fileio';
	import { createSavedFile } from '$lib/io/serialize';
	import type { RenderOptions } from '$lib/graph/types';
	import type { BrauerGraph, SavedFile } from '$lib/math/types';
	import { graphState } from '$lib/state/graph.svelte';
	import Modal from './Modal.svelte';

	const STORAGE_KEY = 'bga-saved-files';

	let {
		graph,
		renderOptions,
		onLoad
	}: {
		graph: BrauerGraph | null;
		renderOptions: RenderOptions;
		onLoad: (savedFile: SavedFile) => void;
	} = $props();

	let savedFiles = $state<SavedFile[]>([]);
	let selectedSavedAt = $state('');
	let showSaveModal = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let statusMessage = $state('');
	let errorMessage = $state('');
	let open = $state(true);

	let selectedSavedFile = $derived(savedFiles.find((savedFile) => savedFile.savedAt === selectedSavedAt) ?? null);
	let canSave = $derived(Boolean(graph && graphState.getCanvasSnapshot));
	let canLoad = $derived(Boolean(selectedSavedFile));
	let canExport = $derived(savedFiles.length > 0);

	onMount(() => {
		savedFiles = loadSavedFiles();
		selectedSavedAt = savedFiles[0]?.savedAt ?? '';
	});

	function loadSavedFiles(): SavedFile[] {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return [];

			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed.filter(isSavedFile) : [];
		} catch {
			return [];
		}
	}

	function persistSavedFiles(nextSavedFiles: SavedFile[]) {
		savedFiles = nextSavedFiles;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSavedFiles));
	}

	function saveCurrent(labelValues: string[]) {
		const snapshot = graphState.getCanvasSnapshot?.();
		if (!graph || !snapshot) {
			showSaveModal = false;
			errorMessage = 'Draw a graph before saving.';
			return;
		}

		const label = labelValues[0]?.trim() || 'Untitled graph';
		const savedFile = createSavedFile(label, graph, snapshot.cytoscapeJson, snapshot.edgeAnchors, renderOptions);
		persistSavedFiles([savedFile, ...savedFiles]);
		selectedSavedAt = savedFile.savedAt;
		downloadJson(filenameForSavedFile(savedFile), savedFile);
		showSaveModal = false;
		errorMessage = '';
		statusMessage = `Saved "${label}".`;
	}

	function loadSelected() {
		if (!selectedSavedFile) return;
		onLoad(selectedSavedFile);
		statusMessage = `Loaded "${selectedSavedFile.label}".`;
		errorMessage = '';
	}

	function exportAll() {
		if (!savedFiles.length) return;
		downloadJson('bga-saved-graphs.json', savedFiles);
		statusMessage = `Exported ${savedFiles.length} saved graph${savedFiles.length === 1 ? '' : 's'}.`;
		errorMessage = '';
	}

	async function importFiles(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;

		try {
			const parsed = await readJsonFile(file);
			const imported = normalizeImportedSavedFiles(parsed);
			if (!imported.length) {
				throw new Error('No saved graph data found.');
			}

			persistSavedFiles([...imported, ...savedFiles]);
			selectedSavedAt = imported[0].savedAt;
			onLoad(imported[0]);
			statusMessage = `Imported ${imported.length} saved graph${imported.length === 1 ? '' : 's'}.`;
			errorMessage = '';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not import this file.';
			statusMessage = '';
		} finally {
			if (fileInput) fileInput.value = '';
		}
	}

	function normalizeImportedSavedFiles(value: unknown): SavedFile[] {
		if (isSavedFile(value)) return [value];
		if (Array.isArray(value)) return value.filter(isSavedFile);
		return [];
	}

	function isSavedFile(value: unknown): value is SavedFile {
		if (!value || typeof value !== 'object') return false;
		const candidate = value as Partial<SavedFile>;

		return (
			typeof candidate.label === 'string' &&
			typeof candidate.savedAt === 'string' &&
			Boolean(candidate.graph) &&
			Boolean(candidate.cytoscapeJson) &&
			Boolean(candidate.edgeAnchors)
		);
	}

	function filenameForSavedFile(savedFile: SavedFile): string {
		const slug = savedFile.label
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		return `${slug || 'brauer-graph'}.json`;
	}
</script>

<section class="save-load">
	<button class="section-trigger" type="button" aria-expanded={open} onclick={() => (open = !open)}>
		<span>Save / Load</span>
		<ChevronDown class={open ? 'open' : ''} size={18} />
	</button>
	{#if open}
		{#if savedFiles.length}
			<label>
				<span>Saved graphs</span>
				<select bind:value={selectedSavedAt}>
					{#each savedFiles as savedFile}
						<option value={savedFile.savedAt}>{savedFile.label}</option>
					{/each}
				</select>
			</label>
		{/if}
		<div class="button-grid">
			<button class="primary" type="button" disabled={!canSave} onclick={() => (showSaveModal = true)}>Save current</button>
			<button type="button" disabled={!canLoad} onclick={loadSelected}>Load selected</button>
			<button type="button" disabled={!canExport} onclick={exportAll}>Export all</button>
			<button type="button" onclick={() => fileInput?.click()}>Import</button>
		</div>
		<input
			bind:this={fileInput}
			class="file-input"
			type="file"
			accept="application/json,.json"
			onchange={(event) => importFiles(event.currentTarget.files)}
		/>
		{#if statusMessage}
			<p class="status">{statusMessage}</p>
		{/if}
		{#if errorMessage}
			<p class="error">{errorMessage}</p>
		{/if}
	{/if}
</section>

{#if showSaveModal}
	<Modal
		title="Save current graph"
		placeholder={['Label']}
		onConfirm={saveCurrent}
		onCancel={() => (showSaveModal = false)}
	/>
{/if}

<style>
	.save-load {
		display: grid;
		gap: 10px;
		padding: 16px 0 4px;
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

	label {
		display: grid;
		gap: 6px;
	}

	label span {
		color: var(--text-secondary);
		font-size: 12px;
		font-weight: 700;
	}

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

	.button-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	button {
		min-height: 34px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--button-bg);
		color: var(--text-primary);
		cursor: pointer;
	}

	button:first-child {
		grid-column: 1 / -1;
	}

	button:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.primary:not(:disabled) {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 700;
	}

	.file-input {
		display: none;
	}

	.status,
	.error {
		margin: 0;
		font-size: 12px;
		line-height: 1.35;
	}

	.status {
		color: var(--success);
	}

	.error {
		color: var(--danger);
	}
</style>
