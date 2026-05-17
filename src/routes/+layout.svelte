<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={`${base}/bga-icon-candidate.svg`} />
</svelte:head>

{@render children()}
