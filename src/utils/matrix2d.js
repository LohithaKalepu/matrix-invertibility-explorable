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

export function formatMatrixNumber(value) {
	if (value === 0) return "0";
	// Preserve small nonzero values instead of rounding them to a displayed zero.
	if (Math.abs(value) < 0.0001 || Math.abs(value) >= 1000000) {
		return value.toExponential(4).replace(/\.?(0+)(?=e)/, "");
	}
	return String(Number(value.toPrecision(6)));
}
