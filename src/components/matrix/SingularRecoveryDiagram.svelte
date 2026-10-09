<script>
	import { onDestroy, onMount } from "svelte";
	import { fly } from "svelte/transition";
	import { tweened } from "svelte/motion";
	import { cubicInOut } from "svelte/easing";
	import {
		singularPreimages,
		squareVertices,
		transformPoint2d,
		formatMatrixNumber as fmt
	} from "$utils/matrix2d.js";

	export let matrix;
	export let scene = null;
	export let onBack;
	let exploring = false;
	let reducedMotion = false;
	onMount(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => (reducedMotion = mq.matches);
		update();
		mq.addEventListener("change", update);
		return () => mq.removeEventListener("change", update);
	});
	const colors = ["#ff8ad0", "#c4a7ff", "#67e8f9", "#fcd34d", "#5eead4"];
	const progress = tweened(0);
	const arrival = tweened(0);
	let selected = null;
	let tried = [];
	let animating = false;
	let revealed = false;
	let run = 0;
	$: candidates = singularPreimages(matrix);
	$: output = squareVertices(matrix);
	$: pointOutput = matrix.every((value) => value === 0);
	$: canReveal = tried.length >= 2;
	$: candidate = selected === null ? null : candidates[selected];
	// Compute the selected candidate's actual image, rather than animating to
	// hard-coded common endpoints. The reference output stays visible behind it.
	$: mapped = candidate?.map((point) => transformPoint2d(matrix, point));
	$: moving = candidate?.map(([x, y], i) => [
		x * (1 - $progress) + mapped[i][0] * $progress,
		y * (1 - $progress) + mapped[i][1] * $progress
	]);
	$: scene = {
		candidate,
		moving,
		animating,
		color: selected === null ? null : colors[selected],
		arrival: $arrival,
		selected
	};

	async function choose(index) {
		const token = ++run;
		progress.set(0, { duration: 0 });
		arrival.set(0, { duration: 0 });
		selected = index;
		animating = true;
		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)"
		).matches;
		await progress.set(1, {
			// Hold the input briefly so the learner sees the starting shape.
			delay: reducedMotion ? 0 : 300,
			duration: reducedMotion ? 0 : 1700,
			easing: cubicInOut
		});
		if (token !== run) return;
		arrival.set(1, { duration: 0 });
		await arrival.set(0, { duration: reducedMotion ? 0 : 450 });
		if (token !== run) return;
		animating = false;
		if (!tried.includes(index)) tried = [...tried, index];
	}

	function revealMatches() {
		if (canReveal) revealed = true;
	}

	onDestroy(() => {
		run += 1;
		progress.set(0, { duration: 0 });
		arrival.set(0, { duration: 0 });
	});
</script>

<div class="recovery">
	<h3>Which input could have produced this output?</h3>
	<p>
		The transformation collapsed a two-dimensional shape into {pointOutput
			? "a point"
			: "a line"}. Can you determine which original input produced it?
	</p>
	{#if !exploring}
		<button class="primary" on:click={() => (exploring = true)}
			>Explore possible inputs →</button
		>
	{:else}
		<div class="candidates" role="group" aria-label="Possible original inputs">
			{#each candidates as _, i}
				<button
					class="candidate"
					class:selected={selected === i}
					style:--color={colors[i]}
					aria-pressed={selected === i}
					aria-label={`Test candidate ${i + 1}${
						tried.includes(i) || revealed ? ": produces the same output" : ""
					}`}
					in:fly={{
						y: reducedMotion ? 0 : 6,
						duration: reducedMotion ? 0 : 180,
						delay: reducedMotion ? 0 : i * 35
					}}
					on:click={() => choose(i)}
				>
					<span class="label"><i />Candidate {i + 1}</span>
					<span class="result"
						>{tried.includes(i) || revealed
							? "✓ Same output"
							: animating && selected === i
							? "Applying A…"
							: "Test input →"}</span
					>
				</button>
			{/each}
		</div>
		<div class="feedback" aria-live="polite" aria-atomic="true">
			{#if revealed}<strong>All five match.</strong>
				<p>
					Different originals produce the same output. Information was lost, so
					no unique original can be recovered.
				</p>
				<p>
					Candidate 3 is the starting square; the output cannot distinguish it
					from the others.
				</p>
			{:else if animating}<p>Transforming candidate {selected + 1}…</p>
			{:else if tried.length}<p>
					{tried.length} of 5 inputs tested — same output.
				</p>
				<p>
					{canReveal
						? "Keep testing, or reveal all matches."
						: "Test another input to compare."}
				</p>
			{:else}<p>Choose an input to test it on the grid.</p>{/if}
		</div>
		{#if canReveal && !revealed}<button class="primary" on:click={revealMatches}
				>Reveal all matches</button
			>{/if}
	{/if}
	<button class="back" on:click={onBack}>Back to transformation</button>
</div>

<style>
	.recovery {
		color: inherit;
	}
	h3 {
		font-size: clamp(23px, 2.2vw, 32px);
		line-height: 1.3;
		font-weight: 600;
		margin: 0 0 20px;
	}
	p {
		font-size: 15px;
		line-height: 1.65;
		color: #aab9ca;
		margin: 12px 0 24px;
	}
	button {
		border: 1px solid #53637a;
		background: transparent;
		color: inherit;
		padding: 14px;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
	}
	button:focus-visible {
		outline: 2px solid #67e8f9;
		outline-offset: 3px;
	}
	button:hover {
		background: #253245;
	}
	.primary {
		width: 100%;
		background: #67e8f9;
		color: #10202c;
		font-weight: 600;
	}
	.primary:hover {
		background: #a5f3fc;
	}
	.back {
		margin-top: 24px;
		width: 100%;
	}
	.candidates {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		margin: 24px 0;
	}
	.candidate {
		text-align: left;
		min-width: 0;
	}
	.candidate.selected {
		border-color: var(--color);
		box-shadow: inset 0 0 0 1px var(--color);
		background: #19222f;
	}
	.label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
	}
	.label i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color);
		flex-shrink: 0;
	}
	.result {
		display: block;
		font-size: 12px;
		color: #aab9ca;
		margin-top: 12px;
	}
	.feedback {
		min-height: 90px;
	}
	.feedback p {
		margin: 8px 0;
	}
	.feedback strong {
		color: #67e8f9;
	}
</style>
