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
  B: '#FF00FF',    // magenta
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
let navigationActiveNotes = {}; // Added for navigation holding functionality

let midiAccessObject = null;
let selectedMidiInput = null;

// Add variables for keyboard play functionality
let keyboardEnabled = true;
const keyNoteMap = {
  'a': 'C4',
  'w': 'C#4',
  's': 'D4',
  'e': 'D#4',
  'd': 'E4',
  'f': 'F4',
  't': 'F#4',
  'g': 'G4',
  'y': 'G#4',
  'h': 'A4',
  'u': 'A#4',
  'j': 'B4',
  'k': 'C5',
};

// Add variable for note color functionality
let colorfulNotesEnabled = true;

let tempo = 100; // Default tempo in BPM

// Variables for navigation functionality
let noteChordEvents = [];
let currentNoteIndex = -1;

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
    key.addEventListener('mousedown', () => noteOn(key.dataset.note));
    key.addEventListener('mouseup', () => noteOff(key.dataset.note));
    key.addEventListener('mouseleave', () => noteOff(key.dataset.note));

    // Add touch events for mobile and tablet support
    key.addEventListener('touchstart', (e) => {
      e.preventDefault();
      noteOn(key.dataset.note);
    });
    key.addEventListener('touchend', (e) => {
      e.preventDefault();
      noteOff(key.dataset.note);
    });
    key.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      noteOff(key.dataset.note);
    });
  });
}

function noteOn(note) {
  if (activeNotes[note]) return;
  if (!pianoInstrument) return;

  const playedNote = pianoInstrument.play(note);
  activeNotes[note] = playedNote;
  highlightKey(note, true);

  if (isRecording) {
    recordedNotes.push({
      type: 'noteOn',
      note: note,
      time: audioContext.currentTime - recordStartTime
    });
  }
}

function noteOff(note) {
  if (!activeNotes[note]) return;

  activeNotes[note].stop();
  delete activeNotes[note];
  highlightKey(note, false);

  if (isRecording) {
    recordedNotes.push({
      type: 'noteOff',
      note: note,
      time: audioContext.currentTime - recordStartTime
    });
  }
}

function highlightKey(note, isPressed) {
  pianoKeys.forEach(key => {
    if (key.dataset.note === note) {
      if (isPressed) {
        if (colorfulNotesEnabled) {
          // Existing code for colorful notes
          const baseNote = note.replace(/[0-9]/g, '');
          if (baseNote.includes('#')) {
            // Black key
            const adjNotes = blackKeyAdjacency[baseNote];
            const color1 = noteColors[adjNotes[0]];
            const color2 = noteColors[adjNotes[1]];
            key.style.background = `linear-gradient(to top, ${color2} 50%, ${color1} 50%)`;
          } else {
            // White key
            const color = noteColors[baseNote];
            key.style.background = color;
          }
        } else {
          // Set to light blue
          key.style.background = 'lightblue';
        }
      } else {
        // Reset to default
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
  midiAccess.addEventListener('statechange', updateMIDIPortStatus);

  updateDeviceList();
  initDeviceControls();

  if (midiAccess.inputs.size > 0) {
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
  updateDeviceList();

  if (midiAccessObject.inputs.size > 0) {
    updateMIDIStatus('MIDI controllers available.', 'green');
  } else {
    updateMIDIStatus('No MIDI controller connected.', 'orange');
  }
}

function updateDeviceList() {
  const deviceListContainer = document.getElementById('device-list');
  deviceListContainer.innerHTML = '';

  midiAccessObject.inputs.forEach((input) => {
    const li = document.createElement('li');
    li.dataset.id = input.id;
    li.textContent = input.name;
    deviceListContainer.appendChild(li);
  });

  if (!selectedMidiInput || !midiAccessObject.inputs.has(selectedMidiInput.id)) {
    // Select the first available device
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

  const [command, noteNumber, velocity] = event.data;
  const note = midiNoteToName(noteNumber);
  if (note) {
    if (command === 144 && velocity > 0) { // Note On
      noteOn(note);
    } else if (command === 128 || (command === 144 && velocity === 0)) { // Note Off
      noteOff(note);
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
  const octave = Math.floor(noteNumber / 12) - 1;
  const noteIndex = noteNumber % 12;
  const noteName = noteNames[noteIndex];
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
  
  // Add event listeners for navigation buttons
  const prevNoteBtn = document.getElementById('prev-note-btn');
  const nextNoteBtn = document.getElementById('next-note-btn');

  prevNoteBtn.addEventListener('click', goToPreviousNoteOrChord);
  nextNoteBtn.addEventListener('click', goToNextNoteOrChord);
}

function startRecording() {
  if (isRecording) return; // Already recording
  isRecording = true;
  recordedNotes = [];
  recordStartTime = audioContext.currentTime;
  const recordBtn = document.getElementById('record-btn');
  recordBtn.classList.add('pressed');
  document.getElementById('play-btn').disabled = true;
  document.getElementById('save-btn').disabled = true;
  document.getElementById('stop-btn').disabled = false; // Enable the stop button during recording

  const selectedMemories = memoryList.filter(sequence => sequence.selected);
  if (selectedMemories.length > 0) {
    let totalOffsetTime = 0;
    const combinedNotes = [];
    selectedMemories.forEach(sequence => {
      sequence.notes.forEach(noteEvent => {
        combinedNotes.push({
          type: noteEvent.type,
          note: noteEvent.note,
          time: noteEvent.time + totalOffsetTime
        });
      });
      if (sequence.notes.length > 0) {
        const lastEventTime = sequence.notes[sequence.notes.length - 1].time;
        totalOffsetTime += lastEventTime + 1; // Add 1 second gap between sequences
      }
    });

    const tempoInput = document.getElementById('tempo-input');
    tempo = parseInt(tempoInput.value) || 100;
    const tempoScale = 100 / tempo;

    const scaledNotes = combinedNotes.map(noteEvent => ({
      ...noteEvent,
      time: noteEvent.time * tempoScale
    }));

    playNotesDuringRecording(scaledNotes);
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
          noteOn(noteEvent.note);
        } else if (noteEvent.type === 'noteOff') {
          noteOff(noteEvent.note);
        }
        recordedNotes.push({
          type: noteEvent.type,
          note: noteEvent.note,
          time: audioContext.currentTime - recordStartTime
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
  }
  if (isPlaying) {
    isPlaying = false;
    playbackTimers.forEach(timerId => clearTimeout(timerId));
    playbackTimers = [];
    document.getElementById('stop-btn').disabled = true;
    document.getElementById('play-btn').disabled = false;
  }
  // Stop any notes held by navigation buttons
  stopNavigationActiveNotes();
  // Reset any keybed note to its default color value
  clearActiveNotes();
}

function startPlayback() {
  if (isPlaying) return;

  const tempoInput = document.getElementById('tempo-input');
  tempo = parseInt(tempoInput.value) || 100;

  const selectedMemories = memoryList.filter(sequence => sequence.selected);
  if (selectedMemories.length === 0) {
    return;
  }

  isPlaying = true;
  playbackStartTime = audioContext.currentTime;
  document.getElementById('stop-btn').disabled = false;
  document.getElementById('play-btn').disabled = true;

  playSelectedMemories(selectedMemories);
}

function playSelectedMemories(sequencesToPlay) {
  if (!isPlaying) return;

  let totalOffsetTime = 0;
  const scheduledEvents = [];
  const tempoScale = 100 / tempo; // Scale factor based on default tempo of 100 BPM

  sequencesToPlay.forEach(sequence => {
    const sequenceStartTime = totalOffsetTime * tempoScale;

    // Schedule the update of selected-memory display and editor content
    const timeUntilSequenceStart = sequenceStartTime - (audioContext.currentTime - playbackStartTime);
    const displayTimer = setTimeout(() => {
      if (!isPlaying) return;
      document.getElementById('selected-memory').textContent = sequence.name;
      quill.setContents(sequence.editorContent);
    }, Math.max(0, timeUntilSequenceStart * 1000));
    playbackTimers.push(displayTimer);

    // Schedule note events
    sequence.notes.forEach(noteEvent => {
      scheduledEvents.push({
        type: noteEvent.type,
        note: noteEvent.note,
        time: (noteEvent.time + totalOffsetTime) * tempoScale
      });
    });

    if (sequence.notes.length > 0) {
      const lastEventTime = sequence.notes[sequence.notes.length - 1].time;
      totalOffsetTime += lastEventTime + 1; // Add 1 second gap between sequences
    }
  });

  scheduledEvents.sort((a, b) => a.time - b.time);

  let eventIndex = 0;

  const scheduleNextEvent = () => {
    if (!isPlaying) return;

    if (eventIndex >= scheduledEvents.length) {
      if (isLooping) {
        // Restart playback from the beginning
        eventIndex = 0;
        playbackStartTime = audioContext.currentTime;
        playSelectedMemories(sequencesToPlay); // Restart the playback
        return;
      } else {
        // Playback finished
        isPlaying = false;
        playbackTimers = [];
        document.getElementById('stop-btn').disabled = true;
        document.getElementById('play-btn').disabled = false;
        return;
      }
    }

    const noteEvent = scheduledEvents[eventIndex];
    const timeUntilEvent = noteEvent.time - (audioContext.currentTime - playbackStartTime);

    const noteTimer = setTimeout(() => {
      if (!isPlaying) return;
      if (noteEvent.type === 'noteOn') {
        noteOn(noteEvent.note);
      } else if (noteEvent.type === 'noteOff') {
        noteOff(noteEvent.note);
      }
      eventIndex++;
      scheduleNextEvent();
    }, Math.max(0, timeUntilEvent * 1000));

    playbackTimers.push(noteTimer);
  };

  scheduleNextEvent();
}

function initMemoryControls() {
  const addToMemoryBtn = document.getElementById('add-memory-btn');
  const removeFromMemoryBtn = document.getElementById('remove-memory-btn');
  const memorySelect = document.getElementById('memory-list');
  const addEditorContentBtn = document.getElementById('add-editor-content-btn');
  const memoryToggleBtn = document.getElementById('memory-toggle-btn');
  const memoryPlayBtn = document.getElementById('memory-play-btn');

  addToMemoryBtn.addEventListener('click', addToMemory);
  removeFromMemoryBtn.addEventListener('click', removeFromMemory);
  memorySelect.addEventListener('click', function(event) {
    if (event.target && event.target.nodeName === 'SPAN') {
      const index = event.target.parentElement.querySelector('input[type="checkbox"]').dataset.index;
      selectMemorySequence(index);
      toggleMemoryList();
    }
  });
  addEditorContentBtn.addEventListener('click', addEditorContentToMemory);
  memoryToggleBtn.addEventListener('click', toggleMemoryList);
  memoryPlayBtn.addEventListener('click', startPlayback);
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
      memoryList[index].selected = e.target.checked;
    });

    const label = document.createElement('span');
    label.textContent = sequence.name;

    li.appendChild(checkbox);
    li.appendChild(label);
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
    quill.setContents(selectedSequence.editorContent);
    document.getElementById('play-btn').disabled = false;
    document.getElementById('selected-memory').textContent = selectedSequence.name;

    // Process the selected sequence's notes to create noteChordEvents
    processSequenceNotes(selectedSequence);
    currentNoteIndex = -1; // Reset navigation index
  }
}

function addToMemory() {
  if (recordedNotes.length === 0) {
    return;
  }

  const maxNameLength = 30;
  let sequenceName = `Sequence ${sequenceCounter}`;

  const sequenceData = {
    name: sequenceName,
    notes: JSON.parse(JSON.stringify(recordedNotes)),
    editorContent: quill.getContents(),
    selected: false
  };
  memoryList.push(sequenceData);
  updateMemoryList();
  sequenceCounter++;
  document.getElementById('play-btn').disabled = false;
  selectMemorySequence(memoryList.length - 1);
}

function removeFromMemory() {
  const selectedMemoryName = document.getElementById('selected-memory').textContent;
  const index = memoryList.findIndex(sequence => sequence.name === selectedMemoryName);

  if (index >= 0) {
    const removedSequence = memoryList.splice(index, 1)[0];
    updateMemoryList();
    if (memoryList.length === 0) {
      document.getElementById('selected-memory').textContent = 'No Memory Selected';
    } else {
      selectMemorySequence(index >= memoryList.length ? memoryList.length - 1 : index);
    }
    if (memoryList.length === 0) {
      document.getElementById('play-btn').disabled = true;
    }
  } else {
    // No sequence selected to remove
  }
}

function addEditorContentToMemory() {
  const selectedMemoryName = document.getElementById('selected-memory').textContent;
  const index = memoryList.findIndex(sequence => sequence.name === selectedMemoryName);
  if (index >= 0) {
    const selectedSequence = memoryList[index];
    selectedSequence.editorContent = quill.getContents();
  } else {
    // No memory sequence selected to add editor content
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

function saveMemoryList() {
  const data = {
    memoryList: memoryList
  };
  const dataString = JSON.stringify(data);
  const blob = new Blob([dataString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'memoryList.json';
  a.click();
  URL.revokeObjectURL(url);
}

function loadMemoryList() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const data = JSON.parse(event.target.result);
        if (data && data.memoryList) {
          memoryList = memoryList.concat(data.memoryList);
          updateMemoryList();
          document.getElementById('play-btn').disabled = memoryList.length === 0;
        }
      } catch (err) {
        console.error('Invalid memory list file.', err);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function clearApp() {
  isRecording = false;
  isPlaying = false;
  recordedNotes = [];
  recordStartTime = null;
  playbackStartTime = null;
  recordingTimers.forEach(timerId => clearTimeout(timerId));
  recordingTimers = [];
  playbackTimers.forEach(timerId => clearTimeout(timerId));
  playbackTimers = [];
  memoryList = [];
  sequenceCounter = 1;
  updateMemoryList();
  quill.setContents([]);
  document.getElementById('play-btn').disabled = true;
  document.getElementById('stop-btn').disabled = true;
  document.getElementById('save-btn').disabled = false;
  const recordBtn = document.getElementById('record-btn');
  recordBtn.classList.remove('pressed');
  clearActiveNotes();
  document.getElementById('selected-memory').textContent = 'No Memory Selected';
}

function clearActiveNotes() {
  for (const note in activeNotes) {
    if (activeNotes.hasOwnProperty(note)) {
      activeNotes[note].stop();
    }
  }
  activeNotes = {};
  pianoKeys.forEach(key => {
    key.style.background = '';
    key.classList.remove('pressed');
  });
}

// Add event listeners for keyboard events
function initKeyboardControls() {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();

  // Handle Spacebar shortcut for stop/play
  if (event.key === ' ' && !event.repeat) {
    event.preventDefault();
    if (isRecording || isPlaying) {
      stopAction();
    } else {
      startPlayback();
    }
    return;
  }

  // Handle Record key shortcut
  if (key === 'r' && !event.repeat) {
    event.preventDefault();
    startRecording();
    return;
  }

  // Handle Left/Right Arrow keys for memory navigation
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

  if (!keyboardEnabled) return;
  const note = keyNoteMap[key];
  if (note && !event.repeat) {
    event.preventDefault();
    if (!activeNotes[note]) {
      noteOn(note);
    }
  }
}

function handleKeyUp(event) {
  if (!keyboardEnabled) return;
  const key = event.key.toLowerCase();
  const note = keyNoteMap[key];
  if (note) {
    event.preventDefault();
    noteOff(note);
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

function stopNavigationActiveNotes() {
  for (const note in navigationActiveNotes) {
    if (navigationActiveNotes.hasOwnProperty(note)) {
      navigationActiveNotes[note].stop();
      highlightKey(note, false);
    }
  }
  navigationActiveNotes = {};
}

function processSequenceNotes(sequence) {
  noteChordEvents = [];
  const events = sequence.notes;
  if (events.length === 0) return;

  let i = 0;
  while (i < events.length) {
    if (events[i].type === 'noteOn') {
      const chordNotes = [events[i].note];
      const startTime = events[i].time;
      let j = i + 1;
      while (j < events.length && events[j].time - events[i].time <= 0.2) { // 200ms threshold
        if (events[j].type === 'noteOn') {
          chordNotes.push(events[j].note);
        }
        j++;
      }
      noteChordEvents.push({ notes: chordNotes, time: startTime });
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

  // Stop any currently held navigation notes
  stopNavigationActiveNotes();

  // Play the new chord and hold the notes
  chordEvent.notes.forEach(note => {
    noteOnNavigation(note);
  });
}

function noteOnNavigation(note) {
  if (navigationActiveNotes[note]) return;
  if (!pianoInstrument) return;

  const playedNote = pianoInstrument.play(note);
  navigationActiveNotes[note] = playedNote;
  highlightKey(note, true);
}

function noteOffNavigation(note) {
  if (!navigationActiveNotes[note]) return;
  navigationActiveNotes[note].stop();
  delete navigationActiveNotes[note];
  highlightKey(note, false);
}

document.addEventListener('DOMContentLoaded', () => {
  createPiano();
  initMIDI();

  // Define custom fonts including musical fonts
  const fontNames = [
    'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Comic Sans MS',
    'Palatino Linotype', 'Lucida Console', 'Lucida Sans Unicode', 'Garamond', 'Bookman', 'Helvetica', 'Gill Sans',
    'Optima', 'Calibri', 'Candara', 'Century Gothic', 'Franklin Gothic Medium', 'Futura', 'Geneva', 'Rockwell',
    'Baskerville', 'Bodoni MT', 'Brush Script MT', 'Didot', 'Goudy Old Style', 'Perpetua', 'Symbol', 'Copperplate',
    'Papyrus', 'Segoe UI', 'Segoe Print', 'Segoe Script', 'Arial Black', 'Arial Narrow', 'Lucida Grande', 'Consolas',
    'Monaco', 'Menlo', 'Helvetica Neue', 'Courier', 'Cochin', 'Arial Rounded MT Bold', 'Bradley Hand', 'Snell Roundhand',
    'Chalkduster', 'Hiragino Maru Gothic Pro', 'Apple Chancery', 'Luminari', 'Marker Felt', 'Noteworthy', 'Zapfino',
    'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Roboto Condensed', 'Source Sans Pro', 'Raleway', 'Slabo 27px',
    'PT Sans', 'Noto Music' // Musical font
  ];

  // Register fonts with Quill
  const Font = Quill.import('formats/font');
  Font.whitelist = fontNames.map(font => font.replace(/\s+/g, '-'));
  Quill.register(Font, true);

  // Define custom sizes in points
  const Size = Quill.import('attributors/style/size');
  Size.whitelist = ['8pt', '10pt', '12pt', '14pt', '18pt', '24pt', '36pt', '48pt', '72pt'];
  Quill.register(Size, true);

  // Initialize Quill editor with custom fonts and sizes
  quill = new Quill('#editor', {
    modules: {
      toolbar: '#toolbar'
    },
    theme: 'snow',
  });

  // Populate font options
  const fontSelect = document.querySelector('select.ql-font');
  fontNames.forEach(fontName => {
    const option = document.createElement('option');
    option.value = fontName.replace(/\s+/g, '-');
    option.textContent = fontName;
    option.style.fontFamily = fontName;
    fontSelect.appendChild(option);
  });

  // Populate size options
  const sizeSelect = document.querySelector('select.ql-size');
  ['8pt', '10pt', '12pt', '14pt', '18pt', '24pt', '36pt', '48pt', '72pt'].forEach(size => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size;
    sizeSelect.appendChild(option);
  });

  // Populate color options
  const pianoNoteColors = ['#FF0000', '#FFA500', '#FFFF00', '#008000', '#0000FF', '#6109AB', '#FF00FF'];
  const colors = [
    '#000000', '#e60000', '#ff9900', '#ffff00', '#008a00', '#0066cc', '#9933ff',
    '#ffffff', '#facccc', '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff',
    '#dddddd', '#ff0000', '#ff9c00', '#ffff00', '#00ff00', '#0000ff', '#cc66ff',
    '#eeeeee', '#ffcccc', '#ffe5cc', '#ffffcc', '#d9f2d9', '#ccd4ff', '#e6ccff',
    'magenta', // Added magenta color
    ...pianoNoteColors
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

  // Add event listener for the note color toggle button
  const noteColorToggleBtn = document.getElementById('note-color-toggle-btn');
  noteColorToggleBtn.style.background = 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)';
  noteColorToggleBtn.classList.add('pressed');

  noteColorToggleBtn.addEventListener('click', () => {
    colorfulNotesEnabled = !colorfulNotesEnabled;
    if (colorfulNotesEnabled) {
      noteColorToggleBtn.style.background = 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)';
      noteColorToggleBtn.classList.add('pressed');
    } else {
      noteColorToggleBtn.style.background = 'lightblue';
      noteColorToggleBtn.classList.remove('pressed');
    }
    // Update the appearance of notes currently pressed
    for (const note in activeNotes) {
      if (activeNotes.hasOwnProperty(note)) {
        highlightKey(note, true);
      }
    }
  });

  // Add event listener for the loop button
  const loopBtn = document.getElementById('loop-btn');
  loopBtn.addEventListener('click', () => {
    isLooping = !isLooping;
    loopBtn.classList.toggle('pressed', isLooping);
  });

});
