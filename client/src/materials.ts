import type { Material } from "./types";

interface MaterialStyle {
  label: string;
  base: string; // mid-tone fill
  light: string; // highlight on cylinder face
  dark: string; // shadow on cylinder edges
  stroke: string;
}

export const MATERIAL_STYLES: Record<Material, MaterialStyle> = {
  steel: {
    label: "Steel",
    base: "#6d7178",
    light: "#a0a4ab",
    dark: "#3f434a",
    stroke: "#2a2d33",
  },
  stainless: {
    label: "Stainless",
    base: "#a4a9b0",
    light: "#cfd3d8",
    dark: "#6a6f76",
    stroke: "#43484f",
  },
  zinc: {
    label: "Zinc",
    base: "#b1b4b8",
    light: "#d8dadd",
    dark: "#7a7d82",
    stroke: "#4d5055",
  },
  black_oxide: {
    label: "Black Oxide",
    base: "#222428",
    light: "#3a3d44",
    dark: "#0d0e10",
    stroke: "#000000",
  },
  brass: {
    label: "Brass",
    base: "#bf9442",
    light: "#e8c87a",
    dark: "#7c5e21",
    stroke: "#4d3a14",
  },
  aluminum: {
    label: "Aluminum",
    base: "#c1c4c8",
    light: "#e3e5e8",
    dark: "#8a8d92",
    stroke: "#55585c",
  },
};
