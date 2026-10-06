<script>
	import { onDestroy } from "svelte";
	import { tweened } from "svelte/motion";
	import { cubicInOut } from "svelte/easing";
	import DeterminantDiagram from "./DeterminantDiagram.svelte";
	import {
		identity2d,
		determinant2d,
		inverse2d,
		formatMatrixNumber as fmt
	} from "$utils/matrix2d.js";

	let values = [...identity2d];
	let matrix = [...identity2d];
	let reversing = false;
	let inverseShown = false;
	let animationId = 0;
	const progress = tweened(0);
	$: valid = values.every(
		(value) =>
			typeof value === "number" &&
			Number.isFinite(value) &&
			Math.abs(value) <= 1000000
	);
	$: det = determinant2d(matrix);
	$: singular = det === 0;
	$: inverse = inverse2d(matrix);
	$: inverseFinite = inverse && inverse.every(Number.isFinite);

	function cancelInverse() {
		animationId += 1;
		progress.set(0, { duration: 0 });
		reversing = false;
		inverseShown = false;
	}

	function updateMatrix() {
		cancelInverse();
		if (
			values.every(
				(value) =>
					typeof value === "number" &&
					Number.isFinite(value) &&
					Math.abs(value) <= 1000000
			)
		) {
			matrix = [...values];
		}
	}

	function preset(next) {
		values = [...next];
		updateMatrix();
	}

	function updateEntry(index, value) {
		values[index] = value;
		updateMatrix();
	}

	async function showInverse() {
		if (!valid || singular || reversing) return;
		cancelInverse();
		const id = animationId;
		inverseShown = true;
		reversing = true;
		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)"
		).matches;
		await progress.set(1, {
			duration: reducedMotion ? 0 : 1600,
			easing: cubicInOut
		});
		if (id === animationId) reversing = false;
	}

	onDestroy(() => {
		animationId += 1;
		progress.set(0, { duration: 0 });
	});
</script>

<section id="determinant-invertibility" aria-labelledby="determinant-heading">
	<div class="section-inner">
		<p class="eyebrow">Explore in two dimensions</p>
		<h2 id="determinant-heading">Determinant &amp; Invertibility</h2>
		<p class="intro">
			Can a transformation be undone? Transform a square of area 1 and watch
			what happens to its area.
		</p>
		<div class="workspace">
			<div class="diagram-panel">
				<DeterminantDiagram {matrix} progress={$progress} {singular} />
				<p class="diagram-status" aria-live="polite">
					{#if reversing}Applying A⁻¹ to the transformed square…
					{:else if inverseShown}A⁻¹A = I: the square is back where it started.
					{:else if singular}The square has collapsed to {matrix.every(
							(v) => v === 0
						)
							? "a point"
							: "a line"}.
					{:else}The two columns of A determine the edges of the transformed
						square.{/if}
				</p>
			</div>
			<div class="controls">
				<div class="matrix-heading">
					<h3>Your matrix</h3>
					<span>A = [[a, b], [c, d]]</span>
				</div>
				<div class="matrix-editor" role="group" aria-label="Matrix A entries">
					{#each ["a", "b", "c", "d"] as label, i}
						<label class:pink={i % 2 === 0} class:purple={i % 2 === 1}>
							<span>{label}</span>
							<input
								type="number"
								step="any"
								min="-1000000"
								max="1000000"
								value={Number.isFinite(values[i]) ? values[i] : ""}
								on:input={(event) =>
									updateEntry(i, event.currentTarget.valueAsNumber)}
								aria-label={`Matrix entry ${label}`}
								aria-invalid={!valid}
							/>
						</label>
					{/each}
				</div>
				{#if !valid}<p class="validation" role="alert">
						Enter four finite numbers between −1,000,000 and 1,000,000. The
						diagram keeps the last valid matrix.
					</p>{/if}
				<div class="presets">
					<button on:click={() => preset(identity2d)}>Reset to Identity</button>
					<button on:click={() => preset([1, 2, 1, 2])}>Singular example</button
					>
				</div>
				<div class="readout">
					<p class="formula">det(A) = ad − bc</p>
					<div>
						<span>det(A)</span><strong title={String(det)}>{fmt(det)}</strong>
					</div>
					<div>
						<span>|det(A)| <small>area scale factor</small></span><strong
							title={String(Math.abs(det))}>{fmt(Math.abs(det))}</strong
						>
					</div>
					<p>
						The original square has area 1. Its image under A has area <b
							>{fmt(Math.abs(det))}</b
						>.
					</p>
				</div>
				<div class="verdict" class:singular>
					<h3>{singular ? "Not invertible" : "Invertible"}</h3>
					{#if singular}
						<p>Zero determinant → zero area → information lost.</p>
						<p>
							Collapsing the square loses dimensional information. Different
							input points land in the same place, so the transformation cannot
							be uniquely reversed.
						</p>
					{:else}
						<p>Nonzero determinant → nonzero area → reversible.</p>
						<p>
							Each output comes from one unique input. The inverse matrix takes
							every transformed point back to its original position.
						</p>
						{#if det < 0}<p>
								The negative sign means orientation is flipped; area is still
								positive.
							</p>{/if}
					{/if}
				</div>
				<button
					class="inverse-button"
					on:click={showInverse}
					disabled={singular || !valid || reversing}
					aria-describedby="inverse-help"
					>{reversing ? "Reversing…" : "Show Inverse"}</button
				>
				<p id="inverse-help" class="help">
					{singular
						? "No inverse exists when det(A) = 0."
						: "Watch A⁻¹ return the transformed square to the dashed original."}
				</p>
				{#if inverseShown}
					<div class="inverse-result">
						{#if inverseFinite}
							<span>A⁻¹ =</span>
							<div class="inverse-matrix" aria-label="Inverse matrix">
								{#each inverse as entry}<span title={String(entry)}
										>{fmt(entry)}</span
									>{/each}
							</div>
						{:else}<p>
								The inverse entries exceed the numeric display range.
							</p>{/if}
						<p>
							The readouts describe A, even while the picture returns to the
							original square. A⁻¹A = I means the two transformations undo each
							other.
						</p>
						<button on:click={cancelInverse}>Back to transformed square</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	section {
		position: relative;
		background: #111720;
		color: #e2e8f0;
		padding: 88px 32px;
		border-top: 1px solid #334155;
		scroll-margin-top: 24px;
	}
	.section-inner {
		max-width: 1160px;
		margin: 0 auto;
	}
	.eyebrow {
		color: #67e8f9;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		margin: 0 0 14px;
	}
	h2 {
		font-size: clamp(30px, 4vw, 48px);
		line-height: 1.15;
		font-weight: 650;
		margin: 0 0 18px;
		letter-spacing: -0.035em;
	}
	.intro {
		max-width: 670px;
		color: #aab9ca;
		font-size: 18px;
		line-height: 1.65;
		margin: 0 0 38px;
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr);
		gap: 36px;
		align-items: start;
	}
	.diagram-panel {
		min-width: 0;
	}
	.diagram-status {
		color: #cbd5e1;
		font-size: 14px;
		line-height: 1.6;
		min-height: 46px;
		margin: 20px 0 0;
	}
	.controls {
		background: #19222f;
		border: 1px solid #334155;
		padding: 24px;
		border-radius: 16px;
	}
	.matrix-heading {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px;
		align-items: center;
		margin-bottom: 16px;
	}
	h3 {
		font-weight: 600;
		font-size: 16px;
		margin: 0;
	}
	.matrix-heading > span {
		color: #94a3b8;
		font-size: 13px;
	}
	.matrix-editor {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	label {
		display: flex;
		align-items: center;
		gap: 12px;
		background: #101823;
		border: 1px solid #46536a;
		padding: 8px 12px;
		border-radius: 8px;
	}
	label span {
		font-style: italic;
	}
	.pink {
		color: #ff8ad0;
	}
	.purple {
		color: #c4a7ff;
	}
	input {
		min-width: 0;
		width: 100%;
		font-size: 21px;
		background: transparent;
		padding: 4px 0;
		color: #f8fafc;
	}
	label:focus-within {
		outline: 2px solid #67e8f9;
		outline-offset: 2px;
	}
	input:focus {
		outline: none;
	}
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 14px 0 24px;
	}
	button {
		border: 1px solid #53637a;
		background: #253245;
		border-radius: 7px;
		padding: 9px 12px;
		font-size: 12px;
		color: #e2e8f0;
		cursor: pointer;
	}
	button:hover:enabled {
		background: #35465d;
	}
	button:focus-visible {
		outline: 2px solid #67e8f9;
		outline-offset: 3px;
	}
	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.readout {
		border-top: 1px solid #334155;
		padding-top: 18px;
	}
	.formula {
		color: #aab9ca;
		font-size: 15px;
		margin: 0 0 16px;
	}
	.readout > div {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		margin: 10px 0;
	}
	.readout strong {
		font-size: 25px;
		color: #67e8f9;
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	small {
		display: block;
		font-size: 11px;
		color: #94a3b8;
	}
	.readout > p:last-child,
	.verdict p {
		font-size: 13px;
		line-height: 1.65;
		margin: 10px 0 0;
	}
	.readout > p:last-child {
		color: #aab9ca;
	}
	.verdict {
		border-left: 3px solid #5eead4;
		padding: 0 0 0 14px;
		margin: 24px 0;
	}
	.verdict h3 {
		color: #5eead4;
	}
	.verdict.singular {
		border-color: #fbbf24;
	}
	.verdict.singular h3,
	.validation {
		color: #fcd34d;
	}
	.validation {
		font-size: 13px;
		margin-top: 12px;
	}
	.inverse-button {
		width: 100%;
		background: #67e8f9;
		color: #10202c;
		font-size: 15px;
		font-weight: 650;
		border-color: #67e8f9;
	}
	.inverse-button:hover:enabled {
		background: #a5f3fc;
	}
	.help {
		font-size: 12px;
		line-height: 1.6;
		color: #aab9ca;
		margin: 10px 0 0;
	}
	.inverse-result {
		margin-top: 20px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 14px;
	}
	.inverse-matrix {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px 20px;
		border-left: 2px solid #94a3b8;
		border-right: 2px solid #94a3b8;
		padding: 8px 14px;
		font-variant-numeric: tabular-nums;
		font-size: 15px;
		text-align: right;
	}
	.inverse-result p {
		width: 100%;
		margin: 0;
		font-size: 12px;
		line-height: 1.6;
		color: #94a3b8;
	}
	@media (max-width: 800px) {
		section {
			padding: 56px 20px;
		}
		.workspace {
			grid-template-columns: 1fr;
			gap: 24px;
		}
		.controls {
			padding: 20px;
		}
	}
</style>
