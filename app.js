body {
  font-family: Arial, sans-serif;
  text-align: center;
  margin: 20px;
  background: linear-gradient(150deg, #2a2a2a, #1a1a1a, #2a2a2a);
  background-size: 400% 400%;
  animation: metalAnimation 10s ease infinite;
}

@keyframes metalAnimation {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
}

#synthesizer {
  display: inline-block;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  border: 1px solid #333;
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(135deg, #2c2c2c 0%, #1c1c1c 100%);
}

#synthesizer h1 {
  width: 100%;
  margin: 0;
  padding: 20px;
  background: linear-gradient(135deg, #555 0%, #222 100%);
  color: white;
  text-align: center;
  box-sizing: border-box;
  border-bottom: 1px solid #333;
}

#synthesizer-panel {
  background: linear-gradient(135deg, #3a3a3a 0%, #1c1c1c 100%);
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

#controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

#controls button {
  background-color: #444;
  border: 1px solid #000;
  box-shadow: inset -1.2px -1.2px 3px rgba(0, 0, 0, 0.7), inset 1.2px 1.2px 3px rgba(255, 255, 255, 0.1);
  color: white;
  margin: 2px;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
}

#controls button.text-button {
  width: auto;
  height: 28px;
  padding: 0 6px;
  font-size: 18px;
}

#controls button svg {
  width: 18px;
  height: 18px;
  fill: white;
}

#controls button:active {
  box-shadow: inset 1.2px 1.2px 3px rgba(0, 0, 0, 0.7), inset -1.2px -1.2px 3px rgba(255, 255, 255, 0.1);
}

#controls button:hover {
  background-color: #555;
}

#controls button.pressed {
  box-shadow: inset 1.2px 1.2px 3px rgba(0, 0, 0, 0.7), inset -1.2px -1.2px 3px rgba(255, 255, 255, 0.1);
  background-color: #333;
}

#controls button#prev-note-btn,
#controls button#next-note-btn {
  width: 28px;
  height: 28px;
  transform: scale(0.9);
}

#controls button#prev-note-btn svg,
#controls button#next-note-btn svg {
  width: 18px;
  height: 18px;
}

#midi-channel-section {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 10px 0;
}

#midi-channel-section .group-label {
  margin-right: 10px;
}

#midi-channel-section .group-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

#midi-channel-section .group-buttons button {
  margin: 2px;
  padding: 4px 8px;
  min-width: 30px;
  background-color: #444;
  border: 1px solid #000;
  box-shadow: inset -1.2px -1.2px 3px rgba(0, 0, 0, 0.7), inset 1.2px 1.2px 3px rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

#midi-channel-section .group-buttons button:hover {
  background-color: #555;
}

#midi-channel-section .group-buttons button.pressed {
  box-shadow: inset 1.2px 1.2px 3px rgba(0, 0, 0, 0.7), inset -1.2px -1.2px 3px rgba(255, 255, 255, 0.1);
  background-color: #333;
}

#lcd-displays {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 10px;
}

#device-section,
#memory-section,
#tempo-section {
  position: relative;
  margin: 0 5px;
  display: inline-block;
}

#device-display,
#memory-display {
  background-color: #ADD8E6;
  color: #000;
  padding: 5px 10px;
  border: 2px solid #004400;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

#selected-memory,
#selected-device,
#memory-display input {
  flex-grow: 1;
  flex-shrink: 0;
  width: 24ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Courier New', monospace;
  border: none;
  outline: none;
  background-color: transparent;
  color: #000;
}

#memory-display input {
  padding: 0;
  margin: 0;
}

#device-toggle-btn,
#memory-toggle-btn {
  background: none;
  border: none;
  padding: 0;
  margin-left: 5px;
  cursor: pointer;
}

#device-toggle-btn svg,
#memory-toggle-btn svg {
  width: 16px;
  height: 16px;
  fill: #000;
}

#memory-display {
  display: flex;
  align-items: center;
}

#memory-display button {
  background: none;
  border: none;
  padding: 0;
  margin-left: 5px;
  cursor: pointer;
}

#memory-display button svg {
  width: 16px;
  height: 16px;
  fill: #000;
}

#device-list-container,
#memory-list-container {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: #ADD8E6;
  border: 2px solid #004400;
  border-top: none;
  width: 100%;
  max-height: 150px;
  overflow-y: auto;
  z-index: 1000;
  display: none;
}

#device-list,
#memory-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

#device-list li,
#memory-list li {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
}

#memory-list li input[type='checkbox'] {
  margin-right: 5px;
}

#device-list li:hover,
#memory-list li:hover {
  background-color: #7EC0EE;
}

#tempo-section {
  position: relative;
  margin: 0 5px;
  display: inline-block;
}

#tempo-display {
  position: relative;
  width: 100px;
  margin: 0 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

#tempo-value {
  margin-bottom: 5px;
  font-family: 'Courier New', monospace;
  color: lightblue;
}

#tempo-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 2px;
  background: linear-gradient(to bottom, #e6e6e6, #ccc);
  outline: none;
  border-radius: 5px;
  border: 1px solid #aaa;
  box-shadow: 0 0 10px 2px red;
  animation: rainbowGlow 5s linear infinite;
  margin-top: -4px; /* Adjust to vertically center the slider thumb */
}

@keyframes rainbowGlow {
  0% {
    box-shadow: 0 0 10px 2px red;
  }
  16% {
    box-shadow: 0 0 10px 2px orange;
  }
  33% {
    box-shadow: 0 0 10px 2px yellow;
  }
  50% {
    box-shadow: 0 0 10px 2px green;
  }
  66% {
    box-shadow: 0 0 10px 2px blue;
  }
  83% {
    box-shadow: 0 0 10px 2px indigo;
  }
  100% {
    box-shadow: 0 0 10px 2px violet;
  }
}

#tempo-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #555, #222);
  border: 1px solid #000;
  box-shadow: inset -2px -2px 4px rgba(255, 255, 255, 0.2), inset 2px 2px 4px rgba(0, 0, 0, 0.6);
  cursor: pointer;
  margin-top: -5px;
}

#tempo-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #555, #222);
  border: 1px solid #000;
  box-shadow: inset -2px -2px 4px rgba(255, 255, 255, 0.2), inset 2px 2px 4px rgba(0, 0, 0, 0.6);
  cursor: pointer;
  margin-top: -5px;
}

#piano {
  width: 100%;
  display: flex;
  justify-content: center;
  user-select: none;
  border-top: 1px solid #333;
  border-bottom: 1px solid #333;
  background: #222;
  padding-bottom: 5px;
  flex-wrap: nowrap;
  max-width: 100%;
}

.key-container {
  position: relative;
  flex: 0 0 calc(100% / 42);
  box-sizing: border-box;
}

.key {
  width: 100%;
  height: 150px;
  margin: 0;
  border: 1px solid #000;
  background: linear-gradient(to bottom, #fff, #ccc);
  box-sizing: border-box;
  touch-action: manipulation;
  position: relative;
}

.key.black {
  position: absolute;
  width: 60%;
  height: 60%;
  top: 0;
  left: 70%;
  z-index: 1;
  background: linear-gradient(to bottom, #333, #000);
  color: #fff;
}

.key-label {
  position: absolute;
  bottom: 2px;
  width: 100%;
  text-align: center;
  font-size: 0.8em;
  pointer-events: none;
}

#editor-container {
  display: none;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  background-color: #1e1e1e;
}

#editor {
  height: 600px;
  background-color: #1e1e1e;
  color: #d4d4d4;
}

#add-editor-content-btn {
  background-color: #444;
  border: 1px solid #000;
  box-shadow: inset -1.2px -1.2px 3px rgba(0, 0, 0, 0.7), inset 1.2px 1.2px 3px rgba(255, 255, 255, 0.1);
  color: white;
  margin: 10px 0;
  padding: 0;
  border-radius: 4px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

#add-editor-content-btn svg {
  width: 16px;
  height: 16px;
  fill: white;
}

#add-editor-content-btn:active {
  box-shadow: inset 1.2px 1.2px 3px rgba(0, 0, 0, 0.7), inset -1.2px -1.2px 3px rgba(255, 255, 255, 0.1);
}

#add-editor-content-btn:hover {
  background-color: #555;
}

#title-container {
  width: 100%;
  background: linear-gradient(135deg, #2c2c2c 0%, #1c1c1c 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 5px 0;
}

#title-container h1 {
  margin: 0;
  font-size: 2em;
  display: flex;
  align-items: center;
}

#title-container .handscript {
  color: white;
  font-family: 'Great Vibes', cursive;
  margin-right: 10px;
}

#title-container .rainbow {
  background: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet);
  background-size: 400%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rainbow 5s linear infinite;
}

@keyframes rainbow {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
}

#toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

/* Control groups */
.control-group {
  display: inline-block;
  margin: 0 5px;
  vertical-align: top;
  text-align: center;
  position: relative;
}

.transpose-amount {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: white;
}

.group-label {
  position: relative;
  text-align: center;
  color: white;
  margin-bottom: 5px;
}

.group-label::before {
  content: '';
  border-top: 1px solid white;
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  z-index: 0;
}

.group-label span {
  background-color: #1c1c1c;
  padding: 0 5px;
  position: relative;
  z-index: 1;
}

.group-buttons {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
}

/* Reduce button size in control groups */
.control-group .group-buttons button {
  margin: 2px;
  padding: 0;
  width: 28px;
  height: 28px;
}

/* Adjust font size for text buttons in control groups */
.control-group .group-buttons button.text-button {
  font-size: 12px;
  padding: 0 4px;
  height: 24px;
}

.metal-button {
  background: linear-gradient(135deg, #444, #222);
  color: white;
  border: 1px solid #000;
  box-shadow: inset -1px -1px 2px rgba(255, 255, 255, 0.1), inset 1px 1px 2px rgba(0, 0, 0, 0.7);
}

#key-section {
  position: relative;
  margin: 0 5px;
  display: inline-block;
}

#key-section .group-buttons button {
  width: 24px;
  height: 24px;
  margin: 2px;
  padding: 0;
  font-size: 14px;
}

.ql-toolbar {
  background-color: #2d2d2d;
  border: 1px solid #3c3c3c;
}

.ql-toolbar button,
.ql-toolbar .ql-picker-label,
.ql-toolbar .ql-picker-item {
  color: #d4d4d4 !important;
}

.ql-toolbar button:hover,
.ql-toolbar .ql-picker-label:hover,
.ql-toolbar .ql-picker-item:hover,
.ql-toolbar button.ql-active {
  color: #ffffff !important;
}

.ql-toolbar .ql-picker-options {
  background-color: #2d2d2d;
  border: 1px solid #3c3c3c;
}

.ql-toolbar .ql-picker-item:hover {
  background-color: #3c3c3c;
}

.ql-editor {
  background-color: #1e1e1e;
  color: #d4d4d4;
}

.ql-editor a {
  color: #569cd6;
  cursor: pointer;
}

.ql-editor a:hover {
  color: #9cdcfe;
}

.ql-editor .ql-code-block {
  background-color: #252526;
  color: #d4d4d4;
}

.ql-editor .ql-code-block::before {
  color: #6a9955;
}

.ql-editor blockquote {
  border-left: 4px solid #6a9955;
}

.ql-editor .ql-header {
  color: #569cd6;
}

.ql-editor .ql-font-monospace {
  font-family: 'Courier New', monospace;
  color: #d4d4d4;
}

.ql-editor .ql-cursor {
  border-left: 1px solid #d4d4d4;
}

/* Pressed down animation for transpose buttons */
#transpose-down-btn,
#transpose-up-btn {
  transition: transform 0.1s;
}

#transpose-down-btn:active,
#transpose-up-btn:active {
  transform: translateY(2px);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.6);
}

/* Style for notepad M+ button when associated with editor content */
#add-editor-content-btn.editor-associated {
  border-color: lightblue;
}

#memory-editor-container {
  max-width: 800px;
  margin: 20px auto;
  background-color: #1e1e1e;
  padding: 15px;
  color: #d4d4d4;
}

#memory-editor-name {
  margin-bottom: 10px;
}

#memory-editor-name label {
  display: block;
  color: #d4d4d4;
  margin-bottom: 5px;
}

#memory-editor-name input {
  width: 100%;
  box-sizing: border-box;
  background-color: #252526;
  color: #d4d4d4;
  border: 1px solid #3c3c3c;
  padding: 4px;
}

#memory-editor-table {
  width: 100%;
  border-collapse: collapse;
}

#memory-editor-table th,
#memory-editor-table td {
  border: 1px solid #3c3c3c;
  padding: 8px;
  text-align: left;
}

#memory-editor-table th {
  background-color: #2d2d2d;
  color: #d4d4d4;
}

#memory-editor-table input,
#memory-editor-table select {
  width: 100%;
  box-sizing: border-box;
  background-color: #252526;
  color: #d4d4d4;
  border: 1px solid #3c3c3c;
  padding: 4px;
}

#memory-editor-controls {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-bottom: 10px;
}

#memory-add-controls {
  display: flex;
  align-items: center;
}

#memory-add-controls .group-label {
  flex: 1;
  text-align: center;
  font-size: 16px;
  color: white;
}

#memory-add-fields {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  flex: 3;
}

#memory-add-fields input {
  margin-right: 5px;
  padding: 4px;
  background-color: #252526;
  color: #d4d4d4;
  border: 1px solid #3c3c3c;
}

#memory-add-fields select {
  margin-right: 5px;
  padding: 4px;
  background-color: #252526;
  color: #d4d4d4;
  border: 1px solid #3c3c3c;
}

#memory-add-fields input#add-notes-input {
  flex: 1 1 auto;
}

#memory-add-fields input#add-velocity-input,
#memory-add-fields input#add-start-input,
#memory-add-fields input#add-cc-number-input,
#memory-add-fields input#add-cc-value-input,
#memory-add-fields input#add-pc-input {
  width: 60px;
}

#memory-add-fields input#add-duration-input {
  width: 90px;
}

#add-entry-btn {
  background-color: #444;
  border: 1px solid #000;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 10px;
  white-space: nowrap;
}

#add-entry-btn:hover {
  background-color: #555;
}

/* Styles for events in memory editor */
.event-row.note-on {
  background: linear-gradient(to right, #43a047, #388e3c);
  color: #fff;
}

.event-row.note-off {
  background: linear-gradient(to right, #e53935, #c62828);
  color: #fff;
}

.event-row.control-change {
  background: linear-gradient(to right, #1e88e5, #1565c0);
  color: #fff;
}

.event-row.program-change {
  background: linear-gradient(to right, #8e24aa, #6a1b9a);
  color: #fff;
}

/* Adjust input fields in the event-params cell to display side by side */
#memory-editor-table .event-params input,
#memory-editor-table .event-params select {
  display: inline-block;
  width: auto;
  margin-right: 5px;
  vertical-align: middle;
}

/* Adjust the Parameters cell to prevent wrapping */
#memory-editor-table .event-params {
  white-space: nowrap;
}

.event-note {
  font-family: 'Noto Music', monospace;
}
