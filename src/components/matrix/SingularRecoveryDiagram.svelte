<script>
	import { onDestroy } from "svelte";
	import { tweened } from "svelte/motion";
	import { cubicInOut } from "svelte/easing";
	import {
		singularPreimages,
		squareVertices,
		transformPoint2d,
		formatMatrixNumber as fmt
	} from "$utils/matrix2d.js";

	export let matrix;
	const colors = ["#ff8ad0", "#c4a7ff", "#67e8f9", "#fcd34d", "#5eead4"];
	const progress = tweened(0);
	const arrival = tweened(0);
	let selected = null;
	let tried = [];
	let animating = false;
	let revealed = false;
	let outputPanel;
	let run = 0;
	$: candidates = singularPreimages(matrix);
	$: output = squareVertices(matrix);
	$: pointOutput = matrix.every((value) => value === 0);
	$: canReveal = tried.length >= 2;
	$: inputFrame = frame(candidates.flat(), 180, 120, 12);
	// Separate input/output panels, but all input thumbnails share one scale.
	// The output frame fits every candidate and its image, so it never zooms
	// during playback or between selections.
	$: outputFrame = frame([...candidates.flat(), ...output], 240, 300, 24);
	$: candidate = selected === null ? null : candidates[selected];
	// Compute the selected candidate's actual image, rather than animating to
	// hard-coded common endpoints. The reference output stays visible behind it.
	$: mapped = candidate?.map((point) => transformPoint2d(matrix, point));
	$: moving = candidate?.map(([x, y], i) => [
		x * (1 - $progress) + mapped[i][0] * $progress,
		y * (1 - $progress) + mapped[i][1] * $progress
	]);
	$: outputOrigin = outputFrame.project([0, 0]);
	$: gridStep = Math.pow(10, Math.floor(Math.log10(outputFrame.span / 3)));
	$: xTicks = ticks(
		outputFrame.cx - 120 / outputFrame.scale,
		outputFrame.cx + 120 / outputFrame.scale,
		gridStep
	);
	$: yTicks = ticks(
		outputFrame.cy - 150 / outputFrame.scale,
		outputFrame.cy + 150 / outputFrame.scale,
		gridStep
	);

	function frame(points, width, height, padding) {
		const xs = [0, ...points.map((p) => p[0])];
		const ys = [0, ...points.map((p) => p[1])];
		const xmin = Math.min(...xs),
			xmax = Math.max(...xs);
		const ymin = Math.min(...ys),
			ymax = Math.max(...ys);
		const cx = (xmin + xmax) / 2,
			cy = (ymin + ymax) / 2;
		const span = Math.max(1, xmax - xmin, ymax - ymin);
		const scale = Math.min(
			(width - padding * 2) / Math.max(1, xmax - xmin),
			(height - padding * 2) / Math.max(1, ymax - ymin)
		);
		return {
			cx,
			cy,
			span,
			scale,
			project: ([x, y]) => [
				width / 2 + (x - cx) * scale,
				height / 2 - (y - cy) * scale
			]
		};
	}
	function polygon(points, viewport) {
		return points.map((point) => viewport.project(point).join(",")).join(" ");
	}
	function ticks(min, max, step) {
		const first = Math.ceil(min / step);
		return Array.from(
			{ length: Math.max(0, Math.floor(max / step) - first + 1) },
			(_, i) => (first + i) * step
		);
	}

	async function choose(index) {
		const token = ++run;
		progress.set(0, { duration: 0 });
		arrival.set(0, { duration: 0 });
		selected = index;
		animating = true;
		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)"
		).matches;
		// Keep the transformation visible even when testing the lowest card.
		outputPanel?.scrollIntoView({ block: "nearest", behavior: "instant" });
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
	<h3>Could you recover the original from this output alone?</h3>
	<p class="instruction">
		Which input could have produced this output? Choose a candidate to test with
		A.
	</p>
	<div class="many-to-one">
		<div class="candidates" role="group" aria-label="Possible original shapes">
			{#each candidates as points, i}
				<button
					class="candidate-card"
					class:selected={selected === i}
					class:tested={tried.includes(i)}
					class:confirmed={tried.includes(i) || revealed}
					style:--candidate-color={colors[i]}
					aria-pressed={selected === i}
					aria-label={`Test candidate ${i + 1}${
						tried.includes(i) || revealed ? ": produces the same output" : ""
					}`}
					on:click={() => choose(i)}
				>
					<span class="candidate-label">Candidate {i + 1}</span>
					<svg viewBox="0 0 180 120" aria-hidden="true">
						<line
							x1="0"
							x2="180"
							y1={inputFrame.project([0, 0])[1]}
							y2={inputFrame.project([0, 0])[1]}
							class="axis"
						/>
						<line
							x1={inputFrame.project([0, 0])[0]}
							x2={inputFrame.project([0, 0])[0]}
							y1="0"
							y2="120"
							class="axis"
						/>
						<polygon
							points={polygon(points, inputFrame)}
							fill={colors[i]}
							fill-opacity="0.28"
							stroke={colors[i]}
							stroke-width="2"
						/>
						<circle
							cx={inputFrame.project([0, 0])[0]}
							cy={inputFrame.project([0, 0])[1]}
							r="2"
							fill="#94a3b8"
						/>
						<text
							x={inputFrame.project([0, 0])[0] + 5}
							y={inputFrame.project([0, 0])[1] + 13}>0</text
						>
						<text x="170" y={inputFrame.project([0, 0])[1] - 5}>x</text>
						<text x={inputFrame.project([0, 0])[0] + 5} y="12">y</text>
					</svg>
					<span class="match"
						>{tried.includes(i) || revealed
							? "✓ Same output"
							: animating && selected === i
							? "Applying A…"
							: "Test this input →"}</span
					>
				</button>
			{/each}
		</div>
		<svg
			class="connections"
			viewBox="0 0 80 500"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<path
				d="M 36 50 V 450 M 36 250 H 76 M 66 244 L 76 250 L 66 256"
				fill="none"
				stroke={tried.length || animating ? "#67e8f9" : "#53637a"}
				stroke-width="2"
			/>
			{#each candidates as _, i}
				<path
					d={`M 0 ${i * 100 + 50} H 36`}
					stroke={tried.includes(i) || revealed || selected === i
						? colors[i]
						: "#53637a"}
					stroke-width={selected === i ? 4 : 2}
					stroke-dasharray={tried.includes(i) || revealed || selected === i
						? "none"
						: "4 4"}
				/>
			{/each}
		</svg>
		<div class="output" bind:this={outputPanel}>
			<h4>
				{revealed || tried.length === 5 ? "SAME OUTPUT" : "Observed output"}
			</h4>
			<p>{pointOutput ? "One point at (0, 0)" : "One collapsed segment"}</p>
			<div class="transformation-label" aria-live="polite">
				{#if selected !== null}<span style:color={colors[selected]}
						>Input {selected + 1}</span
					><span> → A → </span><span
						>{animating ? "observed output" : "same output"}</span
					>
				{:else}Choose an input to watch it transform{/if}
			</div>
			<svg
				viewBox="0 0 240 300"
				role="img"
				aria-label={`Observed ${
					pointOutput ? "point at the origin" : "collapsed segment"
				}${
					selected === null
						? ""
						: `. Candidate ${selected + 1} ${
								animating
									? "is transforming toward it"
									: "produces this same output"
						  }`
				}`}
			>
				{#each xTicks as x}
					<line
						x1={outputFrame.project([x, 0])[0]}
						x2={outputFrame.project([x, 0])[0]}
						y1="0"
						y2="300"
						class="grid"
					/>
					<text
						x={outputFrame.project([x, 0])[0]}
						y={outputOrigin[1] + 14}
						text-anchor="middle">{fmt(x)}</text
					>
				{/each}
				{#each yTicks as y}
					<line
						x1="0"
						x2="240"
						y1={outputFrame.project([0, y])[1]}
						y2={outputFrame.project([0, y])[1]}
						class="grid"
					/>
				{/each}
				<line
					x1="0"
					x2="240"
					y1={outputOrigin[1]}
					y2={outputOrigin[1]}
					class="axis"
				/>
				<line
					x1={outputOrigin[0]}
					x2={outputOrigin[0]}
					y1="0"
					y2="300"
					class="axis"
				/>
				{#if candidate && animating}
					<!-- A faint trace of the selected candidate, never a unit-square reference. -->
					<polygon
						points={polygon(candidate, outputFrame)}
						fill="none"
						stroke={colors[selected]}
						stroke-opacity="0.35"
						stroke-width="1.5"
					/>
					{#each candidate as start, i}
						<line
							x1={outputFrame.project(start)[0]}
							y1={outputFrame.project(start)[1]}
							x2={outputFrame.project(moving[i])[0]}
							y2={outputFrame.project(moving[i])[1]}
							stroke={colors[selected]}
							stroke-opacity="0.3"
							stroke-width="1.5"
						/>
					{/each}
				{/if}
				<polygon
					points={polygon(output, outputFrame)}
					fill="none"
					stroke="#67e8f9"
					stroke-width={6 + $arrival * 7}
					style:filter={$arrival > 0
						? `drop-shadow(0 0 ${$arrival * 7}px #67e8f9)`
						: "none"}
					stroke-linejoin="round"
				/>
				{#if pointOutput}<circle
						cx={outputOrigin[0]}
						cy={outputOrigin[1]}
						r={7 + $arrival * 6}
						fill="#67e8f9"
					/>{/if}
				{#if moving}
					<polygon
						points={polygon(moving, outputFrame)}
						fill={colors[selected]}
						fill-opacity="0.3"
						stroke={colors[selected]}
						stroke-width="3"
						stroke-linejoin="round"
					/>
					{#each moving as point}
						<circle
							cx={outputFrame.project(point)[0]}
							cy={outputFrame.project(point)[1]}
							r="4"
							fill={colors[selected]}
						/>
					{/each}
				{/if}
			</svg>
			<span class="output-key"><i /> Cyan: the output to match</span>
			{#if selected !== null}<span
					class="selected-key"
					style:color={colors[selected]}
					>Candidate {selected + 1} {animating ? "→ A" : "✓"}</span
				>{/if}
		</div>
	</div>
	<p class="scale-note">
		Candidate views share the same axes and scale. The output view fits all five
		transformations.
	</p>
	<div class="feedback" class:revealed aria-live="polite" aria-atomic="true">
		{#if revealed}
			<strong>All five match. The output alone cannot distinguish them.</strong>
			<p>
				All of these different originals produce the same output. The
				transformation lost information, so the output alone cannot uniquely
				determine the input.
			</p>
			<strong class="conclusion">No unique inverse exists.</strong>
			<p class="original-note">
				Candidate 3 is the actual starting square. The output cannot distinguish
				it from the other four.
			</p>
		{:else if animating}
			<p>Transforming candidate {selected + 1}…</p>
		{:else if tried.length}
			<strong
				>{tried.length} of 5 inputs tested — {tried.length === 1
					? "a match"
					: "same output"}.</strong
			>
			<p>
				{tried.length === 5
					? "You tested every input. Each produced the same output."
					: "Keep testing in any order. Untested inputs are still yours to explore."}
			</p>
		{:else}
			<p>
				Which candidate could produce the {pointOutput ? "point" : "line"} on the
				right?
			</p>
		{/if}
	</div>
	{#if canReveal && !revealed}
		<button class="reveal-button" on:click={revealMatches}
			>Reveal all matches</button
		>
	{/if}
</div>

<style>
	.recovery {
		color: #e2e8f0;
	}
	h3 {
		margin: 0;
		font-size: 24px;
		line-height: 1.35;
		font-weight: 600;
	}
	.instruction {
		color: #aab9ca;
		font-size: 16px;
		line-height: 1.6;
		margin: 12px 0 24px;
	}
	.many-to-one {
		display: grid;
		grid-template-columns: minmax(155px, 0.95fr) minmax(32px, 0.25fr) minmax(
				175px,
				1.2fr
			);
		align-items: stretch;
	}
	.candidates {
		display: grid;
		grid-template-rows: repeat(5, 1fr);
		gap: 12px;
	}
	.candidate-card {
		min-width: 0;
		border: 1px solid #46536a;
		border-left: 3px solid var(--candidate-color);
		border-radius: 8px;
		background: #101823;
		padding: 12px;
		transition: background 150ms, border-color 150ms, box-shadow 150ms;
		cursor: pointer;
		color: #e2e8f0;
		text-align: left;
	}
	.candidate-card:hover,
	.candidate-card.selected {
		background: #202d3f;
		border-color: var(--candidate-color);
	}
	.candidate-card:focus-visible {
		outline: 2px solid var(--candidate-color);
		outline-offset: 3px;
	}
	.candidate-label {
		display: block;
		font-size: 15px;
		font-weight: 600;
	}
	.candidate-card svg {
		display: block;
		width: 100%;
		height: 120px;
		margin: 8px 0;
	}
	.match {
		display: block;
		font-size: 13px;
		color: var(--candidate-color);
		min-height: 20px;
	}
	.connections {
		width: 100%;
		height: 100%;
	}
	.output {
		align-self: center;
		min-width: 0;
	}
	h4 {
		font-size: 16px;
		margin: 0;
		color: #67e8f9;
		font-weight: 600;
	}
	.output p {
		font-size: 15px;
		color: #aab9ca;
		margin: 5px 0 12px;
	}
	.output > svg {
		display: block;
		width: 100%;
		background: #101823;
		border: 2px solid #3c6875;
		border-radius: 12px;
	}
	.grid {
		stroke: #233041;
		stroke-width: 1;
	}
	.axis {
		stroke: #8497af;
		stroke-width: 1;
	}
	text {
		fill: #94a3b8;
		font: 11px sans-serif;
	}
	.output-key {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: #94a3b8;
		margin-top: 10px;
	}
	.output-key i {
		width: 14px;
		border-top: 3px solid #67e8f9;
	}
	.selected-key {
		display: block;
		font-size: 15px;
		margin-top: 8px;
	}
	.scale-note {
		margin: 14px 0;
		font-size: 13px;
		line-height: 1.6;
		color: #94a3b8;
	}
	.feedback {
		border-left: 3px solid #53637a;
		padding: 12px 16px;
		font-size: 13px;
		line-height: 1.65;
		min-height: 78px;
	}
	.feedback.revealed {
		border-color: #fcd34d;
		background: #242733;
		border-radius: 0 8px 8px 0;
	}
	.feedback strong {
		color: #fcd34d;
		font-weight: 600;
	}
	.feedback p {
		margin: 4px 0 0;
	}
	@media (max-width: 400px) {
		.many-to-one {
			grid-template-columns: minmax(100px, 1fr) 24px minmax(110px, 1fr);
		}
	}
	.candidate-card.confirmed {
		border-color: var(--candidate-color);
		background: #172c33;
	}
	.candidate-card.selected {
		box-shadow: inset 0 0 0 2px var(--candidate-color);
		background: #27364a;
	}
	.match {
		color: #b8c5d6;
	}
	.confirmed .match {
		color: var(--candidate-color);
		font-weight: 600;
	}
	h4 {
		font-size: 20px;
	}
	.feedback {
		font-size: 15px;
	}
	.transformation-label {
		min-height: 48px;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.6;
		margin: 14px 0;
	}
	.conclusion {
		display: block;
		margin-top: 12px;
		font-size: 18px;
	}
	.feedback .original-note {
		margin-top: 12px;
		font-size: 13px;
		color: #aab9ca;
	}
	.reveal-button {
		margin-top: 18px;
		border: 1px solid #fcd34d;
		border-radius: 8px;
		padding: 12px 18px;
		background: #302d24;
		color: #fcd34d;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
	}
	.reveal-button:hover {
		background: #48402c;
	}
	.reveal-button:focus-visible {
		outline: 2px solid #fcd34d;
		outline-offset: 3px;
	}
	@media (prefers-reduced-motion: reduce) {
		.candidate-card {
			transition: none;
		}
	}
	@media (max-width: 1000px) and (min-width: 801px), (max-width: 480px) {
		.many-to-one {
			grid-template-columns: minmax(115px, 1fr) 26px minmax(130px, 1.1fr);
		}
		.candidate-card {
			padding: 8px;
		}
		.candidate-card svg {
			height: 100px;
		}
	}
</style>
