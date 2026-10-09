<script>
	import { onDestroy } from "svelte";
	import { tweened } from "svelte/motion";
	import { cubicInOut } from "svelte/easing";
	import DeterminantDiagram from "./DeterminantDiagram.svelte";
	import SingularRecoveryDiagram from "./SingularRecoveryDiagram.svelte";
	import {
		identity2d,
		determinant2d,
		inverse2d,
		matrixExplanation2d,
		formatMatrixNumber as fmt
	} from "$utils/matrix2d.js";

	let values = [...identity2d];
	let matrix = [...identity2d];
	let reversing = false;
	let inverseShown = false;
	let recoveryShown = false;
	let recoveryScene = null;
	let animationId = 0;
	let predictionPending = false;
	let predictionEditing = false;
	let predictionFeedback = "";
	$: concealResult = predictionPending || predictionEditing;

	function commitPrediction() {
		if (!valid) return;
		predictionEditing = false;
		predictionPending = true;
		predictionFeedback = "";
	}

	function revealPrediction(answer = null) {
		predictionPending = false;
		predictionEditing = false;
		predictionFeedback =
			answer === null
				? ""
				: answer === !singular
				? singular
					? "Correct! A zero determinant means the transformation cannot be reversed."
					: "Correct! A nonzero determinant means the transformation is invertible."
				: "Not quite. Compare the area before and after the transformation.";
	}
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
	$: explanation = matrixExplanation2d(matrix);

	function cancelInverse() {
		animationId += 1;
		progress.set(0, { duration: 0 });
		reversing = false;
		inverseShown = false;
	}

	function updateMatrix() {
		predictionPending = false;
		predictionEditing = true;
		predictionFeedback = "";
		cancelInverse();
		recoveryShown = false;
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
		// Presets commit immediately; input edits commit on change.
		predictionEditing = false;
		predictionPending = true;
	}

	function updateEntry(index, value) {
		values[index] = value;
		updateMatrix();
	}

	function tryRecovery() {
		if (!valid || !singular) return;
		if (concealResult) revealPrediction();
		cancelInverse();
		recoveryShown = true;
	}

	async function showInverse() {
		if (!valid || singular || reversing) return;
		if (concealResult) revealPrediction();
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
				<DeterminantDiagram
					{matrix}
					progress={$progress}
					{singular}
					recovery={recoveryShown}
					{recoveryScene}
				/>
				<p class="diagram-status" aria-live="polite">
					{#if recoveryShown}Reason from the collapsed output alone: which
						inputs are consistent with it?
					{:else if reversing}Applying A⁻¹ to the transformed square…
					{:else if inverseShown}A⁻¹A = I: the square is back where it started.
					{:else if concealResult}Observe how A changes the square.
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
				{#if recoveryShown && singular}
					<SingularRecoveryDiagram
						{matrix}
						bind:scene={recoveryScene}
						onBack={() => {
							recoveryShown = false;
							recoveryScene = null;
						}}
					/>
				{:else}
					<div class="matrix-heading">
						<h3>Your matrix</h3>
						<span class="math-label"><i>A</i> · 2 × 2</span>
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
									on:change={commitPrediction}
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
						<button on:click={() => preset(identity2d)}
							>Reset to Identity</button
						>
						<button on:click={() => preset([1, 2, 1, 2])}
							>Singular example</button
						>
					</div>
					{#if predictionPending && valid}
						<div
							class="prediction"
							role="group"
							aria-labelledby="prediction-question"
						>
							<p id="prediction-question">
								Do you think this transformation is reversible?
							</p>
							<div class="prediction-choices">
								<button on:click={() => revealPrediction(true)}
									>Yes — invertible</button
								>
								<button on:click={() => revealPrediction(false)}
									>No — non-invertible</button
								>
								<button on:click={() => revealPrediction()}
									>Skip prediction</button
								>
							</div>
						</div>
					{/if}
					{#if predictionFeedback}
						<p class="prediction-feedback" role="status">
							{predictionFeedback}
						</p>
					{/if}
					{#if !concealResult}
						<div class="readout">
							<div class="det-equation">
								<span>det(<i>A</i>) =</span><strong title={String(det)}
									>{fmt(det)}</strong
								>
							</div>
							<div class="area-result">
								<span>|det(<i>A</i>)| · area scale</span><span
									title={String(Math.abs(det))}>{fmt(Math.abs(det))}</span
								>
							</div>
						</div>
						<div class="verdict" class:singular>
							<h3>{singular ? "A is non-invertible" : "A is invertible"}</h3>
							<p aria-live="polite">{explanation}</p>
						</div>
					{/if}
					{#if singular}
						<button
							class="inverse-button"
							on:click={recoveryShown
								? () => (recoveryShown = false)
								: tryRecovery}
							disabled={!valid}
							aria-expanded={recoveryShown}
							aria-describedby="recovery-help"
							>{recoveryShown
								? "Back to collapsed square"
								: "Try to Recover Original"}</button
						>
						<p id="recovery-help" class="help">
							Test different possible originals against the same output.
						</p>
					{:else}
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
					{/if}
					{#if inverseShown}
						<div class="inverse-result">
							{#if !reversing && $progress === 1}
								<div class="inverse-success" role="status">
									<strong>A⁻¹A = I</strong><span>Transformation reversed</span>
								</div>
							{/if}
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
								Readouts describe A. Applying its inverse returns the square to
								its starting position.
							</p>
							<button on:click={cancelInverse}
								>Back to transformed square</button
							>
						</div>
					{/if}
					<details class="math-note">
						<summary>About area and determinant</summary>
						<p>
							det(A) = ad − bc. The unit square starts with area 1; its image
							has area |det(A)|. A negative determinant reverses orientation,
							while area remains nonnegative.
						</p>
					</details>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	section {
		position: relative;
		background: hsl(var(--b3));
		color: hsl(var(--bc));
		padding: 64px 0;
		scroll-margin-top: 24px;
	}
	.eyebrow,
	h2,
	.intro {
		margin-left: clamp(24px, 4vw, 64px);
		margin-right: 24px;
	}
	.eyebrow {
		color: #67e8f9;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		margin-bottom: 12px;
	}
	h2 {
		font-size: clamp(30px, 4vw, 48px);
		line-height: 1.15;
		font-weight: 650;
		margin-bottom: 16px;
	}
	.intro {
		max-width: 670px;
		color: #aab9ca;
		font-size: 18px;
		line-height: 1.65;
		margin-bottom: 36px;
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.9fr) minmax(300px, 1fr);
		align-items: start;
	}
	.diagram-panel {
		min-width: 0;
	}
	.diagram-status {
		margin: 12px 28px;
		color: #aab9ca;
		font-size: 14px;
		line-height: 1.6;
	}
	.controls {
		min-width: 0;
		padding: 8px clamp(24px, 3vw, 48px) 32px;
	}
	.matrix-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
	}
	h3 {
		font-weight: 600;
		font-size: 18px;
		margin: 0;
	}
	.math-label {
		font-family: "Old Standard TT", serif;
		font-size: 20px;
	}
	.matrix-editor {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		padding: 10px 16px;
		position: relative;
	}
	.matrix-editor::before,
	.matrix-editor::after,
	.inverse-matrix::before,
	.inverse-matrix::after {
		content: "";
		position: absolute;
		top: 0;
		bottom: 0;
		width: 8px;
		border-block: 2px solid #94a3b8;
	}
	.matrix-editor::before,
	.inverse-matrix::before {
		left: 0;
		border-left: 2px solid #94a3b8;
	}
	.matrix-editor::after,
	.inverse-matrix::after {
		right: 0;
		border-right: 2px solid #94a3b8;
	}
	label {
		display: flex;
		align-items: center;
		gap: 10px;
		border-bottom: 1px solid #46536a;
		padding: 5px 0;
	}
	label span {
		font-style: italic;
		font-family: serif;
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
		background: transparent;
		color: inherit;
		font-size: 22px;
		padding: 4px 0;
	}
	input:focus {
		outline: 2px solid #67e8f9;
		outline-offset: 2px;
	}
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 20px 0 28px;
	}
	button {
		border: 1px solid #53637a;
		background: transparent;
		border-radius: 5px;
		padding: 10px 12px;
		font-size: 13px;
		color: inherit;
		cursor: pointer;
	}
	button:hover:enabled {
		background: #253245;
	}
	button:focus-visible,
	summary:focus-visible {
		outline: 2px solid #67e8f9;
		outline-offset: 3px;
	}
	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.prediction {
		margin: 20px 0;
	}
	.prediction p,
	.prediction-feedback {
		font-size: 14px;
		line-height: 1.6;
		margin: 0 0 12px;
	}
	.prediction-choices {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.prediction-feedback {
		color: #67e8f9;
	}
	.readout {
		border-top: 1px solid #334155;
		padding-top: 22px;
	}
	.readout > div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin: 10px 0;
	}
	.det-equation {
		font-family: "Old Standard TT", serif;
		font-size: 27px;
	}
	.readout strong {
		color: #67e8f9;
		font-weight: 400;
		overflow-wrap: anywhere;
	}
	.area-result {
		color: #aab9ca;
		font-size: 14px;
	}
	.verdict {
		margin: 24px 0;
	}
	.verdict h3 {
		color: #67e8f9;
	}
	.verdict.singular h3 {
		color: #c4a7ff;
	}
	.verdict p {
		font-size: 14px;
		line-height: 1.6;
		margin: 8px 0 0;
		color: #aab9ca;
	}
	.inverse-button {
		width: 100%;
		background: #67e8f9;
		color: #10202c;
		border-color: #67e8f9;
		font-weight: 650;
		font-size: 15px;
	}
	.inverse-button:hover:enabled {
		background: #a5f3fc;
	}
	.help,
	.validation,
	.math-note {
		font-size: 12px;
		line-height: 1.6;
		color: #aab9ca;
		margin: 10px 0 0;
	}
	.validation {
		color: #ff8ad0;
	}
	.inverse-result {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 16px;
		margin-top: 24px;
	}
	.inverse-matrix {
		position: relative;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px 20px;
		padding: 8px 16px;
		font-family: "Old Standard TT", serif;
		font-size: 18px;
		text-align: right;
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.inverse-result p {
		font-size: 12px;
		color: #aab9ca;
		line-height: 1.6;
		width: 100%;
		margin: 0;
	}
	.inverse-success {
		width: 100%;
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		align-items: baseline;
		color: #67e8f9;
	}
	.inverse-success strong {
		font-family: "Old Standard TT", serif;
		font-size: 24px;
	}
	.inverse-success span {
		font-size: 13px;
	}
	.math-note {
		margin-top: 24px;
	}
	.math-note summary {
		cursor: pointer;
	}
	.math-note p {
		margin-top: 10px;
	}
	@media (max-width: 950px) {
		.workspace {
			grid-template-columns: minmax(0, 1.4fr) minmax(300px, 1fr);
		}
	}
	@media (max-width: 700px) {
		.diagram-panel {
			position: sticky;
			top: 0;
			z-index: 2;
			background: hsl(var(--b3));
			align-self: start;
		}
		.diagram-status {
			font-size: 12px;
			margin: 8px 20px;
		}
		section {
			padding: 48px 0;
		}
		.workspace {
			grid-template-columns: 1fr;
		}
		.controls {
			padding: 28px 24px;
		}
	}
</style>
