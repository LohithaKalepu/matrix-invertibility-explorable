// Matrices use [a, b, c, d], representing rows [[a, b], [c, d]].
export const identity2d = [1, 0, 0, 1];

export function determinant2d([a, b, c, d]) {
	return a * d - b * c;
}

export function inverse2d(matrix) {
	const [a, b, c, d] = matrix;
	const det = determinant2d(matrix);
	return det === 0 ? null : [d / det, -b / det, -c / det, a / det];
}

export function squareVertices([a, b, c, d]) {
	return [
		[0, 0],
		[a, c],
		[a + b, c + d],
		[b, d]
	];
}

export function transformPoint2d([a, b, c, d], [x, y]) {
	return [a * x + b * y, c * x + d * y];
}

// Five affine images of the unit square with exactly the same image under A.
// This helper is only used for singular matrices; it does not round small
// nonzero determinants to zero.
export function singularPreimages(matrix) {
	if (determinant2d(matrix) !== 0) return [];
	const [a, b, c, d] = matrix;
	// Use the stronger row to avoid normalizing a zero (or much smaller) row.
	const [p, q] = Math.hypot(a, b) >= Math.hypot(c, d) ? [a, b] : [c, d];
	const length = Math.hypot(p, q);
	// For the zero matrix every direction is in the null space.
	const [nx, ny] = length === 0 ? [1, 0] : [-q / length, p / length];
	const variations = [
		{ stretch: -0.65, shift: -1.2 },
		{ stretch: -0.3, shift: 0.9 },
		{ stretch: 0, shift: 0 }, // Candidate 3 is the actual, unchanged unit square.
		{ stretch: 0.65, shift: -0.6 },
		{ stretch: 1.3, shift: 1.3 }
	];
	return variations.map(({ stretch, shift }) =>
		squareVertices(identity2d).map(([x, y]) => {
			// F(x) = x + n * (stretch * dot(n, x - center) + shift).
			// A F(x) = A x because A n = 0. Since 1 + stretch > 0,
			// each candidate is a nondegenerate filled parallelogram, not
			// merely four unrelated points with matching outputs.
			const offset = stretch * (nx * (x - 0.5) + ny * (y - 0.5)) + shift;
			return [x + nx * offset, y + ny * offset];
		})
	);
}

export function formatMatrixNumber(value) {
	if (value === 0) return "0";
	// Preserve small nonzero values instead of rounding them to a displayed zero.
	if (Math.abs(value) < 0.0001 || Math.abs(value) >= 1000000) {
		return value.toExponential(4).replace(/\.?(0+)(?=e)/, "");
	}
	return String(Number(value.toPrecision(6)));
}
