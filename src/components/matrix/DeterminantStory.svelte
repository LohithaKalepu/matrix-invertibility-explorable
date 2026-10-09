<script>
	import { onMount } from "svelte";
	import katex from "katex";
	import DeterminantStoryDiagram from "./DeterminantStoryDiagram.svelte";
	import { colorB3 } from "$data/variables.js";

	// Narrative content stays separate from the isolated SVG choreography.
	const stages = [
		{
			title: "Can every transformation be undone?",
			text: "Matrices transform space. After a transformation happens, can we always recover where everything started?"
		},
		{
			title: "Invertibility",
			text: "A matrix is invertible when its transformation can be uniquely reversed. An inverse takes the transformed shape back to its starting position."
		},
		{
			title: "What tells us whether reversal is possible?",
			text: "Start with a unit square of area 1. Apply the matrix below. The absolute determinant is the area scale factor: the image has area 5."
		},
		{
			title: "Determinant and invertibility",
			text: "For a 2D square transformation, a nonzero determinant means the two basis directions remain independent, so the plane has not collapsed and the transformation can be uniquely reversed."
		},
		{
			title: "When area reaches zero",
			text: "What happens as a parallelogram becomes thinner? When its area reaches zero, it collapses into a line or point. A square matrix with determinant zero is called singular."
		},
		{
			title: "Information loss",
			text: "If all we know is the output, how could we determine which input it came from? Explore this question in the playground below."
		}
	];
	const equations = [
		[
			String.raw`A=\begin{bmatrix}2&1\\0&1\end{bmatrix}`,
			String.raw`\mathbf v'=A\mathbf v`
		],
		[String.raw`A^{-1}(A\mathbf v)=\mathbf v`],
		[
			String.raw`A=\begin{bmatrix}2&1\\1&-2\end{bmatrix}`,
			String.raw`\det(A)=-5,\qquad |\det(A)|=5`
		],
		[String.raw`\det(A)\ne 0`, String.raw`A^{-1}\text{ exists}`],
		[String.raw`\det(A)=0`, String.raw`A^{-1}\text{ does not exist}`],
		[String.raw`\mathbf v_1\ne\mathbf v_2,\qquad A\mathbf v_1=A\mathbf v_2`]
	].map((stage) =>
		stage.map((expr) => katex.renderToString(expr, { displayMode: true }))
	);
	const determinantFormula = katex.renderToString(
		String.raw`\det\!\begin{pmatrix}a&b\\c&d\end{pmatrix}=ad-bc`,
		{ displayMode: true }
	);

	let active = 0;
	let progress = 0;
	let reducedMotion = false;
	let root;
	let stageElements = [];

	onMount(() => {
		let pending = 0;
		let disposed = false;
		const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		function updateMotion() {
			reducedMotion = motionQuery.matches;
		}
		updateMotion();
		motionQuery.addEventListener("change", updateMotion);
		function measure() {
			pending = 0;
			// Read only local stage bounds. Every pose is a pure function of scroll:
			// no tween, timer, global store, or original ScrollTrigger participates.
			const threshold = window.innerHeight * 0.5;
			const bounds = stageElements.map((element) =>
				element.getBoundingClientRect()
			);
			let next = 0;
			bounds.forEach((rect, index) => {
				if (rect.top <= threshold) next = index;
			});
			const start = bounds[next].top;
			const end =
				bounds[next + 1]?.top ??
				bounds[next].bottom - (window.innerHeight - threshold);
			const local = Math.max(
				0,
				Math.min(1, (threshold - start) / Math.max(1, end - start))
			);
			active = next;
			progress = next + local;
		}
		function schedule() {
			if (!disposed && !pending) pending = requestAnimationFrame(measure);
		}
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		const observer = new ResizeObserver(schedule);
		observer.observe(root);
		stageElements.forEach((element) => observer.observe(element));
		document.fonts.ready.then(schedule);
		schedule();
		return () => {
			disposed = true;
			cancelAnimationFrame(pending);
			observer.disconnect();
			motionQuery.removeEventListener("change", updateMotion);
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
		};
	});
</script>

<section
	id="determinant-story"
	bind:this={root}
	style:background={colorB3}
	aria-label="A new question about matrix transformations"
>
	<div class="story-layout">
		<div class="visual">
			<div class="visual-inner">
				<DeterminantStoryDiagram {progress} {reducedMotion} />
			</div>
		</div>
		<div class="narrative">
			{#each stages as stage, i}
				<section
					class="stage"
					class:active={active === i}
					bind:this={stageElements[i]}
					aria-labelledby={`det-story-heading-${i}`}
				>
					{#if i === 0}<p class="chapter-label">A new question</p>{/if}
					<h2 id={`det-story-heading-${i}`}>{stage.title}</h2>
					<p>{stage.text}</p>
					<div class="display-math">
						{#each equations[i] as equation}<div>{@html equation}</div>{/each}
					</div>
					{#if i === 3}<p>
							You may recognize the algebraic formula below. Geometrically, this
							number measures what happens to area under the transformation.
						</p>
						<div class="display-math">{@html determinantFormula}</div>{/if}
					{#if i === 5}<a href="#determinant-invertibility"
							>Try it in the playground ↓</a
						>{/if}
				</section>
			{/each}
		</div>
	</div>
</section>

<style>
	.display-math {
		margin: 8px 0 28px;
		font-size: clamp(15px, 1.4vw, 20px);
		color: hsl(var(--bc));
	}
	.display-math :global(.katex-display) {
		margin: 0.65em 0;
		overflow-x: auto;
		overflow-y: hidden;
		padding-block: 3px;
	}

	.story-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: 0;
		width: 100%;
	}
	.visual {
		position: sticky;
		top: 0;
		height: 100vh;
		height: 100svh;
		align-self: start;
		overflow: clip;
		min-width: 0;
	}
	.visual-inner {
		width: 100%;
		height: 100%;
		min-width: 0;
		overflow: clip;
	}
	.narrative {
		min-width: 0;
		padding-inline: clamp(24px, 4vw, 64px);
	}
	.stage {
		min-height: 90vh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 64px 0;
		max-width: 48ch;
		color: hsl(var(--bc) / 0.7);
	}
	.stage.active {
		color: hsl(var(--bc));
	}
	h2 {
		font-size: clamp(26px, 2.5vw, 36px);
		line-height: 1.25;
		font-weight: 700;
		margin: 0 0 24px;
	}
	.stage p {
		font-size: 20px;
		line-height: 1.75;
		margin: 0 0 24px;
	}
	.stage .chapter-label {
		font-size: 14px;
		letter-spacing: 0.12em;
		color: hsl(var(--p));
	}
	a {
		color: hsl(var(--in));
		text-underline-offset: 5px;
		text-decoration: underline;
		font-size: 18px;
	}
	a:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 5px;
	}
	@media (max-width: 800px) {
		.story-layout {
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
		}
		.visual {
			height: 42svh;
			z-index: 1;
			background: inherit;
		}
		.visual-inner {
			width: 100%;
			height: 100%;
		}
		.story-layout {
			background: inherit;
		}
		.stage {
			min-height: 75svh;
			padding-block: 48px;
		}
		.stage p {
			font-size: 18px;
		}
	}
</style>
