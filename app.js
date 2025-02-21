const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const totalOctaves = 6;
const startOctave = 1;

const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const blackNotes = ['C#', 'D#', null, 'F#', 'G#', 'A#', null];

const noteColors = {
  C: '#FF0000',    // red
  D: '#FFA500',    // orange
  E: '#FFFF00',    // yellow
  F: '#008000',    // green
  G: '#0000FF',    // blue
  A: '#6109AB',    // violet
  B: '#FF00FF',    // magenta,
};

const shorthandColorMap = {
  R: '#FF0000',    // Red
  O: '#FFA500',    // Orange
  Y: '#FFFF00',    // Yellow
  G: '#008000',    // Green
  B: '#0000FF',    // Blue
  V: '#6109AB',    // Violet
  M: '#FF00FF',    // Magenta
};

const blackKeyAdjacency = {
  'C#': ['C', 'D'],
  'D#': ['D', 'E'],
  'F#': ['F', 'G'],
  'G#': ['G', 'A'],
  'A#': ['A', 'B'],
};

let allWhiteKeys = [];
let allBlackKeys = [];

for (let octave = startOctave; octave < startOctave + totalOctaves; octave++) {
  whiteNotes.forEach(note => {
    allWhiteKeys.push(note + octave);
  });
}

for (let octave = startOctave; octave < startOctave + totalOctaves; octave++) {
  blackNotes.forEach(note => {
    if (note !== null) {
      allBlackKeys.push(note + octave);
    } else {
      allBlackKeys.push(null);
    }
  });
}

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let pianoInstrument;

Soundfont.instrument(audioContext, 'acoustic_grand_piano', { soundfont: 'MusyngKite' }).then(piano => {
  pianoInstrument = piano;
});

let quill;
let activeNotes = {};
let pianoKeys = {};
let isRecording = false;
let isPlaying = false;
let recordedNotes = [];
let recordStartTime;
let playbackStartTime;
let playbackTimers = [];
let recordingTimers = [];
let memoryList = [];
let sequenceCounter = 1;
let selectedMemoryIndex = null;
let isLooping = false;
let navigationActiveNotes = {};
let activeFingerings = {};
let activeKeyAnnotations = {};
let navigationActiveKeyAnnotations = {};

let midiAccessObject = null;
let selectedMidiInput = null;

let keyboardEnabled = false; // Default keyboard note entry is off
let keyboardOctave = 4; // Default octave for keyboard input
const keyNoteMap = {
  'a': { note: 'C', octaveOffset: 0 },
  'w': { note: 'C#', octaveOffset: 0 },
  's': { note: 'D', octaveOffset: 0 },
  'e': { note: 'D#', octaveOffset: 0 },
  'd': { note: 'E', octaveOffset: 0 },
  'f': { note: 'F', octaveOffset: 0 },
  't': { note: 'F#', octaveOffset: 0 },
  'g': { note: 'G', octaveOffset: 0 },
  'y': { note: 'G#', octaveOffset: 0 },
  'h': { note: 'A', octaveOffset: 0 },
  'u': { note: 'A#', octaveOffset: 0 },
  'j': { note: 'B', octaveOffset: 0 },
  'k': { note: 'C', octaveOffset: 1 },
};

let colorfulNotesEnabled = false;

const tempoSlider = document.getElementById('tempo-slider');
const tempoValueDisplay = document.getElementById('tempo-value');
let tempoPercentage = parseInt(tempoSlider.value) || 100;

tempoSlider.addEventListener('input', () => {
  tempoPercentage = parseInt(tempoSlider.value);
  tempoValueDisplay.textContent = tempoPercentage + '%';
});

let noteChordEvents = [];
let currentNoteIndex = -1;

let selectedMidiChannels = ['Omni']; // Default selected channels

// Add global variables for filters
let eventTypeFilters = {
  'noteOn': true,
  'noteOff': true,
  'controlChange': true,
  'programChange': true,
};

let activeChannelFilters = new Set(['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16']);

function createPiano() {
  const piano = document.getElementById('piano');
  piano.innerHTML = '';

  allWhiteKeys.forEach((note, idx) => {
    const keyContainer = document.createElement('div');
    keyContainer.classList.add('key-container');

    const key = document.createElement('div');
    key.classList.add('key');
    key.dataset.note = note;
    keyContainer.appendChild(key);

    const blackKeyNote = blackNotes[idx % 7];
    if (blackKeyNote) {
      const blackKey = document.createElement('div');
      blackKey.classList.add('key', 'black');
      blackKey.dataset.note = blackKeyNote + (startOctave + Math.floor(idx / 7));
      keyContainer.appendChild(blackKey);
    }

    piano.appendChild(keyContainer);
  });

  pianoKeys = document.querySelectorAll('.key');
  pianoKeys.forEach(key => {
    key.addEventListener('mousedown', () => noteOn(key.dataset.note, 127, true));
    key.addEventListener('mouseup', () => noteOff(key.dataset.note, true));
    key.addEventListener('mouseleave', () => noteOff(key.dataset.note, true));

    key.addEventListener('touchstart', (e) => {
      e.preventDefault();
      noteOn(key.dataset.note, 127, true);
    });
    key.addEventListener('touchend', (e) => {
      e.preventDefault();
      noteOff(key.dataset.note, true);
    });
    key.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      noteOff(key.dataset.note, true);
    });
  });

  updateKeyLabels();
}

function updateKeyLabels() {
  pianoKeys.forEach(key => {
    const note = key.dataset.note;
    const octaveMatch = note.match(/([A-G]#?)(\d)/);
    if (!octaveMatch) return;
    const noteBase = octaveMatch[1];
    const noteOctave = parseInt(octaveMatch[2], 10);
    let keyShortcut = null;

    for (const keyChar in keyNoteMap) {
      const mapping = keyNoteMap[keyChar];
      const octaveOffset = mapping.octaveOffset || 0;
      const mappedOctave = keyboardOctave + octaveOffset;
      const mappedNote = mapping.note + mappedOctave;
      if (mappedNote === note) {
        keyShortcut = keyChar.toUpperCase();
        break;
      }
    }

    let label = key.querySelector('.key-label');
    if (keyShortcut && keyboardEnabled) {
      if (!label) {
        label = document.createElement('span');
        label.classList.add('key-label');
        key.appendChild(label);
      }
      label.textContent = keyShortcut;
      label.style.display = 'block';
      if (key.classList.contains('black')) {
        label.style.color = 'white';
      } else {
        label.style.color = 'black';
      }
    } else {
      if (label) {
        label.style.display = 'none';
      }
    }
  });
}

let currentNoteInputField = null;

function getPlayableNoteName(note) {
  if (note.includes('b')) {
    const flatToSharpMap = {
      'Ab': 'G#',
      'Bb': 'A#',
      'Cb': 'B',
      'Db': 'C#',
      'Eb': 'D#',
      'Fb': 'E',
      'Gb': 'F#',
    };
    const noteMatch = note.match(/^([A-G]b)(\d)$/);
    if (noteMatch) {
      const noteBase = noteMatch[1];
      let octave = parseInt(noteMatch[2], 10);
      if (noteBase === 'Cb') {
        octave -= 1;
      }
      const sharpNoteBase = flatToSharpMap[noteBase];
      if (sharpNoteBase) {
        return sharpNoteBase + octave;
      }
    }
  } else if (note.includes('#')) {
    const sharpToNaturalMap = {
      'E#': 'F',
      'B#': 'C',
    };
    const noteMatch = note.match(/^([A-G]#)(\d)$/);
    if (noteMatch) {
      const noteBase = noteMatch[1];
      let octave = parseInt(noteMatch[2], 10);
      if (noteBase === 'B#') {
        octave += 1;
      }
      const naturalNoteBase = sharpToNaturalMap[noteBase];
      if (naturalNoteBase) {
        return naturalNoteBase + octave;
      }
    }
  }
  return note;
}

function noteOn(note, velocity = 127, isUserInteraction = false, fingering = null, annotation = null) {
  if (currentNoteInputField) {
    currentNoteInputField.value = note;
    currentNoteInputField = null;
    return;
  }

  if (isUserInteraction) {
    const memoryEditorContainer = document.getElementById('memory-editor-container');
    if (memoryEditorContainer && memoryEditorContainer.style.display !== 'none') {
      const notesInput = document.getElementById('add-notes-input');
      if (notesInput) {
        let currentValue = notesInput.value.trim();
        if (currentValue === '') {
          notesInput.value = note;
        } else {
          notesInput.value = currentValue + ', ' + note;
        }
      }
    }
  }

  if (activeNotes[note]) return;
  if (!pianoInstrument) return;

  const gain = velocity / 127;
  const playableNote = getPlayableNoteName(note);
  const playedNote = pianoInstrument.play(playableNote, audioContext.currentTime, { gain });

  activeNotes[note] = playedNote;
  highlightKey(note, true);

  if (fingering && fingering !== 'N') {
    pianoKeys.forEach(key => {
      if (key.dataset.note === playableNote) {
        const fingeringDiv = document.createElement('div');
        fingeringDiv.classList.add('fingering');
        fingeringDiv.textContent = fingering;
        key.parentElement.appendChild(fingeringDiv);
        activeFingerings[note] = fingeringDiv;
      }
    });
  }

  if (annotation) {
    const bracketTextMatches = [...annotation.matchAll(/\[(.*?)\]/g)];
    for (let i = 0; i < bracketTextMatches.length; i++) {
      const bracketText = bracketTextMatches[i][1];
      const colorCodeMatch = bracketText.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i);
      const shorthandColorMatch = bracketText.match(/^#([ROYGBVM])$/i);

      if (colorCodeMatch) {
        const colorCode = '#' + colorCodeMatch[1];
        activeNoteColors[note] = colorCode;
        highlightKey(note, true);

        if (i + 1 < bracketTextMatches.length) {
          const displayText = bracketTextMatches[++i][1];
          pianoKeys.forEach(key => {
            if (key.dataset.note === playableNote) {
              const isBlackKey = key.classList.contains('black');
              const annotationDiv = document.createElement('div');
              annotationDiv.classList.add('key-annotation');
              annotationDiv.textContent = displayText;

              key.parentElement.style.position = 'relative';
              annotationDiv.style.position = 'absolute';

              annotationDiv.style.top = '160px';

              if (isBlackKey) {
                annotationDiv.style.left = '70%';
                annotationDiv.style.width = '60%';
              } else {
                annotationDiv.style.left = '0';
                annotationDiv.style.width = '100%';
              }

              annotationDiv.style.textAlign = 'center';
              annotationDiv.style.color = 'white';
              annotationDiv.style.fontSize = '12px';

              key.parentElement.appendChild(annotationDiv);
              activeKeyAnnotations[note] = activeKeyAnnotations[note] || [];
              activeKeyAnnotations[note].push(annotationDiv);
            }
          });
        }
        continue;
      } else if (shorthandColorMatch) {
        const shorthandCode = shorthandColorMatch[1].toUpperCase();
        const colorCode = shorthandColorMap[shorthandCode];
        if (colorCode) {
          activeNoteColors[note] = colorCode;
          highlightKey(note, true);

          if (i + 1 < bracketTextMatches.length) {
            const displayText = bracketTextMatches[++i][1];
            pianoKeys.forEach(key => {
              if (key.dataset.note === playableNote) {
                const isBlackKey = key.classList.contains('black');
                const annotationDiv = document.createElement('div');
                annotationDiv.classList.add('key-annotation');
                annotationDiv.textContent = displayText;

                key.parentElement.style.position = 'relative';
                annotationDiv.style.position = 'absolute';

                annotationDiv.style.top = '160px';

                if (isBlackKey) {
                  annotationDiv.style.left = '70%';
                  annotationDiv.style.width = '60%';
                } else {
                  annotationDiv.style.left = '0';
                  annotationDiv.style.width = '100%';
                }

                annotationDiv.style.textAlign = 'center';
                annotationDiv.style.color = 'white';
                annotationDiv.style.fontSize = '12px';

                key.parentElement.appendChild(annotationDiv);
                activeKeyAnnotations[note] = activeKeyAnnotations[note] || [];
                activeKeyAnnotations[note].push(annotationDiv);
              }
            });
          }
          continue;
        }
      }

      pianoKeys.forEach(key => {
        if (key.dataset.note === playableNote) {
          const isBlackKey = key.classList.contains('black');
          const annotationDiv = document.createElement('div');
          annotationDiv.classList.add('key-annotation');
          annotationDiv.textContent = bracketText;

          key.parentElement.style.position = 'relative';
          annotationDiv.style.position = 'absolute';

          annotationDiv.style.top = '160px';

          if (isBlackKey) {
            annotationDiv.style.left = '70%';
            annotationDiv.style.width = '60%';
          } else {
            annotationDiv.style.left = '0';
            annotationDiv.style.width = '100%';
          }

          annotationDiv.style.textAlign = 'center';
          annotationDiv.style.color = 'white';
          annotationDiv.style.fontSize = '12px';

          key.parentElement.appendChild(annotationDiv);
          activeKeyAnnotations[note] = activeKeyAnnotations[note] || [];
          activeKeyAnnotations[note].push(annotationDiv);
        }
      });
    }
  }

  if (isRecording && isUserInteraction) {
    recordedNotes.push({
      type: 'noteOn',
      note: note,
      velocity: velocity,
      time: audioContext.currentTime - recordStartTime,
      channel: selectedMidiChannels.includes('Omni') ? 'Omni' : selectedMidiChannels[0]
    });
  }
}

function noteOff(note, isUserInteraction = false) {
  if (!activeNotes[note]) return;

  activeNotes[note].stop();
  delete activeNotes[note];
  highlightKey(note, false);

  if (activeFingerings[note]) {
    activeFingerings[note].remove();
    delete activeFingerings[note];
  }

  if (activeKeyAnnotations[note]) {
    if (Array.isArray(activeKeyAnnotations[note])) {
      activeKeyAnnotations[note].forEach(annotationDiv => {
        annotationDiv.remove();
      });
    } else {
      activeKeyAnnotations[note].remove();
    }
    delete activeKeyAnnotations[note];
  }

  if (activeNoteColors[note]) {
    delete activeNoteColors[note];
  }

  if (isRecording && isUserInteraction) {
    recordedNotes.push({
      type: 'noteOff',
      note: note,
      time: audioContext.currentTime - recordStartTime,
      channel: selectedMidiChannels.includes('Omni') ? 'Omni' : selectedMidiChannels[0]
    });
  }
}

function highlightKey(note, isPressed) {
  const playableNote = getPlayableNoteName(note);
  pianoKeys.forEach(key => {
    if (key.dataset.note === playableNote) {
      if (isPressed) {
        let color = 'lightblue';
        if (colorfulNotesEnabled) {
          const baseNote = playableNote.replace(/[0-9]/g, '');
          if (baseNote.includes('#')) {
            const adjNotes = blackKeyAdjacency[baseNote];
            const color1 = noteColors[adjNotes[0]];
            const color2 = noteColors[adjNotes[1]];
            key.style.background = `linear-gradient(to top, ${color2} 50%, ${color1} 50%)`;
            return;
          } else {
            color = noteColors[baseNote];
          }
        }
        if (activeNoteColors[note]) {
          color = activeNoteColors[note];
        }
        key.style.background = color;
      } else {
        key.style.background = '';
      }
      key.classList.toggle('pressed', isPressed);
    }
  });
}

function initMIDI() {
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
  } else {
    console.warn('Web MIDI API not supported in this browser.');
    updateMIDIStatus('Web MIDI API not supported in this browser.', 'red');
  }
}

function onMIDISuccess(midiAccess) {
  midiAccessObject = midiAccess;
  midiAccessObject.addEventListener('statechange', updateMIDIPortStatus);

  updateDeviceList();
  initDeviceControls();

  if (midiAccessObject.inputs.size > 0) {
    updateMIDIStatus('MIDI controllers available.', 'green');
  } else {
    updateMIDIStatus('No MIDI controller connected.', 'orange');
  }
}

function onMIDIFailure(error) {
  console.error('Failed to get MIDI access:', error);
  updateMIDIStatus('MIDI initialization failed.', 'red');
}

function updateMIDIPortStatus(event) {
  if (event.port.type === 'input') {
    if (event.port.state === 'connected') {
      updateDeviceList();
      selectMidiDevice(event.port.id);
      updateMIDIStatus('MIDI controller connected.', 'green');
    } else if (event.port.state === 'disconnected') {
      if (selectedMidiInput && selectedMidiInput.id === event.port.id) {
        selectedMidiInput = null;
        document.getElementById('selected-device').textContent = 'No Device Selected';
      }
      updateDeviceList();
      updateMIDIStatus('MIDI controller disconnected.', 'orange');
    }
  }
}

function updateDeviceList() {
  const deviceList = document.getElementById('device-list');
  deviceList.innerHTML = '';

  midiAccessObject.inputs.forEach((input) => {
    const li = document.createElement('li');
    li.dataset.id = input.id;
    li.textContent = input.name;
    deviceList.appendChild(li);
  });

  if (!selectedMidiInput) {
    if (midiAccessObject.inputs.size > 0) {
      const firstInput = midiAccessObject.inputs.values().next().value;
      selectMidiDevice(firstInput.id);
    } else {
      selectedMidiInput = null;
      document.getElementById('selected-device').textContent = 'No Device Selected';
    }
  } else if (!midiAccessObject.inputs.has(selectedMidiInput.id)) {
    if (midiAccessObject.inputs.size > 0) {
      const firstInput = midiAccessObject.inputs.values().next().value;
      selectMidiDevice(firstInput.id);
    } else {
      selectedMidiInput = null;
      document.getElementById('selected-device').textContent = 'No Device Selected';
    }
  }
}

function selectMidiDevice(deviceId) {
  if (selectedMidiInput) {
    selectedMidiInput.onmidimessage = null;
  }

  selectedMidiInput = midiAccessObject.inputs.get(deviceId);

  if (selectedMidiInput) {
    selectedMidiInput.onmidimessage = handleMIDIMessage;
    document.getElementById('selected-device').textContent = selectedMidiInput.name;
  } else {
    document.getElementById('selected-device').textContent = 'No Device Selected';
  }
}

function initDeviceControls() {
  const deviceToggleBtn = document.getElementById('device-toggle-btn');
  const deviceListContainer = document.getElementById('device-list-container');
  const deviceList = document.getElementById('device-list');

  deviceToggleBtn.addEventListener('click', toggleDeviceList);

  deviceList.addEventListener('click', function(event) {
    if (event.target && event.target.nodeName === 'LI') {
      const deviceId = event.target.dataset.id;
      selectMidiDevice(deviceId);
      toggleDeviceList();
    }
  });
}

function toggleDeviceList() {
  const deviceListContainer = document.getElementById('device-list-container');
  if (deviceListContainer.style.display === 'none' || deviceListContainer.style.display === '') {
    deviceListContainer.style.display = 'block';
  } else {
    deviceListContainer.style.display = 'none';
  }
}

function handleMIDIMessage(event) {
  if (event.currentTarget !== selectedMidiInput) return;

  const [statusByte, noteNumber, velocity] = event.data;
  const command = statusByte & 0xF0;
  const channel = (statusByte & 0x0F) + 1;

  if (!selectedMidiChannels.includes('Omni') && !selectedMidiChannels.includes(channel.toString())) {
    return;
  }

  const note = midiNoteToName(noteNumber);
  if (note) {
    if (currentNoteInputField) {
      currentNoteInputField.value = note;
      currentNoteInputField = null;
      return;
    }

    if (command === 144 && velocity > 0) {
      noteOn(note, velocity, true);

    } else if (command === 128 || (command === 144 && velocity === 0)) {
      noteOff(note, true);
    }
  }
}

function updateMIDIStatus(message, color) {
  const midiStatus = document.getElementById('midi-status');
  if (midiStatus) {
    midiStatus.textContent = message;
    midiStatus.style.color = color;
  }
}

function midiNoteToName(noteNumber) {
  const noteIndex = noteNumber % 12;
  const octave = Math.floor(noteNumber / 12) - 1;

  const indexToNote = {
    0: 'C',
    1: 'C#',
    2: 'D',
    3: 'D#',
    4: 'E',
    5: 'F',
    6: 'F#',
    7: 'G',
    8: 'G#',
    9: 'A',
    10: 'A#',
    11: 'B',
  };

  let noteName = indexToNote[noteIndex];

  return noteName + octave;
}

function parseDurationInput(input) {
  const abbreviationMap = {
    'W': 4,
    'H': 2,
    'Q': 1,
    'E': 0.5,
    'S': 0.25,
    'T': 0.125
  };

  let totalDuration = 0;

  const parts = input.split('_');

  for (let part of parts) {
    let duration = 0;
    let originalPart = part; 
    let division = 1;

    if (part.includes('/')) {
      const divisionParts = part.split('/');
      part = divisionParts[0];
      division = parseFloat(divisionParts[1]);
      if (isNaN(division) || division <= 0) {
        alert(`Invalid division in duration: ${originalPart}`);
        return NaN;
      }
    }

    const match = part.match(/^([WHQEST])(\.?)$/);
    if (match) {
      let [, abbrev, dot] = match;
      duration = abbreviationMap[abbrev];
      if (dot) {
        duration += duration / 2; 
      }
    } else {
      duration = parseFloat(part);
      if (isNaN(duration)) {
        alert(`Invalid duration part: ${originalPart}`);
        return NaN;
      }
    }

    duration = duration / division;

    totalDuration += duration;
  }

  return totalDuration;
}

function addEntryToMemory() {
  if (selectedMemoryIndex === null) return;

  const memoryEditorContainer = document.getElementById('memory-editor-container');
  const selectedSequence = memoryList[selectedMemoryIndex];
  const events = selectedSequence.notes;

  const addNotesInput = memoryEditorContainer.querySelector('#add-notes-input');
  const addVelocityInput = memoryEditorContainer.querySelector('#add-velocity-input');
  const addStartInput = memoryEditorContainer.querySelector('#add-start-input');
  const addDurationInput = memoryEditorContainer.querySelector('#add-duration-input');
  const addCCNumberInput = memoryEditorContainer.querySelector('#add-cc-number-input');
  const addCCValueInput = memoryEditorContainer.querySelector('#add-cc-value-input');
  const addPCInput = memoryEditorContainer.querySelector('#add-pc-input');
  const addChannelSelect = memoryEditorContainer.querySelector('#add-channel-select');

  const notesInputValue = addNotesInput.value.trim();
  const velocity = parseInt(addVelocityInput.value) || 100;
  let startTime = parseFloat(addStartInput.value);
  let durationInputValue = addDurationInput.value.trim();
  const selectedChannel = addChannelSelect.value || 'Omni';
  const ccNumber = parseInt(addCCNumberInput.value);
  const ccValue = parseInt(addCCValueInput.value);
  const programNumber = parseInt(addPCInput.value);

  if (isNaN(startTime)) {
    if (events.length > 0) {
      startTime = events[events.length - 1].time;
    } else {
      startTime = 0;
    }
  }

  if (durationInputValue === '' && notesInputValue) {
    durationInputValue = 'Q';
  }

  let duration = parseDurationInput(durationInputValue);
  if (isNaN(duration)) {
    alert('Invalid duration format.');
    return;
  }

  if (notesInputValue) {
    const noteNames = notesInputValue.split(',').map(n => n.trim());

    if (selectedChannel === 'Split') {
      let currentChannel = 1;
      noteNames.forEach(note => {
        const channel = currentChannel.toString();
        const noteOnEvent = {
          time: startTime,
          type: 'noteOn',
          note: note,
          velocity: velocity,
          channel: channel,
        };
        const noteOffEvent = {
          time: startTime + duration,
          type: 'noteOff',
          note: note,
          channel: channel,
        };
        events.push(noteOnEvent);
        events.push(noteOffEvent);

        currentChannel++;
        if (currentChannel > 16) {
          currentChannel = 1;
        }
      });
    } else {
      noteNames.forEach(note => {
        const noteOnEvent = {
          time: startTime,
          type: 'noteOn',
          note: note,
          velocity: velocity,
          channel: selectedChannel,
        };
        const noteOffEvent = {
          time: startTime + duration,
          type: 'noteOff',
          note: note,
          channel: selectedChannel,
        };
        events.push(noteOnEvent);
        events.push(noteOffEvent);
      });
    }
  } else if (!isNaN(ccNumber) && !isNaN(ccValue)) {
    const ccEvent = {
      time: startTime,
      type: 'controlChange',
      controllerNumber: ccNumber,
      controllerValue: ccValue,
      channel: selectedChannel,
    };
    events.push(ccEvent);
  } else if (!isNaN(programNumber)) {
    const pcEvent = {
      time: startTime,
      type: 'programChange',
      programNumber: programNumber,
      channel: selectedChannel,
    };
    events.push(pcEvent);
  } else {
    alert('Please enter valid note(s), or CC/PC values.');
    return;
  }

  events.sort((a, b) => a.time - b.time);

  populateMemoryEditor();
}

function initSequencerControls() {
  const recordBtn = document.getElementById('record-btn');
  const playBtn = document.getElementById('play-btn');
  const stopBtn = document.getElementById('stop-btn');
  const saveBtn = document.getElementById('save-btn');
  const loadBtn = document.getElementById('load-btn');
  const clearBtn = document.getElementById('clear-btn');

  recordBtn.addEventListener('click', startRecording);
  playBtn.addEventListener('click', startPlayback);
  stopBtn.addEventListener('click', stopAction);
  saveBtn.addEventListener('click', saveMemoryList);
  loadBtn.addEventListener('click', loadMemoryList);
  clearBtn.addEventListener('click', clearApp);

  initMemoryControls();

  const prevNoteBtn = document.getElementById('prev-note-btn');
  const nextNoteBtn = document.getElementById('next-note-btn');

  prevNoteBtn.addEventListener('click', goToPreviousNoteOrChord);
  nextNoteBtn.addEventListener('click', goToNextNoteOrChord);

  const transposeDownBtn = document.getElementById('transpose-down-btn');
  const transposeUpBtn = document.getElementById('transpose-up-btn');

  transposeDownBtn.addEventListener('click', transposeSelectedMemoryDown);
  transposeUpBtn.addEventListener('click', transposeSelectedMemoryUp);

  const resetMidiBtn = document.getElementById('reset-midi-btn');
  resetMidiBtn.addEventListener('click', resetMidiAndFingerings);
}

function saveMemoryList() {
  const dataStr = JSON.stringify(memoryList);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const a = document.createElement('a');
  a.href = url;
  let filename = 'memory_list.json';
  if (memoryList.length > 0) {
    filename = memoryList[0].name + '.json';
  }
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadMemoryList() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data)) {
          memoryList = data;
          updateMemoryList();
          if (memoryList.length > 0) {
            selectMemorySequence(0);
          } else {
            selectedMemoryIndex = null;
            document.getElementById('selected-memory').textContent = 'No Memory Selected';
            quill.setContents([]);
          }
        } else {
          alert('Invalid file format.');
        }
      } catch (error) {
        alert('Error reading file: ' + error);
      }
    };
    reader.readAsText(file);
  });

  input.click();
}

let transposeAmount = 0;

function startRecording() {
  if (isRecording) return;
  isRecording = true;
  recordedNotes = [];
  recordStartTime = audioContext.currentTime;
  const recordBtn = document.getElementById('record-btn');
  recordBtn.classList.add('pressed');
  document.getElementById('play-btn').disabled = true;
  document.getElementById('save-btn').disabled = true;
  document.getElementById('stop-btn').disabled = false;

  if (selectedMemoryIndex !== null) {
    const sequence = memoryList[selectedMemoryIndex];
    const otherChannelNotes = sequence.notes.filter(noteEvent => !selectedMidiChannels.includes(noteEvent.channel));

    playNotesDuringRecording(otherChannelNotes);
  }
}

function playNotesDuringRecording(events) {
  if (!isRecording) return;

  let eventIndex = 0;
  const scheduleNextEvent = () => {
    if (!isRecording || eventIndex >= events.length) {
      return;
    }

    const noteEvent = events[eventIndex];
    const timeUntilEvent = noteEvent.time - (audioContext.currentTime - recordStartTime);

    const timerId = setTimeout(() => {
      if (isRecording) {
        if (noteEvent.type === 'noteOn') {
          noteOn(noteEvent.note, noteEvent.velocity);
        } else if (noteEvent.type === 'noteOff') {
          noteOff(noteEvent.note);
        }
        recordedNotes.push({
          type: noteEvent.type,
          note: noteEvent.note,
          velocity: noteEvent.velocity !== undefined ? noteEvent.velocity : 100,
          time: audioContext.currentTime - recordStartTime,
          channel: noteEvent.channel
        });
      }
      eventIndex++;
      scheduleNextEvent();
    }, Math.max(0, timeUntilEvent * 1000));

    recordingTimers.push(timerId);
  };

  scheduleNextEvent();
}

function stopAction() {
  if (isRecording) {
    isRecording = false;
    const recordBtn = document.getElementById('record-btn');
    recordBtn.classList.remove('pressed');
    document.getElementById('play-btn').disabled = false;
    document.getElementById('save-btn').disabled = false;
    recordingTimers.forEach(timerId => clearTimeout(timerId));
    recordingTimers = [];

    for (const note in activeNotes) {
      if (activeNotes.hasOwnProperty(note)) {
        recordedNotes.push({
          type: 'noteOff',
          note: note,
          time: audioContext.currentTime - recordStartTime,
          channel: selectedMidiChannels.includes('Omni') ? 'Omni' : selectedMidiChannels[0]
        });
      }
    }

    if (selectedMemoryIndex !== null) {
      const sequence = memoryList[selectedMemoryIndex];

      sequence.notes = sequence.notes.filter(noteEvent => !selectedMidiChannels.includes(noteEvent.channel));

      sequence.notes = sequence.notes.concat(recordedNotes);

      let totalDuration = 0;
      sequence.notes.forEach(noteEvent => {
        if (noteEvent.time > totalDuration) {
          totalDuration = noteEvent.time;
        }
      });
      sequence.duration = totalDuration;

      recordedNotes = JSON.parse(JSON.stringify(sequence.notes));

      processSequenceNotes(sequence);
      updateMemoryList();
      currentNoteIndex = -1;
    }
  }
  if (isPlaying) {
    isPlaying = false;
    playbackTimers.forEach(timerId => clearTimeout(timerId));
    playbackTimers = [];
    document.getElementById('stop-btn').disabled = true;
    document.getElementById('play-btn').disabled = false;
  }
  stopNavigationActiveNotes();
  clearActiveNotes();

  for (const note in activeFingerings) {
    if (activeFingerings.hasOwnProperty(note)) {
      activeFingerings[note].remove();
    }
  }
  activeFingerings = {};

  const activeAnnotations = {};
  const annotationDisplay = document.getElementById('annotation-display');
  annotationDisplay.textContent = '';
  annotationDisplay.style.display = 'none';
}

function initMemoryControls() {
  const addToMemoryBtn = document.getElementById('add-memory-btn');
  const removeFromMemoryBtn = document.getElementById('remove-memory-btn');
  const addEditorContentBtn = document.getElementById('add-editor-content-btn');
  const memoryToggleBtn = document.getElementById('memory-toggle-btn');

  addToMemoryBtn.addEventListener('click', addToMemory);
  removeFromMemoryBtn.addEventListener('click', removeFromMemory);
  addEditorContentBtn.addEventListener('click', addEditorContentToMemory);
  memoryToggleBtn.addEventListener('click', toggleMemoryList);
}

function toggleMemoryList() {
  const memoryListContainer = document.getElementById('memory-list-container');
  if (memoryListContainer.style.display === 'none' || memoryListContainer.style.display === '') {
    memoryListContainer.style.display = 'block';
  } else {
    memoryListContainer.style.display = 'none';
    rearrangeMemories();
  }
}

function updateMemoryList() {
  const memoryListContainer = document.getElementById('memory-list');
  memoryListContainer.innerHTML = '';
  memoryList.forEach((sequence, index) => {
    const li = document.createElement('li');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.index = index;
    checkbox.checked = sequence.selected || false;
    checkbox.addEventListener('change', function(e) {
      e.stopPropagation();
      memoryList[index].selected = e.target.checked;
    });

    const label = document.createElement('span');
    label.textContent = sequence.name;

    const rankInput = document.createElement('input');
    rankInput.type = 'number';
    rankInput.value = sequence.rank || '';
    rankInput.min = 1;
    rankInput.style.width = '40px';
    rankInput.addEventListener('change', function(e) {
      sequence.rank = parseInt(rankInput.value, 10) || memoryList.length;
    });

    li.appendChild(checkbox);
    li.appendChild(label);
    li.appendChild(rankInput);

    li.addEventListener('click', function(e) {
      if (e.target.nodeName !== 'INPUT' && e.target.nodeName !== 'INPUT') {
        selectMemorySequence(index);
        toggleMemoryList();
      }
    });

    memoryListContainer.appendChild(li);
  });
  document.getElementById('play-btn').disabled = memoryList.length === 0;
  document.getElementById('save-btn').disabled = memoryList.length === 0;
  updateChannelButtonStyles();
}

function selectMemorySequence(index) {
  if (index >= 0 && index < memoryList.length) {
    selectedMemoryIndex = index;
    const selectedSequence = memoryList[index];
    recordedNotes = JSON.parse(JSON.stringify(selectedSequence.notes));
    quill.setContents(selectedSequence.editorContent || []);
    document.getElementById('play-btn').disabled = false;
    document.getElementById('selected-memory').textContent = selectedSequence.name;
    processSequenceNotes(selectedSequence);
    currentNoteIndex = -1;
    updateEditorAssociationButton();

    transposeAmount = 0;
    document.getElementById('transpose-amount').textContent = transposeAmount;
  }
}

function addToMemory() {
  let sequenceName = `Sequence ${sequenceCounter}`;
  let quantizedNotes = JSON.parse(JSON.stringify(recordedNotes));

  if (quantizedNotes.length > 0) {
    const firstNoteTime = quantizedNotes[0].time;
    quantizedNotes.forEach(noteEvent => {
      noteEvent.time -= firstNoteTime;
    });
  }

  let totalDuration = 0;
  quantizedNotes.forEach(noteEvent => {
    if (noteEvent.time > totalDuration) {
      totalDuration = noteEvent.time;
    }
  });

  quantizedNotes = quantizedNotes.filter(noteEvent => noteEvent.time <= totalDuration);

  const sequenceData = {
    name: sequenceName,
    notes: quantizedNotes,
    editorContent: quill.getContents(),
    selected: false,
    duration: totalDuration,
    tempo: 100,
    rank: memoryList.length + 1 // Added rank property
  };
  memoryList.push(sequenceData);
  sequenceCounter++;

  selectMemorySequence(memoryList.length - 1);
  updateMemoryList();
  document.getElementById('play-btn').disabled = false;
  updateChannelButtonStyles();
}

function removeFromMemory() {
  if (selectedMemoryIndex === null) {
    return;
  }

  memoryList.splice(selectedMemoryIndex, 1);

  selectedMemoryIndex = null;
  recordedNotes = [];
  quill.setContents([]);
  document.getElementById('selected-memory').textContent = 'No Memory Selected';

  updateMemoryList();
  updateChannelButtonStyles();

  document.getElementById('play-btn').disabled = memoryList.length === 0;
}

function addEditorContentToMemory() {
  const selectedMemoryName = document.getElementById('selected-memory').textContent;
  const index = memoryList.findIndex(sequence => sequence.name === selectedMemoryName);
  if (index >= 0) {
    const selectedSequence = memoryList[index];
    selectedSequence.editorContent = quill.getContents();
    updateEditorAssociationButton();
  }
}

function stopPlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  playbackTimers.forEach(timerId => clearTimeout(timerId));
  playbackTimers = [];
  document.getElementById('stop-btn').disabled = true;
  document.getElementById('play-btn').disabled = false;
}

function resetMidiAndFingerings() {
  clearActiveNotes();
  stopNavigationActiveNotes();
}

function populateMemoryEditor() {
  const memoryEditorContainer = document.getElementById('memory-editor-container');
  let selectedEventIndices = [];
  let selectedChannelFilter = 'All';

  if (selectedMemoryIndex === null) {
    memoryEditorContainer.innerHTML = '<p>No memory selected.</p>';
    return;
  }

  const selectedSequence = memoryList[selectedMemoryIndex];
  const events = selectedSequence.notes;

  let html = `
  <div id="memory-editor-name">
    <label for="memory-name-input">Memory Name:</label>
    <input type="text" id="memory-name-input" value="${selectedSequence.name}">
  </div>
  <div id="memory-editor-controls">
    <div id="memory-add-controls">
      <div class="group-label"><span>Events</span></div>
      <div id="memory-add-fields">
        <input type="text" id="add-notes-input" placeholder="Notes">
        <input type="number" id="add-velocity-input" value="100" placeholder="Velocity" min="1" max="127">
        <input type="text" id="add-start-input" placeholder="Start">
        <input type="text" id="add-duration-input" placeholder="Duration">
        <select id="add-channel-select">
          <option value="Omni">Omni</option>
          <option value="Split">Split</option>
          ${[...Array(16)].map((_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
        </select>
        <input type="number" id="add-cc-number-input" placeholder="CC#" min="0" max="127">
        <input type="number" id="add-cc-value-input" placeholder="CCV" min="0" max="127">
        <input type="number" id="add-pc-input" placeholder="PC">
      </div>
      <button id="add-entry-btn">Add</button>
      <div id="event-filters">
        <div class="filter-group">
          <div class="group-label"><span>Hide</span></div>
          <div id="event-type-filters" class="group-buttons">
            <button id="filter-note-on-btn" class="filter-button">On</button>
            <button id="filter-note-off-btn" class="filter-button">Off</button>
            <button id="filter-cc-btn" class="filter-button">CC</button>
            <button id="filter-pc-btn" class="filter-button">PC</button>
          </div>
        </div>
        <div class="separator"></div>
        <div class="filter-group">
          <div class="group-label"><span>Show</span></div>
          <div id="channel-filters" class="group-buttons">
            <button class="channel-filter-button" data-channel="All">All</button>
            ${[...Array(16)].map((_, i) => `<button class="channel-filter-button" data-channel="${i + 1}">${i + 1}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>
  <table id="memory-editor-table">
    <tr><th>Time (s)</th><th>Type</th><th>Parameters</th><th>Action</th></tr>`;

  events.forEach((event, index) => {
    if (!eventTypeFilters[event.type]) return;
    if (selectedChannelFilter !== 'All' && event.channel !== selectedChannelFilter) return;

    let paramsHtml = '';
    if (event.type === 'noteOn' || event.type === 'noteOff') {
      paramsHtml = `
        <input type="text" class="event-note" value="${formatNoteForDisplay(event.note)}">
        <select class="event-channel">
          <option value="Omni"${event.channel === 'Omni' ? ' selected' : ''}>Omni</option>
          ${[...Array(16)].map((_, i) => `<option value="${i + 1}"${event.channel === (i + 1).toString() ? ' selected' : ''}>${i + 1}</option>`).join('')}
        </select>`;
      if (event.type === 'noteOn') {
        paramsHtml += `
          <input type="number" class="event-velocity" value="${event.velocity}" min="1" max="127" placeholder="Velocity">
          <select class="event-fingering">
            <option value="N"${event.fingering === 'N' ? ' selected' : ''}>N</option>
            <option value="1"${event.fingering === '1' ? ' selected' : ''}>1</option>
            <option value="2"${event.fingering === '2' ? ' selected' : ''}>2</option>
            <option value="3"${event.fingering === '3' ? ' selected' : ''}>3</option>
            <option value="4"${event.fingering === '4' ? ' selected' : ''}>4</option>
            <option value="5"${event.fingering === '5' ? ' selected' : ''}>5</option>
          </select>`;
      }
    } else if (event.type === 'controlChange') {
      paramsHtml = `
        <input type="number" class="event-controller-number" value="${event.controllerNumber}" min="0" max="127">
        <input type="number" class="event-controller-value" value="${event.controllerValue}" min="0" max="127">
        <select class="event-channel">
          <option value="Omni"${event.channel === 'Omni' ? ' selected' : ''}>Omni</option>
          ${[...Array(16)].map((_, i) => `<option value="${i + 1}"${event.channel === (i + 1).toString() ? ' selected' : ''}>${i + 1}</option>`).join('')}
        </select>`;
    } else if (event.type === 'programChange') {
      paramsHtml = `
        <input type="number" class="event-program-number" value="${event.programNumber}" min="0" max="127">
        <select class="event-channel">
          <option value="Omni"${event.channel === 'Omni' ? ' selected' : ''}>Omni</option>
          ${[...Array(16)].map((_, i) => `<option value="${i + 1}"${event.channel === (i + 1).toString() ? ' selected' : ''}>${i + 1}</option>`).join('')}
        </select>`;
    }

    html += `<tr class="event-row ${event.type === 'noteOn' ? 'note-on' :
                                       event.type === 'noteOff' ? 'note-off' :
                                       event.type === 'controlChange' ? 'control-change' :
                                       event.type === 'programChange' ? 'program-change' : ''}"
                   data-index="${index}"
                   data-event-type="${event.type}"
                   data-channel="${event.channel || 'Omni'}">
                 <td><input type="number" step="0.001" class="event-time" value="${event.time.toFixed(3)}"></td>
                 <td>
                   <select class="event-type">
                     <option value="noteOn"${event.type === 'noteOn' ? ' selected' : ''}>noteOn</option>
                     <option value="noteOff"${event.type === 'noteOff' ? ' selected' : ''}>noteOff</option>
                     <option value="controlChange"${event.type === 'controlChange' ? ' selected' : ''}>controlChange</option>
                     <option value="programChange"${event.type === 'programChange' ? ' selected' : ''}>programChange</option>
                   </select>
                 </td>
                 <td class="event-params">
                   ${paramsHtml}
                 </td>
                 <td class="action-cell">
                   <button class="annotation-toggle-btn">+</button>
                   <button class="delete-entry-btn">X</button>
                   <div class="touch-zone"></div>
                 </td>
               </tr>`;

    if (event.type === 'noteOn') {
      html += `<tr class="annotation-row" data-index="${index}" style="display: none;">
                 <td colspan="4">
                   <textarea class="event-annotation" placeholder="Annotation">${event.annotation || ''}</textarea>
                 </td>
               </tr>`;
    }
  });

  html += `</table>`;

  memoryEditorContainer.innerHTML = html;

  // Add event listeners
  const deleteButtons = memoryEditorContainer.querySelectorAll('.delete-entry-btn');
  deleteButtons.forEach((button) => {
    button.addEventListener('click', function () {
      const row = this.closest('tr');
      const eventIndex = parseInt(row.dataset.index, 10);
      events.splice(eventIndex, 1);
      populateMemoryEditor();
    });
  });

  const annotationToggleButtons = memoryEditorContainer.querySelectorAll('.annotation-toggle-btn');
  annotationToggleButtons.forEach((button) => {
    button.addEventListener('click', function () {
      const row = this.closest('tr');
      const eventIndex = parseInt(row.dataset.index, 10);
      const annotationRow = memoryEditorContainer.querySelector(`.annotation-row[data-index="${eventIndex}"]`);
      if (annotationRow) {
        annotationRow.style.display = annotationRow.style.display === 'none' ? 'table-row' : 'none';
      }
    });
  });

  const touchZones = memoryEditorContainer.querySelectorAll('.touch-zone');
  touchZones.forEach(touchZone => {
    touchZone.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent event from bubbling up
      const row = this.closest('tr');
      const eventIndex = parseInt(row.dataset.index, 10);
      if (selectedEventIndices.includes(eventIndex)) {
        selectedEventIndices = selectedEventIndices.filter(index => index !== eventIndex);
        row.classList.remove('selected');
      } else {
        selectedEventIndices.push(eventIndex);
        row.classList.add('selected');
      }
    });
  });

  const addEntryBtn = document.getElementById('add-entry-btn');
  addEntryBtn.addEventListener('click', addEntryToMemory);

  const memoryNameInput = document.getElementById('memory-name-input');
  memoryNameInput.addEventListener('change', updateMemoryFromEditor);

  const eventTypeSelects = memoryEditorContainer.querySelectorAll('.event-type');
  eventTypeSelects.forEach(select => {
    select.addEventListener('change', function() {
      const row = this.closest('tr');
      const eventIndex = parseInt(row.dataset.index, 10);
      const newType = this.value;

      if (selectedEventIndices.includes(eventIndex)) {
        selectedEventIndices.forEach(idx => {
          events[idx].type = newType;

          if (idx !== eventIndex) {
            const otherRow = memoryEditorContainer.querySelector(`.event-row[data-index="${idx}"]`);
            if (otherRow) {
              const typeSelect = otherRow.querySelector('.event-type');
              if (typeSelect) {
                typeSelect.value = newType;
              }
            }
          }
        });
      } else {
        events[eventIndex].type = newType;
      }

      updateMemoryFromEditor();
    });
  });

  const eventTimeInputs = memoryEditorContainer.querySelectorAll('.event-time');
  eventTimeInputs.forEach(input => {
    input.addEventListener('change', function() {
      const row = this.closest('tr');
      const eventIndex = parseInt(row.dataset.index, 10);
      const newTime = parseFloat(this.value);

      if (selectedEventIndices.includes(eventIndex)) {
        selectedEventIndices.forEach(idx => {
          events[idx].time = newTime;

          if (idx !== eventIndex) {
            const otherRow = memoryEditorContainer.querySelector(`.event-row[data-index="${idx}"]`);
            if (otherRow) {
              const timeInput = otherRow.querySelector('.event-time');
              if (timeInput) {
                timeInput.value = newTime;
              }
            }
          }
        });
      } else {
        events[eventIndex].time = newTime;
      }

      updateMemoryFromEditor();
    });
  });

  const eventParamInputs = memoryEditorContainer.querySelectorAll('.event-params input, .event-params select');
  eventParamInputs.forEach(input => {
    input.addEventListener('change', function() {
      const row = this.closest('tr');
      const eventIndex = parseInt(row.dataset.index, 10);
      const inputClass = this.classList[0]; // e.g., 'event-note', 'event-velocity', etc.
      let newValue = this.value;

      if (selectedEventIndices.includes(eventIndex)) {
        selectedEventIndices.forEach(idx => {
          const event = events[idx];
          switch (inputClass) {
            case 'event-note':
              event.note = normalizeNoteFromInput(newValue);
              break;
            case 'event-velocity':
              event.velocity = parseInt(newValue, 10);
              break;
            case 'event-channel':
              event.channel = newValue;
              break;
            case 'event-controller-number':
              event.controllerNumber = parseInt(newValue, 10);
              break;
            case 'event-controller-value':
              event.controllerValue = parseInt(newValue, 10);
              break;
            case 'event-program-number':
              event.programNumber = parseInt(newValue, 10);
              break;
            case 'event-fingering':
              event.fingering = newValue;
              break;
            default:
              break;
          }

          if (idx !== eventIndex) {
            const otherRow = memoryEditorContainer.querySelector(`.event-row[data-index="${idx}"]`);
            if (otherRow) {
              const otherInput = otherRow.querySelector(`.${inputClass}`);
              if (otherInput) {
                otherInput.value = newValue;
              }
            }
          }
        });
      } else {
        const event = events[eventIndex];
        switch (inputClass) {
          case 'event-note':
            event.note = normalizeNoteFromInput(newValue);
            break;
          case 'event-velocity':
            event.velocity = parseInt(newValue, 10);
            break;
          case 'event-channel':
            event.channel = newValue;
            break;
          case 'event-controller-number':
            event.controllerNumber = parseInt(newValue, 10);
            break;
          case 'event-controller-value':
            event.controllerValue = parseInt(newValue, 10);
            break;
          case 'event-program-number':
            event.programNumber = parseInt(newValue, 10);
            break;
          case 'event-fingering':
            event.fingering = newValue;
            break;
          default:
            break;
        }
      }

      updateMemoryFromEditor();
    });
  });

  const annotationTextareas = memoryEditorContainer.querySelectorAll('.event-annotation');
  annotationTextareas.forEach(textarea => {
    textarea.addEventListener('change', function() {
      const row = this.closest('tr');
      const eventIndex = parseInt(row.dataset.index, 10);
      const newValue = this.value;

      if (selectedEventIndices.includes(eventIndex)) {
        selectedEventIndices.forEach(idx => {
          events[idx].annotation = newValue;

          if (idx !== eventIndex) {
            const annotationRow = memoryEditorContainer.querySelector(`.annotation-row[data-index="${idx}"]`);
            if (annotationRow) {
              const otherTextarea = annotationRow.querySelector('.event-annotation');
              if (otherTextarea) {
                otherTextarea.value = newValue;
              }
            }
          }
        });
      } else {
        events[eventIndex].annotation = newValue;
      }

      updateMemoryFromEditor();
    });
  });

  const filterNoteOnBtn = document.getElementById('filter-note-on-btn');
  const filterNoteOffBtn = document.getElementById('filter-note-off-btn');
  const filterCCBtn = document.getElementById('filter-cc-btn');
  const filterPCBtn = document.getElementById('filter-pc-btn');

  filterNoteOnBtn.addEventListener('click', function() {
    eventTypeFilters['noteOn'] = !eventTypeFilters['noteOn'];
    this.classList.toggle('pressed', !eventTypeFilters['noteOn']);
    populateMemoryEditor();
  });

  filterNoteOffBtn.addEventListener('click', function() {
    eventTypeFilters['noteOff'] = !eventTypeFilters['noteOff'];
    this.classList.toggle('pressed', !eventTypeFilters['noteOff']);
    populateMemoryEditor();
  });

  filterCCBtn.addEventListener('click', function() {
    eventTypeFilters['controlChange'] = !eventTypeFilters['controlChange'];
    this.classList.toggle('pressed', !eventTypeFilters['controlChange']);
    populateMemoryEditor();
  });

  filterPCBtn.addEventListener('click', function() {
    eventTypeFilters['programChange'] = !eventTypeFilters['programChange'];
    this.classList.toggle('pressed', !eventTypeFilters['programChange']);
    populateMemoryEditor();
  });

  const channelFilterButtons = memoryEditorContainer.querySelectorAll('.channel-filter-button');
  channelFilterButtons.forEach(button => {
    button.addEventListener('click', function() {
      selectedChannelFilter = this.dataset.channel;
      channelFilterButtons.forEach(btn => btn.classList.remove('pressed'));
      this.classList.add('pressed');
      populateMemoryEditor();
    });
  });
}

function selectMemoryByName(name) {
  const index = memoryList.findIndex(sequence => sequence.name === name);
  if (index >= 0) {
    selectMemorySequence(index);
  }
}

function normalizeNoteName(noteName) {
  return noteName;
}

function formatNoteForDisplay(note) {
  return note.replace(/#/g, '\u266F').replace(/b/g, '\u266D');
}

function normalizeNoteFromInput(note) {
  return note.replace(/\u266F/g, '#').replace(/\u266D/g, 'b');
}

function updateMemoryFromEditor() {
  if (selectedMemoryIndex === null) return;

  const selectedSequence = memoryList[selectedMemoryIndex];

  const memoryNameInput = document.getElementById('memory-name-input');
  if (memoryNameInput) {
    selectedSequence.name = memoryNameInput.value;

    const memoryListItems = document.querySelectorAll('#memory-list li');
    memoryListItems.forEach((li) => {
      const index = parseInt(li.dataset.index, 10);
      if (index === selectedMemoryIndex) {
        const label = li.querySelector('span');
        label.textContent = selectedSequence.name;
      }
    });
  }

  const events = [];
  const eventRows = document.querySelectorAll('#memory-editor-table .event-row');
  eventRows.forEach((row) => {
    const eventIndex = parseInt(row.dataset.index, 10);
    const timeInput = row.querySelector('.event-time');
    const eventTypeSelect = row.querySelector('.event-type');
    const eventParamsCell = row.querySelector('.event-params');

    if (!timeInput || !eventTypeSelect || !eventParamsCell) return;

    const event = {
      time: parseFloat(timeInput.value),
      type: eventTypeSelect.value
    };

    if (event.type === 'noteOn' || event.type === 'noteOff') {
      const noteInput = eventParamsCell.querySelector('.event-note');
      const channelSelect = eventParamsCell.querySelector('.event-channel');
      if (noteInput && channelSelect) {
        event.note = normalizeNoteFromInput(noteInput.value);
        event.channel = channelSelect.value;
      }

      if (event.type === 'noteOn') {
        const velocityInput = eventParamsCell.querySelector('.event-velocity');
        const fingeringSelect = eventParamsCell.querySelector('.event-fingering');

        if (velocityInput && fingeringSelect) {
          event.velocity = parseInt(velocityInput.value, 10);
          event.fingering = fingeringSelect.value;
        }

        const annotationRow = document.querySelector(`.annotation-row[data-index="${eventIndex}"]`);
        if (annotationRow) {
          const annotationTextarea = annotationRow.querySelector('.event-annotation');
          event.annotation = annotationTextarea.value;
        }
      }
    } else if (event.type === 'controlChange') {
      const controllerNumberInput = eventParamsCell.querySelector('.event-controller-number');
      const controllerValueInput = eventParamsCell.querySelector('.event-controller-value');
      const channelSelect = eventParamsCell.querySelector('.event-channel');
      if (controllerNumberInput && controllerValueInput && channelSelect) {
        event.controllerNumber = parseInt(controllerNumberInput.value, 10);
        event.controllerValue = parseInt(controllerValueInput.value, 10);
        event.channel = channelSelect.value;
      }
    } else if (event.type === 'programChange') {
      const programNumberInput = eventParamsCell.querySelector('.event-program-number');
      const channelSelect = eventParamsCell.querySelector('.event-channel');
      if (programNumberInput && channelSelect) {
        event.programNumber = parseInt(programNumberInput.value, 10);
        event.channel = channelSelect.value;
      }
    }

    events.push(event);
  });

  selectedSequence.notes = events;
  let totalDuration = 0;
  selectedSequence.notes.forEach((noteEvent) => {
    if (noteEvent.time > totalDuration) {
      totalDuration = noteEvent.time;
    }
  });
  selectedSequence.duration = totalDuration;

  updateMemoryList();
  selectMemorySequence(selectedMemoryIndex);
}

function transposeSelectedMemoryDown() {
  transposeSelectedMemory(-1);
}

function transposeSelectedMemoryUp() {
  transposeSelectedMemory(1);
}

function transposeSelectedMemory(semitones) {
  if (selectedMemoryIndex === null) return;

  const sequence = memoryList[selectedMemoryIndex];
  sequence.notes.forEach(event => {
    if (event.type === 'noteOn' || event.type === 'noteOff') {
      event.note = transposeNote(event.note, semitones);
    }
  });

  transposeAmount += semitones;
  document.getElementById('transpose-amount').textContent = transposeAmount;

  processSequenceNotes(sequence);
  recordedNotes = JSON.parse(JSON.stringify(sequence.notes));
  currentNoteIndex = -1;

  if (memoryEditorVisible) {
    populateMemoryEditor();
  }
}

function transposeNote(note, semitones) {
  const match = note.match(/^([A-G]#?)(\d+)$/);
  if (!match) return note;

  let noteName = match[1];
  let octave = parseInt(match[2], 10);

  const noteIndexMap = {
    'C': 0,
    'C#': 1,
    'D': 2,
    'D#': 3,
    'E': 4,
    'F': 5,
    'F#': 6,
    'G': 7,
    'G#': 8,
    'A': 9,
    'A#': 10,
    'B': 11
  };

  let noteIndex = noteIndexMap[noteName];
  if (noteIndex === undefined) return note;

  let newNoteIndex = noteIndex + semitones;
  let newOctave = octave;

  while (newNoteIndex < 0) {
    newNoteIndex += 12;
    newOctave -= 1;
  }
  while (newNoteIndex > 11) {
    newNoteIndex -= 12;
    newOctave += 1;
  }

  if (newOctave < 0 || newOctave > 9) {
    return note;
  }

  const indexToNote = Object.keys(noteIndexMap).reduce((obj, key) => {
    obj[noteIndexMap[key]] = key;
    return obj;
  }, {});

  const newNoteName = indexToNote[newNoteIndex];
  return newNoteName + newOctave;
}

function startPlayback() {
  if (isPlaying || recordedNotes.length === 0) return;

  isPlaying = true;
  playbackStartTime = audioContext.currentTime;
  document.getElementById('stop-btn').disabled = false;
  document.getElementById('play-btn').disabled = true;

  const tempoFactor = tempoPercentage / 100;
  const annotationDisplay = document.getElementById('annotation-display');
  let activeAnnotations = {};

  recordedNotes.forEach(noteEvent => {
    if (!selectedMidiChannels.includes('Omni') && !selectedMidiChannels.includes(noteEvent.channel)) {
      return;
    }

    const playbackTime = playbackStartTime + (noteEvent.time / tempoFactor);

    if (noteEvent.type === 'noteOn') {
      if (playbackTime < audioContext.currentTime) {
        return;
      }
      const timerId = setTimeout(() => {
        noteOn(
          noteEvent.note,
          noteEvent.velocity,
          false,
          noteEvent.fingering,
          noteEvent.annotation
        );

        if (noteEvent.annotation) {
          const annotationText = noteEvent.annotation.replace(/\[.*?\]/g, '').trim();
          if (annotationText) {
            activeAnnotations[noteEvent.note] = annotationText;
            updateAnnotationDisplay();
          }
        }
      }, (playbackTime - audioContext.currentTime) * 1000);
      playbackTimers.push(timerId);
    } else if (noteEvent.type === 'noteOff') {
      if (playbackTime < audioContext.currentTime) {
        return;
      }
      const timerId = setTimeout(() => {
        noteOff(noteEvent.note, false);

        if (activeAnnotations[noteEvent.note]) {
          delete activeAnnotations[noteEvent.note];
          updateAnnotationDisplay();
        }
      }, (playbackTime - audioContext.currentTime) * 1000);
      playbackTimers.push(timerId);
    }
  });

  function updateAnnotationDisplay() {
    const annotationsArray = Object.values(activeAnnotations);
    if (annotationsArray.length > 0) {
      const annotationText = annotationsArray.join(' ');
      annotationDisplay.textContent = annotationText;
      annotationDisplay.style.display = 'block';
    } else {
      annotationDisplay.textContent = '';
      annotationDisplay.style.display = 'none';
    }
  }

  const duration = recordedNotes.reduce((maxTime, noteEvent) => {
    if (selectedMidiChannels.includes('Omni') || selectedMidiChannels.includes(noteEvent.channel)) {
      return Math.max(maxTime, noteEvent.time / tempoFactor);
    } else {
      return maxTime;
    }
  }, 0);

  const stopTimerId = setTimeout(() => {
    stopAction();
    if (isLooping) {
      startPlayback();
    }
  }, duration * 1000);
  playbackTimers.push(stopTimerId);
}

function initKeyboardControls() {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
}

function isInputFocused() {
  const activeEl = document.activeElement;
  if (!activeEl) return false;
  if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable) {
    return true;
  }
  return false;
}

function handleKeyDown(event) {
  if (isInputFocused()) return;

  const key = event.key.toLowerCase();

  if (event.key === ' ' && !event.repeat) {
    event.preventDefault();
    if (isRecording || isPlaying) {
      stopAction();
    } else {
      startPlayback();
    }
    return;
  }

  if (key === 'r' && !event.repeat) {
    event.preventDefault();
    startRecording();
    return;
  }

  if (event.key === 'ArrowLeft' && !event.repeat) {
    event.preventDefault();
    selectPreviousMemory();
    startPlayback();
    return;
  }
  if (event.key === 'ArrowRight' && !event.repeat) {
    event.preventDefault();
    selectNextMemory();
    startPlayback();
    return;
  }

  if (key === '-' && !event.repeat) {
    event.preventDefault();
    transposeSelectedMemoryDown();
    return;
  }

  if (key === '+' && !event.repeat) {
    event.preventDefault();
    transposeSelectedMemoryUp();
    return;
  }

  if (key >= '1' && key <= '6' && !event.repeat) {
    event.preventDefault();
    keyboardOctave = parseInt(key);
    updateKeyLabels();
    return;
  }

  if (!keyboardEnabled) return;
  const mapping = keyNoteMap[key];
  if (mapping && !event.repeat) {
    event.preventDefault();
    const { note: noteBase, octaveOffset } = mapping;
    const noteOctave = keyboardOctave + (octaveOffset || 0);
    const note = noteBase + noteOctave;
    if (!activeNotes[note]) {
      noteOn(note, 127, true);
    }
  }
}

function handleKeyUp(event) {
  if (isInputFocused()) return;

  if (!keyboardEnabled) return;
  const key = event.key.toLowerCase();
  const mapping = keyNoteMap[key];
  if (mapping) {
    event.preventDefault();
    const { note: noteBase, octaveOffset } = mapping;
    const noteOctave = keyboardOctave + (octaveOffset || 0);
    const note = noteBase + noteOctave;
    noteOff(note, true);
  }
}

function selectPreviousMemory() {
  if (memoryList.length === 0) return;
  if (selectedMemoryIndex === null) {
    selectedMemoryIndex = memoryList.length - 1;
  } else {
    selectedMemoryIndex--;
    if (selectedMemoryIndex < 0) {
      selectedMemoryIndex = memoryList.length - 1;
    }
  }
  selectMemorySequence(selectedMemoryIndex);
}

function selectNextMemory() {
  if (memoryList.length === 0) return;
  if (selectedMemoryIndex === null) {
    selectedMemoryIndex = 0;
  } else {
    selectedMemoryIndex++;
    if (selectedMemoryIndex >= memoryList.length) {
      selectedMemoryIndex = 0;
    }
  }
  selectMemorySequence(selectedMemoryIndex);
}

function processSequenceNotes(sequence) {
  noteChordEvents = [];
  const events = sequence.notes;
  if (events.length === 0) return;

  const filteredEvents = events.filter(event => selectedMidiChannels.includes('Omni') || selectedMidiChannels.includes(event.channel));

  let i = 0;
  while (i < filteredEvents.length) {
    if (filteredEvents[i].type === 'noteOn') {
      const chordNotes = [];
      const chordFingerings = {};
      const chordAnnotations = {};
      const startTime = filteredEvents[i].time;
      let j = i;
      while (j < filteredEvents.length && filteredEvents[j].time - filteredEvents[i].time <= 0.2) {
        if (filteredEvents[j].type === 'noteOn') {
          const note = filteredEvents[j].note;
          chordNotes.push(note);
          chordFingerings[note] = filteredEvents[j].fingering || 'N';
          chordAnnotations[note] = filteredEvents[j].annotation || '';
        }
        j++;
      }
      noteChordEvents.push({ notes: chordNotes, fingerings: chordFingerings, time: startTime, annotations: chordAnnotations });
      i = j;
    } else {
      i++;
    }
  }
}

function playChordAtIndex(index) {
  const chordEvent = noteChordEvents[index];
  if (!chordEvent) return;

  stopNavigationActiveNotes();

  chordEvent.notes.forEach(note => {
    const fingering = chordEvent.fingerings[note];
    const annotation = chordEvent.annotations[note] || '';
    noteOnNavigation(note, fingering, annotation);
  });

  if (chordEvent.annotations) {
    const annotationTexts = Object.values(chordEvent.annotations)
      .map(ann => ann.replace(/\[.*?\]/g, '').trim())
      .filter(text => text);
    if (annotationTexts.length > 0) {
      const annotationDisplay = document.getElementById('annotation-display');
      annotationDisplay.textContent = annotationTexts.join(' ');
      annotationDisplay.style.display = 'block';
    } else {
      const annotationDisplay = document.getElementById('annotation-display');
      annotationDisplay.textContent = '';
      annotationDisplay.style.display = 'none';
    }
  }
}

function noteOnNavigation(note, fingering = 'N', annotation = null) {
  if (navigationActiveNotes[note]) return;
  if (!pianoInstrument) return;

  const playableNote = getPlayableNoteName(note);
  const playedNote = pianoInstrument.play(playableNote);
  navigationActiveNotes[note] = playedNote;
  highlightKey(note, true);

  if (fingering && fingering !== 'N') {
    pianoKeys.forEach(key => {
      if (key.dataset.note === playableNote) {
        const fingeringDiv = document.createElement('div');
        fingeringDiv.classList.add('fingering');
        fingeringDiv.textContent = fingering;
        key.parentElement.appendChild(fingeringDiv);
        activeFingerings[note] = fingeringDiv;
      }
    });
  }

  if (annotation) {
    const bracketTextMatches = [...annotation.matchAll(/\[(.*?)\]/g)];
    for (let i = 0; i < bracketTextMatches.length; i++) {
      const bracketText = bracketTextMatches[i][1];
      const colorCodeMatch = bracketText.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i);
      const shorthandColorMatch = bracketText.match(/^#([ROYGBVM])$/i);

      if (colorCodeMatch) {
        const colorCode = '#' + colorCodeMatch[1];
        activeNoteColors[note] = colorCode;
        highlightKey(note, true);

        if (i + 1 < bracketTextMatches.length) {
          const displayText = bracketTextMatches[++i][1];
          pianoKeys.forEach(key => {
            if (key.dataset.note === playableNote) {
              const isBlackKey = key.classList.contains('black');
              const annotationDiv = document.createElement('div');
              annotationDiv.classList.add('key-annotation');
              annotationDiv.textContent = displayText;

              key.parentElement.style.position = 'relative';
              annotationDiv.style.position = 'absolute';

              annotationDiv.style.top = '160px';

              if (isBlackKey) {
                annotationDiv.style.left = '70%';
                annotationDiv.style.width = '60%';
              } else {
                annotationDiv.style.left = '0';
                annotationDiv.style.width = '100%';
              }

              annotationDiv.style.textAlign = 'center';
              annotationDiv.style.color = 'white';
              annotationDiv.style.fontSize = '12px';

              key.parentElement.appendChild(annotationDiv);
              navigationActiveKeyAnnotations[note] = navigationActiveKeyAnnotations[note] || [];
              navigationActiveKeyAnnotations[note].push(annotationDiv);
            }
          });
        }
        continue;
      } else if (shorthandColorMatch) {
        const shorthandCode = shorthandColorMatch[1].toUpperCase();
        const colorCode = shorthandColorMap[shorthandCode];
        if (colorCode) {
          activeNoteColors[note] = colorCode;
          highlightKey(note, true);

          if (i + 1 < bracketTextMatches.length) {
            const displayText = bracketTextMatches[++i][1];
            pianoKeys.forEach(key => {
              if (key.dataset.note === playableNote) {
                const isBlackKey = key.classList.contains('black');
                const annotationDiv = document.createElement('div');
                annotationDiv.classList.add('key-annotation');
                annotationDiv.textContent = displayText;

                key.parentElement.style.position = 'relative';
                annotationDiv.style.position = 'absolute';

                annotationDiv.style.top = '160px';

                if (isBlackKey) {
                  annotationDiv.style.left = '70%';
                  annotationDiv.style.width = '60%';
                } else {
                  annotationDiv.style.left = '0';
                  annotationDiv.style.width = '100%';
                }

                annotationDiv.style.textAlign = 'center';
                annotationDiv.style.color = 'white';
                annotationDiv.style.fontSize = '12px';

                key.parentElement.appendChild(annotationDiv);
                navigationActiveKeyAnnotations[note] = navigationActiveKeyAnnotations[note] || [];
                navigationActiveKeyAnnotations[note].push(annotationDiv);
              }
            });
          }
          continue;
        }
      }

      pianoKeys.forEach(key => {
        if (key.dataset.note === playableNote) {
          const isBlackKey = key.classList.contains('black');
          const annotationDiv = document.createElement('div');
          annotationDiv.classList.add('key-annotation');
          annotationDiv.textContent = bracketText;

          key.parentElement.style.position = 'relative';
          annotationDiv.style.position = 'absolute';

          annotationDiv.style.top = '160px';

          if (isBlackKey) {
            annotationDiv.style.left = '70%';
            annotationDiv.style.width = '60%';
          } else {
            annotationDiv.style.left = '0';
            annotationDiv.style.width = '100%';
          }

          annotationDiv.style.textAlign = 'center';
          annotationDiv.style.color = 'white';
          annotationDiv.style.fontSize = '12px';

          key.parentElement.appendChild(annotationDiv);
          navigationActiveKeyAnnotations[note] = navigationActiveKeyAnnotations[note] || [];
          navigationActiveKeyAnnotations[note].push(annotationDiv);
        }
      });
    }
  }
}

function noteOffNavigation(note) {
  if (!navigationActiveNotes[note]) return;

  navigationActiveNotes[note].stop();
  delete navigationActiveNotes[note];
  highlightKey(note, false);

  if (activeFingerings[note]) {
    activeFingerings[note].remove();
    delete activeFingerings[note];
  }

  if (navigationActiveKeyAnnotations[note]) {
    if (Array.isArray(navigationActiveKeyAnnotations[note])) {
      navigationActiveKeyAnnotations[note].forEach(annotationDiv => {
        annotationDiv.remove();
      });
    } else {
      navigationActiveKeyAnnotations[note].remove();
    }
    delete navigationActiveKeyAnnotations[note];
  }

  if (activeNoteColors[note]) {
    delete activeNoteColors[note];
  }
}

function stopNavigationActiveNotes() {
  for (const note in navigationActiveNotes) {
    if (navigationActiveNotes.hasOwnProperty(note)) {
      navigationActiveNotes[note].stop();
      highlightKey(note, false);
    }
  }
  navigationActiveNotes = {};

  for (const note in activeFingerings) {
    if (activeFingerings.hasOwnProperty(note)) {
      activeFingerings[note].remove();
    }
  }
  activeFingerings = {};

  for (const note in navigationActiveKeyAnnotations) {
    if (navigationActiveKeyAnnotations.hasOwnProperty(note)) {
      if (Array.isArray(navigationActiveKeyAnnotations[note])) {
        navigationActiveKeyAnnotations[note].forEach(annotationDiv => {
          annotationDiv.remove();
        });
      } else {
        navigationActiveKeyAnnotations[note].remove();
      }
      delete navigationActiveKeyAnnotations[note];
    }
  }
  navigationActiveKeyAnnotations = {};

  const annotationDisplay = document.getElementById('annotation-display');
  annotationDisplay.style.display = 'none';
  annotationDisplay.textContent = '';
}

function updateMemoryFromEditor() {
  if (selectedMemoryIndex === null) return;

  const selectedSequence = memoryList[selectedMemoryIndex];

  const memoryNameInput = document.getElementById('memory-name-input');
  if (memoryNameInput) {
    selectedSequence.name = memoryNameInput.value;

    const memoryListItems = document.querySelectorAll('#memory-list li');
    memoryListItems.forEach((li) => {
      const index = parseInt(li.dataset.index, 10);
      if (index === selectedMemoryIndex) {
        const label = li.querySelector('span');
        label.textContent = selectedSequence.name;
      }
    });
  }

  const events = [];
  const eventRows = document.querySelectorAll('#memory-editor-table .event-row');
  eventRows.forEach((row) => {
    const eventIndex = parseInt(row.dataset.index, 10);
    const timeInput = row.querySelector('.event-time');
    const eventTypeSelect = row.querySelector('.event-type');
    const eventParamsCell = row.querySelector('.event-params');

    if (!timeInput || !eventTypeSelect || !eventParamsCell) return;

    const event = {
      time: parseFloat(timeInput.value),
      type: eventTypeSelect.value
    };

    if (event.type === 'noteOn' || event.type === 'noteOff') {
      const noteInput = eventParamsCell.querySelector('.event-note');
      const channelSelect = eventParamsCell.querySelector('.event-channel');
      if (noteInput && channelSelect) {
        event.note = normalizeNoteFromInput(noteInput.value);
        event.channel = channelSelect.value;
      }

      if (event.type === 'noteOn') {
        const velocityInput = eventParamsCell.querySelector('.event-velocity');
        const fingeringSelect = eventParamsCell.querySelector('.event-fingering');

        if (velocityInput && fingeringSelect) {
          event.velocity = parseInt(velocityInput.value, 10);
          event.fingering = fingeringSelect.value;
        }

        const annotationRow = document.querySelector(`.annotation-row[data-index="${eventIndex}"]`);
        if (annotationRow) {
          const annotationTextarea = annotationRow.querySelector('.event-annotation');
          event.annotation = annotationTextarea.value;
        }
      }
    } else if (event.type === 'controlChange') {
      const controllerNumberInput = eventParamsCell.querySelector('.event-controller-number');
      const controllerValueInput = eventParamsCell.querySelector('.event-controller-value');
      const channelSelect = eventParamsCell.querySelector('.event-channel');
      if (controllerNumberInput && controllerValueInput && channelSelect) {
        event.controllerNumber = parseInt(controllerNumberInput.value, 10);
        event.controllerValue = parseInt(controllerValueInput.value, 10);
        event.channel = channelSelect.value;
      }
    } else if (event.type === 'programChange') {
      const programNumberInput = eventParamsCell.querySelector('.event-program-number');
      const channelSelect = eventParamsCell.querySelector('.event-channel');
      if (programNumberInput && channelSelect) {
        event.programNumber = parseInt(programNumberInput.value, 10);
        event.channel = channelSelect.value;
      }
    }

    events.push(event);
  });

  selectedSequence.notes = events;
  let totalDuration = 0;
  selectedSequence.notes.forEach((noteEvent) => {
    if (noteEvent.time > totalDuration) {
      totalDuration = noteEvent.time;
    }
  });
  selectedSequence.duration = totalDuration;

  updateMemoryList();
  selectMemorySequence(selectedMemoryIndex);
}

function updateChannelButtonStyles() {
  let channelsWithEvents = new Set();

  memoryList.forEach(sequence => {
    sequence.notes.forEach(event => {
      if (event.channel && event.channel !== 'Omni') {
        channelsWithEvents.add(event.channel);
      }
    });
  });

  const channelButtons = document.querySelectorAll('.channel-button');

  channelButtons.forEach(button => {
    const channel = button.getAttribute('data-channel');
    if (channel !== 'Omni') {
      if (channelsWithEvents.has(channel)) {
        button.classList.add('has-events');
      } else {
        button.classList.remove('has-events');
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  createPiano();
  initMIDI();

  const colors = [
    '#000000', '#e60000', '#ff9900', '#ffff00', '#008000', '#0066cc', '#9933ff',
    '#ffffff', '#facccc', '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff',
    '#dddddd', '#ff0000', '#ff9c00', '#ffff00', '#00ff00', '#0000ff', '#cc66ff',
    'magenta',
    '#FF0000', '#FFA500', '#FFFF00', '#008000', '#0000FF', '#6109AB', '#FF00FF'
  ];

  const colorSelect = document.querySelector('select.ql-color');
  const backgroundSelect = document.querySelector('select.ql-background');

  colors.forEach(color => {
    const option = document.createElement('option');
    option.value = color;
    option.style.backgroundColor = color;
    colorSelect.appendChild(option.cloneNode());
    backgroundSelect.appendChild(option.cloneNode());
  });

  initSequencerControls();
  initKeyboardControls();

  const memoryEditorBtn = document.getElementById('memory-editor-btn');
  memoryEditorBtn.addEventListener('click', toggleMemoryEditor);

  const noteColorToggleBtn = document.getElementById('note-color-toggle-btn');
  noteColorToggleBtn.style.background = 'lightblue';
  noteColorToggleBtn.classList.remove('pressed');

  noteColorToggleBtn.addEventListener('click', () => {
    colorfulNotesEnabled = !colorfulNotesEnabled;
    if (colorfulNotesEnabled) {
      noteColorToggleBtn.style.background = 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)';
      noteColorToggleBtn.classList.add('pressed');
    } else {
      noteColorToggleBtn.style.background = 'lightblue';
      noteColorToggleBtn.classList.remove('pressed');
    }
    for (const note in activeNotes) {
      if (activeNotes.hasOwnProperty(note)) {
        highlightKey(note, true);
      }
    }
  });

  const loopBtn = document.getElementById('loop-btn');
  loopBtn.addEventListener('click', () => {
    isLooping = !isLooping;
    loopBtn.classList.toggle('pressed', isLooping);
  });

  const keyboardToggleBtn = document.getElementById('keyboard-toggle-btn');
  keyboardToggleBtn.classList.toggle('pressed', keyboardEnabled);
  keyboardToggleBtn.addEventListener('click', () => {
    keyboardEnabled = !keyboardEnabled;
    keyboardToggleBtn.classList.toggle('pressed', keyboardEnabled);
    updateKeyLabels();
  });

  const BlockEmbed = Quill.import('blots/block/embed');
  class IframeBlot extends BlockEmbed {
    static create(value) {
      const node = super.create();
      node.setAttribute('src', value.src);
      node.setAttribute('frameborder', '0');
      node.setAttribute('allowfullscreen', true);
      node.setAttribute('width', '100%');
      node.setAttribute('height', value.height || '315');
      return node;
    }

    static value(node) {
      return {
        src: node.getAttribute('src'),
        width: node.getAttribute('width'),
        height: node.getAttribute('height')
      };
    }
  }
  IframeBlot.blotName = 'iframe';
  IframeBlot.tagName = 'iframe';
  Quill.register(IframeBlot);

  document.getElementById('insert-iframe-btn').addEventListener('click', () => {
    const input = prompt('Paste the embed code, image data URL, or YouTube URL:');
    if (input) {
      const range = quill.getSelection(true);

      const youtubeUrlMatch = input.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]{11})(?:\S+)?/);
      if (youtubeUrlMatch && youtubeUrlMatch[1]) {
        const videoId = youtubeUrlMatch[1];
        const iframeSrc = `https://www.youtube.com/embed/${videoId}`;
        quill.insertEmbed(range.index, 'iframe', { src: iframeSrc });
      } else if (input.startsWith('data:image/')) {
        quill.insertEmbed(range.index, 'image', input);
      } else {
        quill.clipboard.dangerouslyPasteHTML(range.index, input);
      }
    }
  });

  initSequencerControls();
  initKeyboardControls();

  const toggleEditorBtn = document.getElementById('toggle-editor-btn');

  toggleEditorBtn.addEventListener('click', () => {
    const editorContainer = document.getElementById('editor-container');
    if (editorContainer.style.display === 'none' || editorContainer.style.display === '') {
      editorContainer.style.display = 'block';
    } else {
      editorContainer.style.display = 'none';
    }
  });

  quill = new Quill('#editor', {
    modules: {
      toolbar: '#toolbar',
      keyboard: {
        bindings: {
          linkClick: {
            key: 'click',
            collapsed: true,
            format: ['link'],
            handler: function() {
              return;
            }
          }
        }
      }
    },
    theme: 'snow',
  });

  quill.root.addEventListener('click', function(event) {
    let link = event.target.closest('a');
    if (link) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const href = link.getAttribute('href');
      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
        window.open(href, '_blank');
      } else {
        selectMemoryByName(href);
      }
    }
  });

  quill.on('text-change', function(delta, oldDelta, source) {
    if (
      selectedMemoryIndex !== null &&
      !isContentEmpty(memoryList[selectedMemoryIndex].editorContent)
    ) {
      const currentContent = quill.getContents();
      if (isContentEmpty(currentContent)) {
        memoryList[selectedMemoryIndex].editorContent = null;
        updateEditorAssociationButton();
      }
    }
  });

  quill.root.addEventListener('paste', function(e) {
    if (e.clipboardData && e.clipboardData.items) {
      var items = e.clipboardData.items;
      var hasImage = false;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.type.indexOf('image') !== -1) {
          hasImage = true;
          var blob = item.getAsFile();
          var reader = new FileReader();
          reader.onload = function(event) {
            var base64ImageSrc = event.target.result;
            var range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', base64ImageSrc);
            quill.setSelection(range.index + 1);
          };
          reader.readAsDataURL(blob);
        }
      }
      if (hasImage) {
        e.preventDefault();
      }
    }
  });

  document.getElementById('transpose-amount').textContent = transposeAmount;

  const channelButtons = document.querySelectorAll('.channel-button');
  channelButtons.forEach(button => {
    button.addEventListener('click', () => {
      const channel = button.getAttribute('data-channel');

      if (channel === 'Omni') {
        if (selectedMidiChannels.includes('Omni')) {
          selectedMidiChannels = [];
          button.classList.remove('pressed');
        } else {
          selectedMidiChannels = ['Omni'];
          channelButtons.forEach(btn => btn.classList.remove('pressed'));
          button.classList.add('pressed');
        }
      } else {
        if (selectedMidiChannels.includes('Omni')) {
          selectedMidiChannels = [];
          const omniButton = document.querySelector('.channel-button[data-channel="Omni"]');
          omniButton.classList.remove('pressed');
        }

        if (selectedMidiChannels.includes(channel)) {
          selectedMidiChannels = selectedMidiChannels.filter(ch => ch !== channel);
          button.classList.remove('pressed');
        } else {
          selectedMidiChannels.push(channel);
          button.classList.add('pressed');
        }
      }

      if (selectedMemoryIndex !== null) {
        const selectedSequence = memoryList[selectedMemoryIndex];
        processSequenceNotes(selectedSequence);
        currentNoteIndex = -1;
      }
    });
  });
  updateChannelButtonStyles();

  const duplicateMemoryBtn = document.getElementById('duplicate-memory-btn');
  duplicateMemoryBtn.addEventListener('click', duplicateSelectedMemory);
});

function duplicateSelectedMemory() {
  if (selectedMemoryIndex === null) return;

  const originalSequence = memoryList[selectedMemoryIndex];

  // Determine the base name (original name without duplication number suffix)
  const baseNameMatch = originalSequence.name.match(/^(.*?)(\(\d+\))?$/);
  const baseName = baseNameMatch ? baseNameMatch[1].trim() : originalSequence.name;

  // Count existing duplicates
  let maxDuplicationCount = 0;
  memoryList.forEach(seq => {
    const seqNameMatch = seq.name.match(new RegExp('^' + baseName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\((\\d+)\\)$'));
    if (seqNameMatch) {
      const count = parseInt(seqNameMatch[1], 10);
      if (count > maxDuplicationCount) {
        maxDuplicationCount = count;
      }
    }
  });

  const newDuplicationCount = maxDuplicationCount + 1;

  const duplicateSequence = JSON.parse(JSON.stringify(originalSequence));
  duplicateSequence.name = `${baseName} (${newDuplicationCount})`;
  duplicateSequence.selected = false;
  duplicateSequence.rank = (originalSequence.rank || memoryList.length) + 0.1;

  // Insert duplicate under the original
  memoryList.splice(selectedMemoryIndex + 1, 0, duplicateSequence);

  // Update the memory list display
  updateMemoryList();

  // Re-select the original memory
  selectMemorySequence(selectedMemoryIndex);
}

function rearrangeMemories() {
  // Store current selected memory name
  let selectedMemoryName = selectedMemoryIndex !== null && memoryList[selectedMemoryIndex] ? memoryList[selectedMemoryIndex].name : null;

  // Sort the memoryList according to ranks
  memoryList.sort((a, b) => {
    let rankA = parseFloat(a.rank);
    let rankB = parseFloat(b.rank);
    if (isNaN(rankA)) rankA = memoryList.length;
    if (isNaN(rankB)) rankB = memoryList.length;
    return rankA - rankB;
  });

  // Update selectedMemoryIndex
  if (selectedMemoryName !== null) {
    selectedMemoryIndex = memoryList.findIndex(sequence => sequence.name === selectedMemoryName);
  }

  updateMemoryList();
}

function updateEditorAssociationButton() {
  const addEditorContentBtn = document.getElementById('add-editor-content-btn');
  if (
    selectedMemoryIndex !== null &&
    !isContentEmpty(memoryList[selectedMemoryIndex].editorContent)
  ) {
    addEditorContentBtn.classList.add('editor-associated');
  } else {
    addEditorContentBtn.classList.remove('editor-associated');
  }
}

function isContentEmpty(content) {
  if (!content) return true;

  const text = content.ops
    .map(op => (typeof op.insert === 'string' ? op.insert : ''))
    .join('')
    .trim();

  return text === '';
}

let memoryEditorVisible = false;

function toggleMemoryEditor() {
  memoryEditorVisible = !memoryEditorVisible;
  const memoryEditorContainer = document.getElementById('memory-editor-container');
  if (memoryEditorVisible) {
    memoryEditorContainer.style.display = 'block';
    populateMemoryEditor();
  } else {
    updateMemoryFromEditor();
    updateMemoryList();
    selectMemorySequence(selectedMemoryIndex);
    memoryEditorContainer.style.display = 'none';
  }
}

function clearActiveNotes() {
  for (const note in activeNotes) {
    if (activeNotes.hasOwnProperty(note)) {
      activeNotes[note].stop();
      highlightKey(note, false);
    }
  }
  activeNotes = {};
}

function goToPreviousNoteOrChord() {
  if (noteChordEvents.length === 0) return;
  if (currentNoteIndex <= 0) {
    currentNoteIndex = noteChordEvents.length - 1;
  } else {
    currentNoteIndex--;
  }
  playChordAtIndex(currentNoteIndex);
}

function goToNextNoteOrChord() {
  if (noteChordEvents.length === 0) return;
  currentNoteIndex = (currentNoteIndex + 1) % noteChordEvents.length;
  playChordAtIndex(currentNoteIndex);
}

let activeNoteColors = {};

function clearApp() {
  stopAction();
  memoryList = [];
  sequenceCounter = 1;
  selectedMemoryIndex = null;
  recordedNotes = [];
  quill.setContents([]);
  document.getElementById('selected-memory').textContent = 'No Memory Selected';

  updateMemoryList();
  updateChannelButtonStyles();

  document.getElementById('play-btn').disabled = memoryList.length === 0;
}

document.addEventListener('DOMContentLoaded', () => {
  // ... existing code ...

  const titleBar = document.querySelector('#title-container h1');
  const originalTitleHTML = titleBar.innerHTML;

  setTimeout(() => {
    titleBar.innerHTML = "He is coming back...";
    setTimeout(() => {
      titleBar.innerHTML = "...are you ready?";
      setTimeout(() => {
        titleBar.innerHTML = originalTitleHTML;
      }, 10000); // Revert to original title after 10 seconds
    }, 10000); // Show second message for 10 seconds
  }, 30000); // Start after 30 seconds
});
