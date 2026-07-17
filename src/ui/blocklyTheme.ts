import * as Blockly from "blockly/core";

/**
 * Friendlier kid-oriented Blockly theme. Extends Zelos with softer background,
 * higher-contrast category chips, and rounded font. Category text colour is
 * forced to white via CSS so it reads on any hue.
 */
export const friendlyTheme = Blockly.Theme.defineTheme("lhbFriendly", {
  name: "lhbFriendly",
  base: Blockly.Themes.Zelos,
  componentStyles: {
    workspaceBackgroundColour: "#fbf7ee",
    toolboxBackgroundColour: "#f5f2ec",
    toolboxForegroundColour: "#1a1a1a",
    flyoutBackgroundColour: "#fffaf0",
    flyoutForegroundColour: "#333",
    flyoutOpacity: 0.96,
    scrollbarColour: "#b8ad96",
    insertionMarkerColour: "#f2b807",
    insertionMarkerOpacity: 0.4,
    markerColour: "#f2b807",
    cursorColour: "#f2b807",
  },
  categoryStyles: {
    events_category: { colour: "#f5b400" },
    hub_category: { colour: "#3aa2ff" },
    motor_category: { colour: "#28c76f" },
    sensor_category: { colour: "#a78bfa" },
    logic_category: { colour: "#4c97ff" },
    loop_category: { colour: "#28c76f" },
    math_category: { colour: "#59c059" },
    text_category: { colour: "#ff8c1a" },
    list_category: { colour: "#ff6680" },
    variable_category: { colour: "#ff8c1a" },
    procedure_category: { colour: "#c88bff" },
  },
  blockStyles: {},
  fontStyle: {
    family: 'system-ui, "Segoe UI", Roboto, sans-serif',
    weight: "600",
    size: 13,
  },
  startHats: true,
});
