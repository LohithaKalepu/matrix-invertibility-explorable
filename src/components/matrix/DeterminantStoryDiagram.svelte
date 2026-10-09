<script>
	import {
		squareVertices,
		identity2d,
		determinant2d,
		formatMatrixNumber as fmt
	} from "$utils/matrix2d.js";
	import {
		colorX,
		colorY,
		colorVector,
		colorGridAlt,
		colorGrid,
		colorB3
	} from "$data/variables.js";

	export let progress = 0;
	export let reducedMotion = false;
	const shear = [2, 1, 0, 1];
	const areaMatrix = [2, 1, 1, -2];
	const singularMatrix = [2, 1, 1, 0.5];
	// Overscan the source plane: transformed endpoints remain far offscreen.
	// A finite, generously padded patch also makes its loss of dimension visible.
	const ticks = Array.from({ length: 81 }, (_, i) => i - 40);
	const extent = 120;
	let viewportWidth = 640;
	let viewportHeight = 680;
	$: viewHeight =
		viewportWidth > 0 ? (640 * viewportHeight) / viewportWidth : 680;
	// Compose within the full panel; only projection changes, never the matrix.
	const originX = 240;
	$: originY = viewHeight * 0.52;
	$: unitScale = Math.min(96, Math.max(24, (viewHeight - 180) * 0.23));
	const transformPoint = ([a, b, c, d], [x, y]) => [
		a * x + b * y,
		c * x + d * y
	];
	const unit = squareVertices(identity2d);
	const clamp = (t) => Math.max(0, Math.min(1, t));
	const ease = (t) => {
		t = clamp(t);
		return t * t * (3 - 2 * t);
	};
	const phase = (t, start, end) => ease((t - start) / (end - start));
	const mix = (a, b, t) => a + (b - a) * t;
	const matrixMix = (a, b, t) => a.map((value, i) => mix(value, b[i], t));
	// Projection is declared reactively so resizing updates every SVG endpoint.
	$: project = ([x, y]) => [originX + x * unitScale, originY - y * unitScale];
	$: polygon = (points) =>
		points.map((point) => project(point).join(",")).join(" ");

	// Shared endpoint matrices keep space continuous at every stage boundary.
	function pose(value) {
		const stage = Math.min(5, Math.floor(value));
		const t = clamp(value - stage);
		let matrix;
		if (stage === 0) {
			matrix = matrixMix(identity2d, shear, phase(t, 0.3, 0.82));
		} else if (stage === 1) {
			matrix = matrixMix(shear, identity2d, phase(t, 0.18, 0.8));
		} else if (stage === 2) {
			matrix = matrixMix(identity2d, areaMatrix, phase(t, 0.2, 0.8));
		} else if (stage === 3) {
			matrix = areaMatrix;
		} else if (stage === 4) {
			matrix = matrixMix(areaMatrix, singularMatrix, phase(t, 0.12, 0.85));
		} else {
			matrix = singularMatrix;
		}
		return { stage, t, matrix };
	}

	$: bounded = Math.max(0, Math.min(6, progress));
	$: scene = pose(
		reducedMotion ? Math.min(6, Math.floor(bounded) + 1) : bounded
	);
	$: vertices = squareVertices(scene.matrix);
	$: determinant = determinant2d(scene.matrix);
	$: p = reducedMotion ? Math.min(6, Math.floor(bounded) + 1) : bounded;
	$: referenceOpacity = 0.4 * (1 - phase(p, 4.85, 5.15));
	$: squareOpacity = 1 - phase(p, 5.1, 5.42) * 0.65;
	$: areaOpacity = phase(p, 2.1, 2.3) * (1 - phase(p, 5, 5.2));
	$: inverseOpacity = phase(p, 1.05, 1.18) * (1 - phase(p, 1.8, 2));
	$: shearOpacity = phase(p, 0.1, 0.3) * (1 - phase(p, 0.8, 1));
	$: matrixOpacity = phase(p, 2, 2.18) * (1 - phase(p, 4.9, 5.1));
	$: ghostOpacity = 0.25 * phase(p, 1.05, 1.22) * (1 - phase(p, 1.7, 2));
	$: independentOpacity = phase(p, 3.08, 3.3) * (1 - phase(p, 3.78, 4));
	$: recoveryOpacity = phase(p, 1.8, 1.95) * (1 - phase(p, 2, 2.15));
	$: inputOpacity = phase(p, 5.12, 5.25);
	$: converge = phase(p, 5.28, 5.7);
	$: ambiguity = phase(p, 5.76, 5.98);
	// These three distinct vectors differ by multiples of (-1/2, 1).
	// A = [[2,1],[1,1/2]] maps every one to (2,1).
	const inputs = [
		[1.5, -1],
		[1, 0],
		[0.5, 1]
	];
	const image = [2, 1];
	const colors = [colorX, colorY, colorVector];
	$: flying = inputs.map((point) =>
		point.map((value, i) => mix(value, image[i], converge))
	);
	// The grid, square and basis all use scene.matrix. No CSS skew or translation.
	$: gridLines = ticks
		.flatMap((value) => [
			{ value, start: [value, -extent], end: [value, extent] },
			{ value, start: [-extent, value], end: [extent, value] }
		])
		.map((line) => ({
			value: line.value,
			start: project(transformPoint(scene.matrix, line.start)),
			end: project(transformPoint(scene.matrix, line.end))
		}));
	// Reduced motion uses settled poses and scroll-driven fades.
	$: local = bounded - Math.floor(bounded);
	$: sceneOpacity = reducedMotion
		? (bounded < 1 ? 1 : phase(local, 0, 0.08)) *
		  (bounded >= 5 ? 1 : 1 - phase(local, 0.92, 1))
		: 1;
	$: if (bounded >= 6) sceneOpacity = 1;
</script>

<div
	class="plane"
	bind:clientWidth={viewportWidth}
	bind:clientHeight={viewportHeight}
>
	<svg
		viewBox={`0 0 640 ${viewHeight}`}
		style:--annotation-background={colorB3}
		role="img"
		aria-label={`Matrix transformation story. Current matrix: ${scene.matrix
			.map(fmt)
			.join(", ")}.${
			p >= 2.3
				? ` Determinant ${fmt(determinant)}; area scale factor ${fmt(
						Math.abs(determinant)
				  )}.`
				: ""
		}${
			p >= 5.7
				? " Three different input vectors meet at the same output (2, 1)."
				: ""
		}`}
	>
		<g opacity={sceneOpacity}>
			<!-- Persistent source lines, transformed numerically with the same matrix
		     as the basis and square. The fixed SVG viewport clips the plane. -->
			<g class="grid" opacity="0.72">
				{#each gridLines as line}
					<line
						x1={line.start[0]}
						y1={line.start[1]}
						x2={line.end[0]}
						y2={line.end[1]}
						stroke={line.value % 5 === 0 ? colorGrid : colorGridAlt}
						stroke-width={line.value === 0
							? 2
							: line.value % 5 === 0
							? 1.4
							: 0.8}
					/>
				{/each}
			</g>
			<!-- The same polygon and the same arrows persist through the first five stages. -->
			<g>
				<polygon
					points={polygon(unit)}
					class="reference"
					opacity={referenceOpacity}
				/>
				<polygon
					points={polygon(squareVertices(shear))}
					class="ghost"
					stroke={colorVector}
					opacity={ghostOpacity}
				/>
				<polygon
					points={polygon(vertices)}
					fill={colorVector}
					fill-opacity={0.16 + 0.14 * areaOpacity}
					stroke={colorVector}
					stroke-width="2.5"
					stroke-linejoin="round"
					opacity={squareOpacity}
				/>
				<g opacity={1 - phase(p, 5, 5.25)}>
					{#each [1, 3] as index}
						{@const end = project(vertices[index])}
						{@const angle =
							(Math.atan2(end[1] - originY, end[0] - originX) * 180) / Math.PI}
						<g
							stroke={index === 1 ? colorX : colorY}
							fill={index === 1 ? colorX : colorY}
						>
							<line
								x1={originX}
								y1={originY}
								x2={end[0]}
								y2={end[1]}
								stroke-width={3 + independentOpacity}
							/>
							<path
								d="M 0 0 L -11 -5 L -11 5 Z"
								transform={`translate(${end[0]} ${end[1]}) rotate(${angle})`}
								opacity={clamp(
									Math.hypot(end[0] - originX, end[1] - originY) / 12
								)}
							/>
							<circle
								cx={end[0]}
								cy={end[1]}
								r={5 + independentOpacity * 3}
								fill="none"
								opacity={independentOpacity}
							/>
						</g>
					{/each}
				</g>
				<circle cx={originX} cy={originY} r="3" fill="currentColor" />
				<text x={originX - 14} y={originY + 20} class="tick">0</text>
				<text
					x={originX + 8}
					y={originY - 18}
					class="small"
					opacity={phase(p, 2.02, 2.15) * (1 - phase(p, 2.3, 2.5))}>area 1</text
				>
			</g>

			<g
				transform="translate(28 34)"
				opacity={Math.max(shearOpacity, matrixOpacity)}
			>
				<text class="small" opacity={shearOpacity}>Apply</text>
				<g transform="translate(0 25)" class="math-overlay">
					<text x="0" y="35"><tspan font-style="italic">A</tspan> =</text>
					<path
						d="M 72 0 H 62 V 64 H 72 M 346 0 H 356 V 64 H 346"
						class="bracket"
					/>
					{#each p < 2 ? shear : scene.matrix as entry, index}
						<text
							x={130 + (index % 2) * 150}
							y={index < 2 ? 23 : 53}
							text-anchor="middle">{fmt(Number(entry.toPrecision(4)))}</text
						>
					{/each}
				</g>
				<g class="math-overlay" opacity={areaOpacity}>
					<text y="124"
						>det(<tspan font-style="italic">A</tspan>) = {fmt(
							determinant
						)}</text
					>
					<text y="160"
						>|det(<tspan font-style="italic">A</tspan>)| = {fmt(
							Math.abs(determinant)
						)}</text
					>
				</g>
			</g>
			<g transform="translate(28 42)" opacity={inverseOpacity}>
				<text class="math-overlay"
					>Apply <tspan font-style="italic">A</tspan><tspan
						baseline-shift="super"
						font-size="65%">−1</tspan
					></text
				>
				<text y="34" class="small">return to the square</text>
			</g>
			<text
				x="360"
				y={originY + 100}
				class="annotation"
				opacity={recoveryOpacity}>Recovered square</text
			>
			<text x="28" y={viewHeight - 86} class="annotation" opacity={areaOpacity}
				>area {fmt(Math.abs(determinant))}</text
			>
			<text x="28" y={viewHeight - 58} class="small" opacity={areaOpacity}
				>Area scales by |det(A)|</text
			>

			<!-- One light many-to-one example, separate from the five-candidate playground. -->
			<g opacity={inputOpacity}>
				{#each inputs as point, i}
					{@const start = project(point)}
					{@const end = project(flying[i])}
					{@const target = project(image)}
					<g>
						<line
							x1={start[0]}
							y1={start[1]}
							x2={target[0]}
							y2={target[1]}
							stroke={colors[i]}
							stroke-dasharray="4 5"
							opacity={0.3 * converge}
						/>
						<line
							x1={originX}
							y1={originY}
							x2={start[0]}
							y2={start[1]}
							stroke={colors[i]}
							stroke-width="2"
							opacity={0.18 * converge + 0.5 * ambiguity}
						/>
						<circle
							cx={start[0]}
							cy={start[1]}
							r="5"
							fill={colors[i]}
							opacity={0.25 * converge + 0.65 * ambiguity}
						/>
						<g>
							<line
								x1={originX}
								y1={originY}
								x2={end[0]}
								y2={end[1]}
								stroke={colors[i]}
								stroke-width="2.5"
								opacity={1 - converge}
							/>
							<circle cx={end[0]} cy={end[1]} r={6 - i} fill={colors[i]} />
						</g>
						<text
							x={start[0] - 24}
							y={start[1] + (i === 2 ? -12 : 22)}
							class="small"
							fill={colors[i]}
							opacity={ambiguity}>?</text
						>
					</g>
				{/each}
				<circle
					cx={project(image)[0]}
					cy={project(image)[1]}
					r="11"
					stroke={colorVector}
					stroke-width="2"
					fill="none"
					opacity={converge}
				/>
				<text x="345" y={originY - 140} class="annotation" opacity={converge}
					>Same output (2, 1)</text
				>
				<text x="90" y={originY + 165} class="annotation" opacity={ambiguity}
					>Which input?</text
				>
			</g>
			<text
				x="320"
				y={viewHeight - 22}
				text-anchor="middle"
				class="caption"
				opacity={0.65 * (1 - phase(p, 5, 5.2))}
				>input → transformation → output</text
			>
			<text
				x="320"
				y={viewHeight - 22}
				text-anchor="middle"
				class="caption"
				opacity={0.65 * inputOpacity}>different inputs → same output</text
			>
		</g>
	</svg>
</div>

<style>
	.plane {
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: hidden;
		color: hsl(var(--bc));
	}
	text {
		fill: currentColor;
		paint-order: stroke;
		stroke: var(--annotation-background);
		stroke-width: 5px;
		stroke-linejoin: round;
		font-family: "Chivo Variable", sans-serif;
	}
	.tick {
		font-size: 13px;
		opacity: 0.65;
	}
	.caption {
		font-size: 14px;
	}
	.small {
		font-size: 17px;
	}
	.annotation {
		font-size: 22px;
	}
	.math-overlay,
	.math-overlay text {
		font-family: "Old Standard TT", serif;
		font-size: 22px;
	}
	.bracket {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
	}
	.reference {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-dasharray: 6 5;
	}
	.ghost {
		fill: none;
		stroke-width: 2;
	}
</style>
