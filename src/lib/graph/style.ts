import type cytoscape from "cytoscape";
import {
    ANCHOR_RADIUS,
    ORBIFOLD_END_RADIUS,
    STROKE_WIDTH,
    VERTEX_RADIUS,
} from "./constants";

export function createStylesheet(): cytoscape.StylesheetCSS[] {
    const styles = getComputedStyle(document.documentElement);
    const cssVar = (name: string) => styles.getPropertyValue(name).trim();

    return [
        {
            selector: "node",
            css: {
                "font-family": "var(--font-mono)",
                "font-size": 11,
                "text-valign": "center",
                "text-halign": "center",
                "text-outline-width": 2,
                "text-outline-color": cssVar("--bg-primary"),
                color: cssVar("--text-primary"),
            },
        },
        {
            selector: ".star-parent",
            css: {
                "background-opacity": 0,
                "border-width": 0,
                events: "no",
            },
        },
        {
            selector: ".v-node",
            css: {
                width: VERTEX_RADIUS * 2,
                height: VERTEX_RADIUS * 2,
                shape: "ellipse",
                label: "data(multiplicityLabel)",
                "font-family": "var(--font-mono)",
                "font-size": 11,
                "font-weight": 700,
                "text-margin-y": 0,
                "text-outline-width": 0,
                "border-width": 2,
                "border-color": cssVar("--vertex-hollow-border"),
            },
        },
        {
            selector: ".v-node.hollow",
            css: {
                "background-color": cssVar("--bg-primary"),
                color: cssVar("--vertex-filled"),
            },
        },
        {
            selector: ".v-node.filled",
            css: {
                "background-color": cssVar("--vertex-filled"),
                color: cssVar("--bg-primary"),
            },
        },
        {
            selector: ".u-node",
            css: {
                width: 1,
                height: 1,
                opacity: 1,
                label: "data(label)",
                "font-family": "var(--font-mono)",
                "font-size": 10,
                "text-margin-y": -10,
                "border-width": 1,
                "border-style": "dashed",
                "border-color": cssVar("--text-secondary"),
                "background-opacity": 0,
                "border-opacity": 0,
            },
        },
        {
            selector: ".u-node.labeled",
            css: {
                opacity: 1,
                "background-opacity": 0,
                "border-opacity": 0,
            },
        },
        {
            selector: ".ordering-arrow-point",
            css: {
                width: 1,
                height: 1,
                opacity: 0,
                "background-opacity": 0,
                "border-opacity": 0,
                events: "no",
            },
        },
        {
            selector: ".curve-control-node",
            css: {
                width: 10,
                height: 10,
                shape: "ellipse",
                "background-color": cssVar("--accent"),
                "border-width": 2,
                "border-color": cssVar("--bg-primary"),
                "text-outline-width": 0,
                label: "",
            },
        },
        {
            selector: ".curve-control-guide",
            css: {
                width: 1.5,
                "line-color": cssVar("--accent"),
                "line-style": "dashed",
                "line-opacity": 0.65,
                "curve-style": "straight",
                "text-outline-width": 0,
                label: "",
                events: "no",
                "z-index": 1,
            },
        },
        {
            selector: ".orbifold-node",
            css: {
                width: ORBIFOLD_END_RADIUS * 2,
                height: ORBIFOLD_END_RADIUS * 2,
                shape: "rectangle",
                label: "×",
                color: cssVar("--orbifold-color"),
                "font-family": "var(--font-mono)",
                "font-size": 20,
                "font-weight": 700,
                "text-outline-width": 0,
                "background-opacity": 0,
                "border-width": 2,
                "border-color": cssVar("--orbifold-color"),
            },
        },
        {
            selector: "edge",
            css: {
                width: STROKE_WIDTH,
                "line-color": cssVar("--edge-color"),
                "target-arrow-color": cssVar("--edge-color"),
                "curve-style": "bezier",
                "font-family": "var(--font-mono)",
                "font-size": 11,
                color: cssVar("--text-primary"),
                "text-background-color": cssVar("--bg-primary"),
                "text-background-opacity": 0.9,
                "text-background-padding": "2px",
            },
        },
        {
            selector: ".he-edge",
            css: {
                "curve-style": "straight",
            },
        },
        {
            selector: ".ce-edge",
            css: {
                label: "data(label)",
            },
        },
        {
            selector: ".ordinary-edge",
            css: {
                "curve-style": "unbundled-bezier",
                "control-point-distances": "data(controlPointDistances)",
                "control-point-weights": "data(controlPointWeights)",
            },
        },
        {
            selector: ".orbifold-edge",
            css: {
                "curve-style": "straight",
                "line-color": cssVar("--orbifold-color"),
            },
        },
        {
            selector: ".ordering-arrow",
            css: {
                width: 1,
                "curve-style": "unbundled-bezier",
                "control-point-distances": "data(arrowControlDistance)",
                "control-point-weights": "data(arrowControlWeight)",
                "line-style": "dashed",
                "line-color": cssVar("--arrow-color"),
                "target-arrow-shape": "triangle",
                "target-arrow-color": cssVar("--arrow-color"),
                "arrow-scale": 0.7,
                events: "no",
            },
        },
        {
            selector: ".ordering-arrow.singleton",
            css: {
                "curve-style": "unbundled-bezier",
            },
        },
        {
            selector: ".ordering-arrow.no-arrowhead",
            css: {
                "target-arrow-shape": "none",
            },
        },
    ];
}
