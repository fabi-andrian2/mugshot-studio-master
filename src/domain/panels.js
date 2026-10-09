export const DEFAULT_SECTIONS = {
  measure: true,
  position: true,
  appearance: true,
  layers: false,
  help: false,
};

export const toggleSection = (sections, id) => ({ ...sections, [id]: !sections[id] });