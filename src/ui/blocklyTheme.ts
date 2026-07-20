import * as Blockly from "blockly/core";

/**
 * Scratch-inspired theme. Workspace + flyout stay light (Scratch-like);
 * accents shift to cyan. Category chips keep varied vivid colours.
 */
export const friendlyTheme = Blockly.Theme.defineTheme("lhbFriendly", {
  name: "lhbFriendly",
  base: Blockly.Themes.Zelos,
  componentStyles: {
    workspaceBackgroundColour: "#fbf7ee",
    toolboxBackgroundColour: "#ffffff",
    toolboxForegroundColour: "#1a1a1a",
    flyoutBackgroundColour: "#f6fbfd",
    flyoutForegroundColour: "#0b3b48",
    flyoutOpacity: 0.98,
    scrollbarColour: "#8ed3e6",
    insertionMarkerColour: "#0e7490",
    insertionMarkerOpacity: 0.45,
    markerColour: "#0e7490",
    cursorColour: "#0e7490",
    selectedGlowColour: "#0e7490",
    selectedGlowOpacity: 0.9,
    replacementGlowColour: "#0e7490",
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
