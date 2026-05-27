export function downloadJson(filename: string, value: unknown): void {
	const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

export function readJsonFile(file: File): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			try {
				resolve(JSON.parse(String(reader.result)));
			} catch (error) {
				reject(error);
			}
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsText(file);
	});
}
