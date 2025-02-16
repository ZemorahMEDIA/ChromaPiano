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

Soundfont.instrument(audioContext, 'acoustic_grand_piano').then(piano => {
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

function noteOn(note, velocity = 127, isUserInteraction = false, fingering = null) {
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
        if (colorfulNotesEnabled) {
          const baseNote = playableNote.replace(/[0-9]/g, '');
          if (baseNote.includes('#')) {
            const adjNotes = blackKeyAdjacency[baseNote];
            const color1 = noteColors[adjNotes[0]];
            const color2 = noteColors[adjNotes[1]];
            key.style.background = `linear-gradient(to top, ${color2} 50%, ${color1} 50%)`;
          } else {
            const color = noteColors[baseNote];
            key.style.background = color;
          }
        } else {
          key.style.background = 'lightblue';
        }
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
  a.download = 'memory_list.json';
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

    li.appendChild(checkbox);
    li.appendChild(label);

    li.addEventListener('click', function(e) {
      if (e.target.nodeName !== 'INPUT') {
        selectMemorySequence(index);
        toggleMemoryList();
      }
    });

    memoryListContainer.appendChild(li);
  });
  document.getElementById('play-btn').disabled = memoryList.length === 0;
  document.getElementById('save-btn').disabled = memoryList.length === 0;
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
    tempo: 100
  };
  memoryList.push(sequenceData);
  sequenceCounter++;

  selectMemorySequence(memoryList.length - 1);
  updateMemoryList();
  document.getElementById('play-btn').disabled = false;
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
    <div class="group-label"><span>Events</span></div>
    <div id="memory-add-fields">
      <input type="text" id="add-notes-input" placeholder="Notes">
      <input type="number" id="add-velocity-input" value="100" placeholder="Velocity" min="1" max="127">
      <input type="text" id="add-start-input" placeholder="Start">
      <input type="number" id="add-duration-input" placeholder="Duration" step="0.001">
      <select id="add-channel-select">
        <option value="Omni">Omni</option>
        <option value="Split">Split</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="6">6</option>
        <option value="7">7</option>
        <option value="8">8</option>
        <option value="9">9</option>
        <option value="10">10</option>
        <option value="11">11</option>
        <option value="12">12</option>
        <option value="13">13</option>
        <option value="14">14</option>
        <option value="15">15</option>
        <option value="16">16</option>
      </select>
      <input type="number" id="add-cc-number-input" placeholder="CC#" min="0" max="127">
      <input type="number" id="add-cc-value-input" placeholder="CCV" min="0" max="127">
      <input type="number" id="add-pc-input" placeholder="PC">
    </div>
    <button id="add-entry-btn">Add</button>
  </div>
  <table id="memory-editor-table">
    <tr><th>Time (s)</th><th>Type</th><th>Parameters</th><th>Action</th></tr>`;

  events.forEach((event, index) => {
    html += `<tr class="event-row ${event.type === 'noteOn' ? 'note-on' :
                                   event.type === 'noteOff' ? 'note-off' :
                                   event.type === 'controlChange' ? 'control-change' :
                                   event.type === 'programChange' ? 'program-change' : ''}" data-index="${index}">
      <td><input type="number" step="0.001" class="event-time" value="${event.time.toFixed(3)}"></td>
      <td>
        <select class="event-type">
          <option value="noteOn"${event.type === 'noteOn' ? ' selected' : ''}>noteOn</option>
          <option value="noteOff"${event.type === 'noteOff' ? ' selected' : ''}>noteOff</option>
          <option value="controlChange"${event.type === 'controlChange' ? ' selected' : ''}>controlChange</option>
          <option value="programChange"${event.type === 'programChange' ? ' selected' : ''}>programChange</option>
        </select>
      </td>
      <td class="event-params">`;

    if (event.type === 'noteOn') {
      let formattedNote = formatNoteForDisplay(event.note);
      html += `<input type="text" class="event-note event-note-font" value="${formattedNote}">`;
      if (event.velocity !== undefined) {
        html += ` <span class="icon volume-icon"></span><input type="number" class="event-velocity" value="${event.velocity}" min="1" max="127">`;
      } else {
        html += ` <span class="icon volume-icon"></span><input type="number" class="event-velocity" value="100" min="1" max="127">`;
      }

      if (event.fingering) {
        html += ` <span class="icon hand-icon"></span><select class="event-fingering">
                      <option value="N"${event.fingering === 'N' ? ' selected' : ''}>N</option>
                      <option value="L1"${event.fingering === 'L1' ? ' selected' : ''}>L1</option>
                      <option value="L2"${event.fingering === 'L2' ? ' selected' : ''}>L2</option>
                      <option value="L3"${event.fingering === 'L3' ? ' selected' : ''}>L3</option>
                      <option value="L4"${event.fingering === 'L4' ? ' selected' : ''}>L4</option>
                      <option value="L5"${event.fingering === 'L5' ? ' selected' : ''}>L5</option>
                      <option value="R1"${event.fingering === 'R1' ? ' selected' : ''}>R1</option>
                      <option value="R2"${event.fingering === 'R2' ? ' selected' : ''}>R2</option>
                      <option value="R3"${event.fingering === 'R3' ? ' selected' : ''}>R3</option>
                      <option value="R4"${event.fingering === 'R4' ? ' selected' : ''}>R4</option>
                      <option value="R5"${event.fingering === 'R5' ? ' selected' : ''}>R5</option>
                  </select>`;
      } else {
        html += ` <span class="icon hand-icon"></span><select class="event-fingering">
                      <option value="N" selected>N</option>
                      <option value="L1">L1</option>
                      <option value="L2">L2</option>
                      <option value="L3">L3</option>
                      <option value="L4">L4</option>
                      <option value="L5">L5</option>
                      <option value="R1">R1</option>
                      <option value="R2">R2</option>
                      <option value="R3">R3</option>
                      <option value="R4">R4</option>
                      <option value="R5">R5</option>
                  </select>`;
      }
    } else if (event.type === 'noteOff') {
      let formattedNote = formatNoteForDisplay(event.note);
      html += `<input type="text" class="event-note event-note-font" value="${formattedNote}">`;
    } else if (event.type === 'controlChange') {
      html += `CC#: <input type="number" class="event-controller-number" value="${event.controllerNumber}" min="0" max="127">
               CCV: <input type="number" class="event-controller-value" value="${event.controllerValue}" min="0" max="127">`;
    } else if (event.type === 'programChange') {
      html += `Program Number: <input type="number" class="event-program-number" value="${event.programNumber}" min="0" max="127">`;
    }

    html += ` <span class="icon antenna-icon"></span><select class="event-channel">
      <option value="Omni"${event.channel === 'Omni' ? ' selected' : ''}>Omni</option>
      <option value="1"${event.channel === '1' ? ' selected' : ''}>1</option>
      <option value="2"${event.channel === '2' ? ' selected' : ''}>2</option>
      <option value="3"${event.channel === '3' ? ' selected' : ''}>3</option>
      <option value="4"${event.channel === '4' ? ' selected' : ''}>4</option>
      <option value="5"${event.channel === '5' ? ' selected' : ''}>5</option>
      <option value="6"${event.channel === '6' ? ' selected' : ''}>6</option>
      <option value="7"${event.channel === '7' ? ' selected' : ''}>7</option>
      <option value="8"${event.channel === '8' ? ' selected' : ''}>8</option>
      <option value="9"${event.channel === '9' ? ' selected' : ''}>9</option>
      <option value="10"${event.channel === '10' ? ' selected' : ''}>10</option>
      <option value="11"${event.channel === '11' ? ' selected' : ''}>11</option>
      <option value="12"${event.channel === '12' ? ' selected' : ''}>12</option>
      <option value="13"${event.channel === '13' ? ' selected' : ''}>13</option>
      <option value="14"${event.channel === '14' ? ' selected' : ''}>14</option>
      <option value="15"${event.channel === '15' ? ' selected' : ''}>15</option>
      <option value="16"${event.channel === '16' ? ' selected' : ''}>16</option>
    </select>
    </td>
      <td class="action-cell"><button class="delete-entry-btn">X</button></td>
    </tr>`;
  });

  html += '</table>';
  memoryEditorContainer.innerHTML = html;

  const memoryNameInput = document.getElementById('memory-name-input');
  memoryNameInput.addEventListener('blur', updateMemoryFromEditor);

  const addEntryBtn = document.getElementById('add-entry-btn');
  addEntryBtn.addEventListener('click', function () {
    const notesInput = document.getElementById('add-notes-input').value.trim();
    const velocityInput = document.getElementById('add-velocity-input').value;
    const startInput = document.getElementById('add-start-input').value;
    const durationInput = document.getElementById('add-duration-input').value;
    const ccNumberInput = document.getElementById('add-cc-number-input').value;
    const ccValueInput = document.getElementById('add-cc-value-input').value;
    const pcInput = document.getElementById('add-pc-input').value;
    const channelSelect = document.getElementById('add-channel-select');
    const channelValue = channelSelect.value;

    let startTime;
    if (!startInput.trim() || startInput.trim().toLowerCase() === 'last') {
      if (events.length > 0) {
        const lastEvent = events[events.length - 1];
        startTime = lastEvent.time;
      } else {
        startTime = 0;
      }
    } else {
      startTime = parseFloat(startInput);
      if (isNaN(startTime)) {
        startTime = 0;
      }
    }

    let duration;
    if (!durationInput.trim()) {
      duration = 1.0;
    } else {
      duration = parseFloat(durationInput);
      if (isNaN(duration)) {
        duration = 1.0;
      }
    }

    const newEvents = [];

    if (ccNumberInput && ccValueInput) {
      const ccEvent = {
        type: 'controlChange',
        time: startTime,
        controllerNumber: parseInt(ccNumberInput),
        controllerValue: parseInt(ccValueInput),
        channel: channelValue
      };
      newEvents.push(ccEvent);
    }

    if (pcInput) {
      const pcEvent = {
        type: 'programChange',
        time: startTime,
        programNumber: parseInt(pcInput),
        channel: channelValue
      };
      newEvents.push(pcEvent);
    }

    if (notesInput) {
      const noteNames = notesInput.split(',').map(note => note.trim());
      const velocity = parseInt(velocityInput) || 100;

      noteNames.forEach((note, index) => {
        let channel = channelValue;

        if (channelValue === 'Split') {
          channel = String(((index) % 16) + 1);
        }

        const noteOnEvent = {
          type: 'noteOn',
          note: note,
          velocity: velocity,
          time: startTime,
          channel: channel
        };
        const noteOffEvent = {
          type: 'noteOff',
          note: note,
          time: startTime + duration,
          channel: channel
        };
        newEvents.push(noteOnEvent, noteOffEvent);
      });
    }

    events.push(...newEvents);
    events.sort((a, b) => a.time - b.time);
    selectedSequence.duration = Math.max(selectedSequence.duration, ...events.map(event => event.time));

    populateMemoryEditor();
  });

  const deleteButtons = memoryEditorContainer.querySelectorAll('.delete-entry-btn');
  deleteButtons.forEach((button, index) => {
    button.addEventListener('click', function () {
      events.splice(index, 1);
      populateMemoryEditor();
    });
  });

  const eventTypeSelects = memoryEditorContainer.querySelectorAll('.event-type');
  eventTypeSelects.forEach(select => {
    select.addEventListener('change', function () {
      const row = this.closest('tr');
      updateEventParamsCell(row);
      updateRowClass(row);
    });
  });

  const eventParamsFields = memoryEditorContainer.querySelectorAll('.event-params input');
  eventParamsFields.forEach(inputField => {
    inputField.addEventListener('input', function () {
      const row = this.closest('tr');
      updateRowClass(row);
    });
  });

  const noteInputs = memoryEditorContainer.querySelectorAll('.event-note');
  noteInputs.forEach(noteInput => {
    noteInput.addEventListener('focus', function () {
      currentNoteInputField = noteInput;
    });
    noteInput.addEventListener('blur', function () {
      if (currentNoteInputField === noteInput) {
        currentNoteInputField = null;
      }
    });
  });

  const eventChannelSelects = memoryEditorContainer.querySelectorAll('.event-channel');
  eventChannelSelects.forEach(select => {
    select.addEventListener('change', function () {
    });
  });

  const actionCells = memoryEditorContainer.querySelectorAll('.action-cell');
  actionCells.forEach(cell => {
    cell.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent the event from triggering other handlers
      const row = this.closest('tr');
      const eventIndex = parseInt(row.dataset.index, 10);
      if (selectedEventIndices.includes(eventIndex)) {
        // Deselect
        selectedEventIndices = selectedEventIndices.filter(index => index !== eventIndex);
        row.classList.remove('selected');
      } else {
        // Select
        selectedEventIndices.push(eventIndex);
        row.classList.add('selected');
      }
    });
  });

  const eventInputs = memoryEditorContainer.querySelectorAll('.event-time, .event-type, .event-params input, .event-params select, .event-channel');
  eventInputs.forEach(input => {
    input.addEventListener('input', function() {
      const row = this.closest('tr');
      const eventIndex = parseInt(row.dataset.index, 10);
      const eventTypeSelect = row.querySelector('.event-type');
      const eventType = eventTypeSelect.value;
      if (selectedEventIndices.length > 1 && selectedEventIndices.includes(eventIndex)) {
        // Copy changes to other selected events of the same type
        const inputField = this;
        const valueToCopy = inputField.value;
        const fieldClassList = Array.from(inputField.classList);

        selectedEventIndices.forEach(index => {
          if (index !== eventIndex) {
            const targetRow = memoryEditorContainer.querySelector(`tr[data-index="${index}"]`);
            if (targetRow) {
              const targetEventTypeSelect = targetRow.querySelector('.event-type');
              const targetEventType = targetEventTypeSelect.value;
              if (targetEventType === eventType) {
                let targetInput;

                // Find corresponding input in targetRow
                if (fieldClassList.includes('event-time')) {
                  targetInput = targetRow.querySelector('.event-time');
                } else if (fieldClassList.includes('event-type')) {
                  targetInput = targetRow.querySelector('.event-type');
                  if (targetInput.value !== valueToCopy) {
                    targetInput.value = valueToCopy;
                    updateEventParamsCell(targetRow);
                  }
                } else if (fieldClassList.includes('event-channel')) {
                  targetInput = targetRow.querySelector('.event-channel');
                } else if (inputField.closest('.event-params')) {
                  const paramClass = fieldClassList.find(cls => cls.startsWith('event-'));
                  if (paramClass) {
                    targetInput = targetRow.querySelector(`.event-params .${paramClass}`);
                  }
                }
                if (targetInput) {
                  targetInput.value = valueToCopy;
                }
              }
            }
          }
        });
      }
      updateRowClass(row);
    });
  });
}

function updateEventParamsCell(row) {
  const eventType = row.querySelector('.event-type').value;
  const eventParamsCell = row.querySelector('.event-params');
  eventParamsCell.innerHTML = '';

  if (eventType === 'noteOn') {
    eventParamsCell.innerHTML = `<input type="text" class="event-note event-note-font" value=""> <span class="icon volume-icon"></span><input type="number" class="event-velocity" value="100" min="1" max="127"> <span class="icon hand-icon"></span><select class="event-fingering">
                    <option value="N">N</option>
                    <option value="L1">L1</option>
                    <option value="L2">L2</option>
                    <option value="L3">L3</option>
                    <option value="L4">L4</option>
                    <option value="L5">L5</option>
                    <option value="R1">R1</option>
                    <option value="R2">R2</option>
                    <option value="R3">R3</option>
                    <option value="R4">R4</option>
                    <option value="R5">R5</option>
                </select>`;
  } else if (eventType === 'noteOff') {
    eventParamsCell.innerHTML = `<input type="text" class="event-note event-note-font" value="">`;
  } else if (eventType === 'controlChange') {
    eventParamsCell.innerHTML = `CC#: <input type="number" class="event-controller-number" value="0" min="0" max="127">
                                 CCV: <input type="number" class="event-controller-value" value="0" min="0" max="127">`;
  } else if (eventType === 'programChange') {
    eventParamsCell.innerHTML = `Program Number: <input type="number" class="event-program-number" value="0" min="0" max="127">`;
  }

  const noteInput = eventParamsCell.querySelector('.event-note');
  if (noteInput) {
    noteInput.addEventListener('focus', function () {
      currentNoteInputField = noteInput;
    });
    noteInput.addEventListener('blur', function () {
      if (currentNoteInputField === noteInput) {
        currentNoteInputField = null;
      }
    });
  }

  const paramsFields = eventParamsCell.querySelectorAll('input, select');
  paramsFields.forEach(inputField => {
    inputField.addEventListener('input', function () {
      const row = this.closest('tr');
      const eventIndex = parseInt(row.dataset.index, 10);
      const eventTypeSelect = row.querySelector('.event-type');
      const eventType = eventTypeSelect.value;
      if (selectedEventIndices.length > 1 && selectedEventIndices.includes(eventIndex)) {
        // Copy changes to other selected events of the same type
        const valueToCopy = inputField.value;
        const fieldClassList = Array.from(inputField.classList);
        selectedEventIndices.forEach(index => {
          if (index !== eventIndex) {
            const targetRow = memoryEditorContainer.querySelector(`tr[data-index="${index}"]`);
            if (targetRow) {
              const targetEventTypeSelect = targetRow.querySelector('.event-type');
              const targetEventType = targetEventTypeSelect.value;
              if (targetEventType === eventType) {
                let targetInput;
                const paramClass = fieldClassList.find(cls => cls.startsWith('event-'));
                if (paramClass) {
                  targetInput = targetRow.querySelector(`.event-params .${paramClass}`);
                }
                if (targetInput) {
                  targetInput.value = valueToCopy;
                }
              }
            }
          }
        });
      }
      updateRowClass(row);
    });
  });
}

function updateRowClass(row) {
  const eventType = row.querySelector('.event-type').value;
  row.classList.remove('note-on', 'note-off', 'control-change', 'program-change');
  if (eventType === 'noteOn') {
    row.classList.add('note-on');
  } else if (eventType === 'noteOff') {
    row.classList.add('note-off');
  } else if (eventType === 'controlChange') {
    row.classList.add('control-change');
  } else if (eventType === 'programChange') {
    row.classList.add('program-change');
  }
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

function exportSelectedMemoryAsMidi() {
  if (selectedMemoryIndex === null) {
    alert('No memory selected to export.');
    return;
  }

  const selectedSequence = memoryList[selectedMemoryIndex];

  const track = new MidiWriter.Track();

  track.setTempo(100);

  let noteOnEvents = {};
  const events = selectedSequence.notes;

  events.forEach(event => {
    if (event.type === 'noteOn') {
      noteOnEvents[event.note] = { time: event.time, velocity: event.velocity !== undefined ? event.velocity : 100 };
    } else if (event.type === 'noteOff') {
      if (noteOnEvents[event.note] !== undefined) {
        const startTime = noteOnEvents[event.note].time;
        const velocity = noteOnEvents[event.note].velocity;
        const duration = event.time - startTime;

        const startTick = Math.round(startTime * (100 / 60) * 128);
        const durationTicks = Math.round(duration * (100 / 60) * 128) || 1;

        const noteEvent = new MidiWriter.NoteEvent({
          pitch: [event.note],
          duration: 'T' + durationTicks,
          startTick: startTick,
          velocity: velocity
        });
        track.addEvent(noteEvent);

        delete noteOnEvents[event.note];
      }
    } else if (event.type === 'controlChange') {
      const controllerEvent = new MidiWriter.ControllerChangeEvent({
        controllerNumber: event.controllerNumber,
        controllerValue: event.controllerValue,
        startTick: Math.round(event.time * (100 / 60) * 128)
      });
      track.addEvent(controllerEvent);
    } else if (event.type === 'programChange') {
      const programChangeEvent = new MidiWriter.ProgramChangeEvent({
        instrument: event.programNumber,
        startTick: Math.round(event.time * (100 / 60) * 128)
      });
      track.addEvent(programChangeEvent);
    }
  });

  const write = new MidiWriter.Writer([track]);
  const midiFileData = write.buildFile();

  const blob = new Blob([midiFileData], { type: 'audio/midi' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${selectedSequence.name}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function transposeSelectedMemoryDown() {
  transposeSelectedMemory(-1);
}

function transposeSelectedMemoryUp() {
  transposeSelectedMemory(1);
}

function transposeSelectedMemory(semitones) {
  if (selectedMemoryIndex === null || selectedMemoryIndex >= memoryList.length) {
    alert('No memory selected to transpose.');
    return;
  }

  const sequence = memoryList[selectedMemoryIndex];
  const transposedNotes = sequence.notes.map(noteEvent => {
    const transposedNote = transposeNoteBySemitones(noteEvent.note, semitones);
    if (!transposedNote) {
      return null;
    }
    return {
      ...noteEvent,
      note: transposedNote
    };
  });

  if (transposedNotes.includes(null)) {
    alert('Transposition goes out of piano range.');
    return;
  }

  sequence.notes = transposedNotes;
  transposeAmount += semitones;
  document.getElementById('transpose-amount').textContent = transposeAmount;

  const selectedMemoryName = document.getElementById('selected-memory').textContent;
  if (selectedMemoryName === sequence.name) {
    recordedNotes = JSON.parse(JSON.stringify(sequence.notes));
  }

  processSequenceNotes(sequence);
  currentNoteIndex = -1;
}

function transposeNoteBySemitones(note, semitones) {
  const noteRegex = /^([A-G](?:#|b)?)(\d)$/;
  const match = note.match(noteRegex);
  if (!match) return null;

  let [_, noteName, octave] = match;
  octave = parseInt(octave);

  if (noteName === 'B#') {
    noteName = 'C';
    octave += 1;
  } else if (noteName === 'Cb') {
    noteName = 'B';
    octave -= 1;
  } else if (noteName === 'E#') {
    noteName = 'F';
  } else if (noteName === 'Fb') {
    noteName = 'E';
  }

  const noteOffsets = {
    'C': 0,
    'C#': 1,
    'Db': 1,
    'D': 2,
    'D#': 3,
    'Eb': 3,
    'E': 4,
    'F': 5,
    'F#': 6,
    'Gb': 6,
    'G': 7,
    'G#': 8,
    'Ab': 8,
    'A': 9,
    'A#': 10,
    'Bb': 10,
    'B': 11
  };

  let noteOffset = noteOffsets[noteName];
  if (noteOffset === undefined) return null;

  let midiNumber = octave * 12 + noteOffset;
  midiNumber += semitones;

  if (midiNumber < 0) return null;

  let newOctave = Math.floor(midiNumber / 12);
  let newNoteIndex = midiNumber % 12;

  if (newNoteIndex < 0) {
    newNoteIndex += 12;
    newOctave -= 1;
  }

  if (newOctave < startOctave || newOctave >= startOctave + totalOctaves) {
    return null;
  }

  const indexToNoteNames = {
    0: ['C'],
    1: ['C#', 'Db'],
    2: ['D'],
    3: ['D#', 'Eb'],
    4: ['E'],
    5: ['F'],
    6: ['F#', 'Gb'],
    7: ['G'],
    8: ['G#', 'Ab'],
    9: ['A'],
    10: ['A#', 'Bb'],
    11: ['B']
  };

  const originalIsFlat = noteName.includes('b');
  const possibleNoteNames = indexToNoteNames[newNoteIndex];
  let newNoteName;

  if (possibleNoteNames.length === 1) {
    newNoteName = possibleNoteNames[0];
  } else if (originalIsFlat) {
    newNoteName = possibleNoteNames.find(n => n.includes('b')) || possibleNoteNames[0];
  } else {
    newNoteName = possibleNoteNames.find(n => n.includes('#')) || possibleNoteNames[0];
  }

  return newNoteName + newOctave;
}

function startPlayback() {
  if (isPlaying || recordedNotes.length === 0) return;

  isPlaying = true;
  playbackStartTime = audioContext.currentTime;
  document.getElementById('stop-btn').disabled = false;
  document.getElementById('play-btn').disabled = true;

  const tempoFactor = tempoPercentage / 100;

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
        noteOn(noteEvent.note, noteEvent.velocity, false, noteEvent.fingering);
      }, (playbackTime - audioContext.currentTime) * 1000);
      playbackTimers.push(timerId);
    } else if (noteEvent.type === 'noteOff') {
      if (playbackTime < audioContext.currentTime) {
        return;
      }
      const timerId = setTimeout(() => {
        noteOff(noteEvent.note, false);
      }, (playbackTime - audioContext.currentTime) * 1000);
      playbackTimers.push(timerId);
    }
  });

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
      const startTime = filteredEvents[i].time;
      let j = i;
      while (j < filteredEvents.length && filteredEvents[j].time - filteredEvents[i].time <= 0.2) {
        if (filteredEvents[j].type === 'noteOn') {
          chordNotes.push(filteredEvents[j].note);
          chordFingerings[filteredEvents[j].note] = filteredEvents[j].fingering || 'N';
        }
        j++;
      }
      noteChordEvents.push({ notes: chordNotes, fingerings: chordFingerings, time: startTime });
      i = j;
    } else {
      i++;
    }
  }
}

function goToNextNoteOrChord() {
  if (!noteChordEvents.length) return;
  stopNavigationActiveNotes();
  currentNoteIndex = (currentNoteIndex + 1) % noteChordEvents.length;
  playChordAtIndex(currentNoteIndex);
}

function goToPreviousNoteOrChord() {
  if (!noteChordEvents.length) return;
  stopNavigationActiveNotes();
  currentNoteIndex = (currentNoteIndex - 1 + noteChordEvents.length) % noteChordEvents.length;
  playChordAtIndex(currentNoteIndex);
}

function playChordAtIndex(index) {
  const chordEvent = noteChordEvents[index];
  if (!chordEvent) return;

  stopNavigationActiveNotes();

  chordEvent.notes.forEach(note => {
    const fingering = chordEvent.fingerings[note];
    noteOnNavigation(note, fingering);
  });
}

function noteOnNavigation(note, fingering = 'N') {
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
}

function updateMemoryFromEditor() {
  if (selectedMemoryIndex === null) return;

  const selectedSequence = memoryList[selectedMemoryIndex];

  const memoryNameInput = document.getElementById('memory-name-input');
  if (memoryNameInput) {
    selectedSequence.name = memoryNameInput.value;
  }

  const events = [];
  const tableRows = document.getElementById('memory-editor-container').querySelectorAll('#memory-editor-table tr');
  for (let i = 1; i < tableRows.length; i++) {
    const row = tableRows[i];
    const timeInput = row.querySelector('.event-time');
    const eventTypeSelect = row.querySelector('.event-type');
    const eventParamsCell = row.querySelector('.event-params');
    const channelSelect = row.querySelector('.event-channel');

    const event = {
      time: parseFloat(timeInput.value),
      type: eventTypeSelect.value,
      channel: channelSelect.value,
    };

    if (event.type === 'noteOn' || event.type === 'noteOff') {
      const noteInput = eventParamsCell.querySelector('.event-note');
      event.note = normalizeNoteFromInput(noteInput.value);
      if (event.type === 'noteOn') {
        const velocityInput = eventParamsCell.querySelector('.event-velocity');
        event.velocity = parseInt(velocityInput.value) || 100;

        const fingeringSelect = eventParamsCell.querySelector('.event-fingering');
        event.fingering = fingeringSelect ? fingeringSelect.value : 'N';

        if (event.fingering.startsWith('L')) {
          event.channel = '1';
        } else if (event.fingering.startsWith('R')) {
          event.channel = '2';
        }
      }
    } else if (event.type === 'controlChange') {
      const ccNumberInput = eventParamsCell.querySelector('.event-controller-number');
      const ccValueInput = eventParamsCell.querySelector('.event-controller-value');
      event.controllerNumber = parseInt(ccNumberInput.value);
      event.controllerValue = parseInt(ccValueInput.value);
    } else if (event.type === 'programChange') {
      const programNumberInput = eventParamsCell.querySelector('.event-program-number');
      event.programNumber = parseInt(programNumberInput.value);
    }

    events.push(event);
  }

  const noteOnEventStackByNote = {};
  events.forEach(event => {
    if (event.type === 'noteOn') {
      if (!noteOnEventStackByNote[event.note]) {
        noteOnEventStackByNote[event.note] = [];
      }
      noteOnEventStackByNote[event.note].push(event);
    } else if (event.type === 'noteOff') {
      if (noteOnEventStackByNote[event.note] && noteOnEventStackByNote[event.note].length > 0) {
        const noteOnEvent = noteOnEventStackByNote[event.note].pop();
        event.channel = noteOnEvent.channel;
      }
    }
  });

  events.sort((a, b) => a.time - b.time);
  selectedSequence.notes = events;

  let totalDuration = 0;
  selectedSequence.notes.forEach(noteEvent => {
    if (noteEvent.time > totalDuration) {
      totalDuration = noteEvent.time;
    }
  });
  selectedSequence.duration = totalDuration;

  updateMemoryList();
  selectMemorySequence(selectedMemoryIndex);
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
            var range = quill.getSelection();
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
});

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

function clearActiveNotes() {
  for (const note in activeNotes) {
    if (activeNotes.hasOwnProperty(note)) {
      activeNotes[note].stop();
      highlightKey(note, false);
    }
  }
  activeNotes = {};
}

function clearApp() {
  stopAction();
  memoryList = [];
  sequenceCounter = 1;
  selectedMemoryIndex = null;
  recordedNotes = [];
  quill.setContents([]);
  document.getElementById('selected-memory').textContent = 'No Memory Selected';
  updateMemoryList();
}
