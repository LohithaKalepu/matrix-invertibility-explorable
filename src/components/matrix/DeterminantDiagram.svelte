<script>
	import {
		identity2d,
		squareVertices,
		singularPreimages,
		formatMatrixNumber as fmt
	} from "$utils/matrix2d.js";

	export let matrix = [...identity2d];
	export let progress = 0;
	export let singular = false;
	export let recovery = false;
	export let recoveryScene = null;

	const size = 560;
	const padding = 60;
	let panelWidth = 560,
		panelHeight = 560;
	$: height = panelWidth > 0 ? (size * panelHeight) / panelWidth : size;
	const original = squareVertices(identity2d);
	$: target = squareVertices(matrix);
	$: current = target.map(([x, y], i) => [
		x + (original[i][0] - x) * progress,
		y + (original[i][1] - y) * progress
	]);
	// Equal x/y scales preserve area and angles. Keep the frame fixed during reversal.
	// Reserve space at matrix-edit time, independent of recovery mode/selection.
	$: preimages = singular ? singularPreimages(matrix) : [];
	$: all = [...original, ...target, ...preimages.flat()];
	$: xmin = Math.min(-0.5, ...all.map((p) => p[0]));
	$: xmax = Math.max(1.5, ...all.map((p) => p[0]));
	$: ymin = Math.min(-0.5, ...all.map((p) => p[1]));
	$: ymax = Math.max(1.5, ...all.map((p) => p[1]));
	$: span = Math.max(xmax - xmin, ymax - ymin);
	$: scale = Math.min(
		(size - padding * 2) / span,
		Math.max(80, height - padding * 2) / span
	);
	$: cx = (xmin + xmax) / 2;
	$: cy = (ymin + ymax) / 2;
	$: project = ([x, y]) => [
		size / 2 + (x - cx) * scale,
		height / 2 - (y - cy) * scale
	];
	$: polygon = (points) => points.map((p) => project(p).join(",")).join(" ");
	$: origin = project([0, 0]);
	$: tickStep = Math.pow(10, Math.floor(Math.log10(span / 5)));
	$: step = span / tickStep > 12 ? tickStep * 2 : tickStep;
	$: xTicks = ticks(cx - size / scale / 2, cx + size / scale / 2, step);
	$: yTicks = ticks(cy - height / scale / 2, cy + height / scale / 2, step);
	function ticks(min, max, increment) {
		const start = Math.ceil(min / increment);
		return Array.from(
			{ length: Math.max(0, Math.floor(max / increment) - start + 1) },
			(_, i) => (start + i) * increment
		);
	}
</script>

<figure>
	<div class="legend">
		{#if !recovery}<span><i class="original-key" /> Original unit square</span
			>{/if}
		<span
			><i class="image-key" />
			{recovery
				? "Observed output"
				: progress === 1
				? "Recovered square"
				: "Transformed square"}</span
		>
	</div>
	<div
		class="canvas"
		bind:clientWidth={panelWidth}
		bind:clientHeight={panelHeight}
	>
		<svg
			viewBox={`0 0 560 ${height}`}
			role="img"
			aria-label={recovery
				? "Observed collapsed output and the selected candidate transformation on the same coordinate grid."
				: singular
				? "The transformed unit square has collapsed to a line or point; its area is zero."
				: progress === 1
				? "The inverse has returned the transformed square to the original unit square."
				: "The unit square and its image under matrix A, with the two transformed basis vectors."}
		>
			{#each xTicks as x, i}
				<line
					x1={project([x, 0])[0]}
					x2={project([x, 0])[0]}
					y1="0"
					y2={height}
					class="grid"
				/>
				{#if Math.abs(x) > step / 2 && i % Math.max(1, Math.ceil(xTicks.length / 12)) === 0}
					<text x={project([x, 0])[0]} y={origin[1] + 19} text-anchor="middle"
						>{fmt(x)}</text
					>
				{/if}
			{/each}
			{#each yTicks as y, i}
				<line
					x1="0"
					x2={size}
					y1={project([0, y])[1]}
					y2={project([0, y])[1]}
					class="grid"
				/>
				{#if Math.abs(y) > step / 2 && i % Math.max(1, Math.ceil(yTicks.length / 12)) === 0}
					<text x={origin[0] - 9} y={project([0, y])[1] + 4} text-anchor="end"
						>{fmt(y)}</text
					>
				{/if}
			{/each}
			<line x1="0" x2={size} y1={origin[1]} y2={origin[1]} class="axis" />
			<line x1={origin[0]} x2={origin[0]} y1="0" y2={height} class="axis" />
			<text x="544" y={origin[1] - 10}>x</text>
			<text x={origin[0] + 10} y="18">y</text>
			<polygon
				points={polygon(current)}
				class:collapsed={singular}
				class="image"
			/>
			{#if !recovery}<polygon points={polygon(original)} class="original" />
				{#each [1, 3] as index}
					{@const end = project(current[index])}
					{@const angle =
						(Math.atan2(end[1] - origin[1], end[0] - origin[0]) * 180) /
						Math.PI}
					<g class={index === 1 ? "basis-x" : "basis-y"}>
						<line
							x1={origin[0]}
							y1={origin[1]}
							x2={end[0]}
							y2={end[1]}
							stroke-width="3"
						/>
						{#if Math.hypot(end[0] - origin[0], end[1] - origin[1]) > 12}
							<path
								d="M 0 0 L -11 -5 L -11 5 Z"
								transform={`translate(${end[0]} ${end[1]}) rotate(${angle})`}
							/>
						{/if}
					</g>
				{/each}
			{/if}
			{#each current as point}
				<circle
					cx={project(point)[0]}
					cy={project(point)[1]}
					r="3.5"
					fill="#67e8f9"
				/>
			{/each}
			{#if recovery && recoveryScene?.moving}
				{#if recoveryScene.animating}
					<polygon
						points={polygon(recoveryScene.candidate)}
						fill="none"
						stroke={recoveryScene.color}
						stroke-opacity="0.3"
						stroke-width="1.5"
					/>
					{#each recoveryScene.candidate as start, i}<line
							x1={project(start)[0]}
							y1={project(start)[1]}
							x2={project(recoveryScene.moving[i])[0]}
							y2={project(recoveryScene.moving[i])[1]}
							stroke={recoveryScene.color}
							stroke-opacity="0.3"
						/>{/each}
				{/if}
				<polygon
					points={polygon(target)}
					fill="none"
					stroke="#67e8f9"
					stroke-width={6 + recoveryScene.arrival * 7}
					stroke-linejoin="round"
				/>
				<polygon
					points={polygon(recoveryScene.moving)}
					fill={recoveryScene.color}
					fill-opacity="0.25"
					stroke={recoveryScene.color}
					stroke-width="3"
				/>
				{#each recoveryScene.moving as point}<circle
						cx={project(point)[0]}
						cy={project(point)[1]}
						r="4"
						fill={recoveryScene.color}
					/>{/each}
			{/if}

			<circle cx={origin[0]} cy={origin[1]} r="4" fill="#f8fafc" />
			<text x={origin[0] - 13} y={origin[1] + 19}>0</text>
		</svg>
	</div>
	<figcaption>
		<span class="pink">First column: ({fmt(matrix[0])}, {fmt(matrix[2])})</span>
		<span class="purple"
			>Second column: ({fmt(matrix[1])}, {fmt(matrix[3])})</span
		>
		<small
			>Equal scales on both axes. The view fits your matrix automatically.</small
		>
	</figcaption>
</figure>

<style>
	.canvas {
		height: clamp(440px, 76svh, 850px);
		width: 100%;
		overflow: hidden;
	}

	figure {
		position: relative;
		margin: 0;
		min-width: 0;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 22px;
		font-size: 13px;
		position: absolute;
		top: 20px;
		left: 28px;
		right: 20px;
		z-index: 1;
		pointer-events: none;
		color: #cbd5e1;
	}
	.legend span {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	i {
		display: inline-block;
		width: 23px;
		height: 13px;
	}
	.original-key {
		border: 2px dashed #f1f5f9;
	}
	.image-key {
		border: 2px solid #67e8f9;
		background: #164e63;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
		background: transparent;
		overflow: hidden;
	}
	.grid {
		stroke: #214554;
		stroke-width: 1;
	}
	.axis {
		stroke: #64748b;
		stroke-width: 1.5;
	}
	text {
		fill: #94a3b8;
		font: 11px sans-serif;
	}
	.original {
		fill: none;
		stroke: #f1f5f9;
		stroke-width: 2;
		stroke-dasharray: 7 5;
	}
	.image {
		fill: #22d3ee;
		fill-opacity: 0.22;
		stroke: #67e8f9;
		stroke-width: 3;
		stroke-linejoin: round;
	}
	.collapsed {
		stroke-width: 5;
	}
	.basis-x {
		stroke: #ff57bc;
		fill: #ff57bc;
	}
	.basis-y {
		stroke: #b18aff;
		fill: #b18aff;
	}
	.pink {
		color: #ff8ad0;
	}
	.purple {
		color: #c4a7ff;
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 20px;
		font-size: 13px;
		padding: 14px 28px;
	}
	small {
		flex-basis: 100%;
		color: #94a3b8;
		font-size: 12px;
	}
	@media (max-width: 700px) {
		.canvas {
			height: 42svh;
			min-height: 260px;
		}
		figcaption {
			display: none;
		}
		.legend {
			font-size: 11px;
			top: 12px;
			left: 20px;
		}
	}
</style>
