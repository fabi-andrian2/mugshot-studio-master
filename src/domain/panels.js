export const DEFAULT_SECTIONS = {
  measure: true,
  position: true,
  appearance: true,
  layers: false,
  help: false,
};

export const toggleSection = (sections, id) => ({ ...sections, [id]: !sections[id] });

export const PANEL_BREAKPOINT_PX = 1280;

export const getInitialPanelLayout = (viewportWidth) => ({
  layersOpen: Number.isFinite(viewportWidth) && viewportWidth >= PANEL_BREAKPOINT_PX,
});

export const toggleLayersPanel = (layout) => ({ ...layout, layersOpen: !layout.layersOpen });