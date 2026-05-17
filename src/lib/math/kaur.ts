export interface Fan {
	elements: number[];
	isFullCycle: boolean;
	cycleIndex: number;
	startIndex: number;
	endIndex: number;
}

export function computeFans(sigma0: number[][], selected: Set<number>): Fan[] {
	const fans: Fan[] = [];

	for (const [cycleIndex, cycle] of sigma0.entries()) {
		if (cycle.length === 0) continue;

		const selectedFlags = cycle.map((halfEdge) => selected.has(halfEdge));
		if (!selectedFlags.some(Boolean)) continue;

		if (selectedFlags.every(Boolean)) {
			fans.push({
				elements: [...cycle],
				isFullCycle: true,
				cycleIndex,
				startIndex: 0,
				endIndex: cycle.length - 1
			});
			continue;
		}

		for (let index = 0; index < cycle.length; index += 1) {
			const previous = (index - 1 + cycle.length) % cycle.length;
			if (!selectedFlags[index] || selectedFlags[previous]) continue;

			const elements: number[] = [];
			let cursor = index;

			while (selectedFlags[cursor]) {
				elements.push(cycle[cursor]);
				cursor = (cursor + 1) % cycle.length;
			}

			fans.push({
				elements,
				isFullCycle: false,
				cycleIndex,
				startIndex: index,
				endIndex: (cursor - 1 + cycle.length) % cycle.length
			});
		}
	}

	return fans;
}
