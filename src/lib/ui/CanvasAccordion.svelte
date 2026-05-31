<script lang="ts">
	import { ChevronDown, Keyboard } from 'lucide-svelte';

	type CanvasAction = {
		label: string;
		action: string;
		enabled: boolean;
		key: string;
		children?: Omit<CanvasAction, 'children' | 'key'>[];
	};

	type CanvasActionGroup = {
		id: string;
		label: string;
		key: string;
		actions: CanvasAction[];
	};

	const actionGroups: CanvasActionGroup[] = [
		{
			id: 'add-edit',
			label: 'Add/Edit',
			key: 'A',
			actions: [
				{ label: 'Add vertex', action: 'add-vertex', enabled: true, key: 'V' },
				{ label: 'Add half-edge', action: 'add-half-edge', enabled: true, key: 'H' },
				{ label: 'Add orbifold edge', action: 'add-orbifold-edge', enabled: true, key: 'O' },
				{ label: '(Re)connect arcs', action: 'reconnect-arc', enabled: true, key: 'C' },
				{ label: 'Modify multiplicities', action: 'modify-multiplicity', enabled: true, key: 'M' }
			]
		},
		{
			id: 'remove',
			label: 'Remove',
			key: 'D',
			actions: [
				{ label: 'Remove vertex', action: 'remove-vertex', enabled: true, key: 'V' },
				{ label: 'Remove arc', action: 'remove-arc', enabled: true, key: 'C' },
				{ label: 'Remove half-edge', action: 'remove-half-edge', enabled: true, key: 'H' }
			]
		},
		{
			id: 'display-edit',
			label: 'Display edit',
			key: 'E',
			actions: [
				{ label: 'Half-edge angle', action: 'adjust-emanating-angle', enabled: true, key: 'H' },
				{ label: 'Rotate vertex', action: 'rotate-vertex', enabled: true, key: 'R' },
				{
					label: 'Arc curvature',
					action: 'adjust-arc-curvature',
					enabled: true,
					key: 'C',
					children: [
						{ label: 'Align Bezier control with half-edge', action: 'align-bezier-control', enabled: true }
					]
				}
			]
		}
	];

	let {
		open,
		activeAction = '',
		activeSubAction = '',
		activeGroup = '',
		armLength = null,
		canUndo = false,
		onToggle,
		onAction,
		onArmLengthChange
	}: {
		open: boolean;
		activeAction?: string;
		activeSubAction?: string;
		activeGroup?: string;
		armLength?: number | null;
		canUndo?: boolean;
		onToggle: () => void;
		onAction?: (action: string) => void;
		onArmLengthChange?: (length: number) => void;
	} = $props();

	function groupTitle(group: CanvasActionGroup) {
		return `Press ${group.key.toLowerCase()} to select ${group.label}`;
	}
</script>

<section class="accordion">
	<button class="accordion-trigger" type="button" aria-expanded={open} onclick={onToggle}>
		<span>Edit graph on canvas</span>
		<span class="trigger-tools">
			<span class="key-hint"><Keyboard size={12} aria-hidden="true" />G</span>
			<ChevronDown class={open ? 'open' : ''} size={18} />
		</span>
	</button>

	{#if open}
		<div class="button-list" aria-label="Canvas editing tools">
			{#each actionGroups as group}
				<section class:group-active={activeGroup === group.id} class="action-group" aria-label={group.label}>
					<div class="group-title" title={groupTitle(group)}>
						<span>{group.label}</span>
						<span class="key-hint"><Keyboard size={12} aria-hidden="true" />{group.key}</span>
					</div>

					{#each group.actions as action}
						<button
							type="button"
							class:active={activeAction === action.action}
							disabled={!action.enabled}
							title={action.enabled ? action.label : 'Canvas editing is scheduled for a later stage'}
							onclick={() => onAction?.(action.action)}
						>
							<span>{action.label}</span>
							<span class="key-hint"><Keyboard size={12} aria-hidden="true" />{action.key}</span>
						</button>
						{#if action.children && activeAction === action.action}
							<div class="submenu" aria-label={`${action.label} options`}>
								{#each action.children as child}
									<button
										type="button"
										class="submenu-button"
										class:active={activeSubAction === child.action}
										disabled={!child.enabled}
										title={child.enabled ? child.label : 'Canvas editing is scheduled for a later stage'}
										onclick={() => onAction?.(child.action)}
									>
										<span>{child.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					{/each}

					{#if group.id === 'display-edit'}
						<label class="arm-length-control">
							<span>Arm length</span>
							<input
								type="number"
								min="14"
								step="1"
								value={armLength === null ? '' : Math.round(armLength)}
								placeholder="--"
								onchange={(event) => {
									const value = event.currentTarget.valueAsNumber;
									if (Number.isFinite(value)) onArmLengthChange?.(value);
								}}
							/>
							<span class="key-hint"><Keyboard size={12} aria-hidden="true" />↑/↓</span>
						</label>
					{/if}
				</section>
			{/each}

			<button
				type="button"
				disabled={!canUndo}
				title={canUndo ? 'Undo last canvas edit' : 'No canvas edit to undo'}
				onclick={() => onAction?.('undo')}
			>
				<span>Undo</span>
				<span class="key-hint"><Keyboard size={12} aria-hidden="true" />Z</span>
			</button>
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

	.trigger-tools {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.button-list {
		display: grid;
		gap: 12px;
		padding-bottom: 16px;
	}

	.action-group {
		display: grid;
		gap: 7px;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 8px;
		background: color-mix(in srgb, var(--button-bg) 45%, transparent);
	}

	.action-group.group-active {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent);
	}

	.group-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		color: var(--section-title);
		font-size: 12px;
		font-weight: 800;
	}

	.key-hint {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--input-bg);
		color: var(--text-secondary);
		font-size: 10px;
		font-weight: 800;
		line-height: 1;
		padding: 3px 5px;
		white-space: nowrap;
	}

	.arm-length-control {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 76px auto;
		align-items: center;
		gap: 10px;
		min-height: 34px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--button-bg);
		padding: 6px 10px;
	}

	.arm-length-control span {
		color: var(--text-secondary);
		font-size: 12px;
		font-weight: 700;
	}

	.arm-length-control input {
		box-sizing: border-box;
		width: 100%;
		height: 34px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--input-bg);
		color: var(--text-primary);
		padding: 5px 8px;
	}

	button:not(.accordion-trigger) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
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

	.submenu {
		display: grid;
		gap: 6px;
		margin: -2px 0 2px 12px;
		padding-left: 10px;
		border-left: 2px solid var(--border);
	}

	button.submenu-button {
		min-height: 30px;
		font-size: 12px;
	}
</style>
