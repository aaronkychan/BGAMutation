import type { InitialLayout } from './positions';

export interface RenderOptions {
	showOrderArrows: boolean;
	showHalfEdgeLabels: boolean;
	showMultiplicityLabels: boolean;
	showEdgeLabels: boolean;
	direction: 'CW' | 'CCW';
	layout: InitialLayout;
}

export const defaultRenderOptions: RenderOptions = {
	showOrderArrows: false,
	showHalfEdgeLabels: false,
	showMultiplicityLabels: false,
	showEdgeLabels: false,
	direction: 'CW',
	layout: 'circle'
};

