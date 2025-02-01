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
let chords = [];
let chordIndex = -1;

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
let playbackTimer;
let memoryList = [];
let sequenceCounter = 1;
let selectedMemoryIndex = null;

let midiAccessObject = null;
let selectedMidiInput = null;

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
  deviceListContainer.style.display = deviceListContainer.style.display === 'block' ? 'none' : 'block';
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
}

function stopAction() {
  const stopBtn = document.getElementById('stop-btn');
  if (isRecording) {
    isRecording = false;
    const recordBtn = document.getElementById('record-btn');
    recordBtn.classList.remove('pressed');
    document.getElementById('play-btn').disabled = false;
    document.getElementById('save-btn').disabled = false;
  }
  if (isPlaying) {
    isPlaying = false;
    clearTimeout(playbackTimer);
    document.getElementById('play-btn').disabled = false;
  }
  stopAllNotes();
  chordIndex = -1;

  if (!isRecording && !isPlaying) {
    stopBtn.disabled = true;
  }
}

function startPlayback() {
  if (isPlaying || recordedNotes.length === 0) return;
  isPlaying = true;
  playbackStartTime = audioContext.currentTime;
  document.getElementById('stop-btn').disabled = false;
  document.getElementById('play-btn').disabled = true;
  playSequence();
}

function initMemoryControls() {
  const addToMemoryBtn = document.getElementById('add-memory-btn');
  const removeFromMemoryBtn = document.getElementById('remove-memory-btn');
  const memorySelect = document.getElementById('memory-list');
  const addEditorContentBtn = document.getElementById('add-editor-content-btn');
  const memoryToggleBtn = document.getElementById('memory-toggle-btn');
  const memoryPlayBtn = document.getElementById('memory-play-btn');
  const memoryPrevBtn = document.getElementById('memory-prev-btn');
  const memoryNextBtn = document.getElementById('memory-next-btn');

  addToMemoryBtn.addEventListener('click', addToMemory);
  removeFromMemoryBtn.addEventListener('click', removeFromMemory);
  memorySelect.addEventListener('click', function(event) {
    if (event.target && event.target.nodeName === 'LI') {
      const index = event.target.dataset.index;
      selectMemorySequence(index);
      toggleMemoryList();
    }
  });
  addEditorContentBtn.addEventListener('click', addEditorContentToMemory);
  memoryToggleBtn.addEventListener('click', toggleMemoryList);
  memoryPlayBtn.addEventListener('click', () => {
    if (memoryList.length > 0 && selectedMemoryIndex !== null) {
      playMemorySequences(selectedMemoryIndex);
    } else {
      alert('No memory sequence selected to play.');
    }
  });
  memoryPrevBtn.addEventListener('click', playPreviousChord);
  memoryNextBtn.addEventListener('click', playNextChord);

  updateMemoryList();
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
    li.dataset.index = index;
    li.textContent = sequence.name;
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

    chords = processChords(recordedNotes);
    chordIndex = -1;
  }
}

function processChords(notes) {
  let chords = [];
  let currentChord = null;
  let previousTime = null;

  for (let i = 0; i < notes.length; i++) {
    const noteEvent = notes[i];
    if (noteEvent.type === 'noteOn') {
      if (currentChord === null || previousTime === null || (noteEvent.time - previousTime) > 0.1) {
        currentChord = {
          time: noteEvent.time,
          notes: [noteEvent.note],
        };
        chords.push(currentChord);
      } else {
        currentChord.notes.push(noteEvent.note);
      }
      previousTime = noteEvent.time;
    }
  }
  return chords;
}

function addToMemory() {
  if (recordedNotes.length === 0) {
    alert('No recording available to add to memory.');
    return;
  }

  const sequenceName = prompt('Enter a name for this sequence:', `Sequence ${sequenceCounter}`);
  if (sequenceName !== null) {
    const sequenceData = {
      name: sequenceName,
      notes: JSON.parse(JSON.stringify(recordedNotes)),
      editorContent: quill.getContents()
    };
    memoryList.push(sequenceData);
    updateMemoryList();
    sequenceCounter++;
    document.getElementById('play-btn').disabled = false;
    selectMemorySequence(memoryList.length - 1);
    alert(`"${sequenceName}" has been added to memory.`);
  }
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
    alert(`"${removedSequence.name}" has been removed from memory.`);
    if (memoryList.length === 0) {
      document.getElementById('play-btn').disabled = true;
    }
  } else {
    alert('No sequence selected to remove.');
  }
}

function addEditorContentToMemory() {
  const selectedMemoryName = document.getElementById('selected-memory').textContent;
  const index = memoryList.findIndex(sequence => sequence.name === selectedMemoryName);
  if (index >= 0) {
    const selectedSequence = memoryList[index];
    selectedSequence.editorContent = quill.getContents();
    alert(`Editor content has been added to "${selectedSequence.name}".`);
  } else {
    alert('No memory sequence selected to add editor content.');
  }
}

function stopPlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  clearTimeout(playbackTimer);
  document.getElementById('stop-btn').disabled = true;
  document.getElementById('play-btn').disabled = false;
}

function playSequence() {
  if (!isPlaying) return;

  let currentTime = audioContext.currentTime - playbackStartTime;
  let eventIndex = 0;

  const scheduleNextEvent = () => {
    if (!isPlaying || eventIndex >= recordedNotes.length) {
      isPlaying = false;
      document.getElementById('stop-btn').disabled = true;
      document.getElementById('play-btn').disabled = false;
      return;
    }

    const noteEvent = recordedNotes[eventIndex];
    const timeUntilEvent = noteEvent.time - (audioContext.currentTime - playbackStartTime);

    playbackTimer = setTimeout(() => {
      if (noteEvent.type === 'noteOn') {
        noteOn(noteEvent.note);
      } else if (noteEvent.type === 'noteOff') {
        noteOff(noteEvent.note);
      }
      eventIndex++;
      scheduleNextEvent();
    }, Math.max(0, timeUntilEvent * 1000));
  };

  scheduleNextEvent();
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
  if (playbackTimer) {
    clearTimeout(playbackTimer);
  }
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

function initKeyboardControls() {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
}

function handleKeyDown(event) {
  if (!keyboardEnabled) return;
  const key = event.key.toLowerCase();
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

const keyboardToggleBtn = document.getElementById('keyboard-toggle-btn');
keyboardToggleBtn.addEventListener('click', () => {
  keyboardEnabled = !keyboardEnabled;
  keyboardToggleBtn.classList.toggle('pressed', keyboardEnabled);
});

function playMemorySequences(startIndex) {
  if (!isPlaying) {
    isPlaying = true;
    playbackStartTime = audioContext.currentTime;
    document.getElementById('stop-btn').disabled = false;
    document.getElementById('play-btn').disabled = true;

    let totalOffsetTime = 0;
    const sequencesToPlay = memoryList.slice(startIndex);
    let scheduledEvents = [];

    sequencesToPlay.forEach(sequence => {
      sequence.notes.forEach(noteEvent => {
        scheduledEvents.push({
          type: noteEvent.type,
          note: noteEvent.note,
          time: noteEvent.time + totalOffsetTime
        });
      });
      if (sequence.notes.length > 0) {
        const lastEventTime = sequence.notes[sequence.notes.length - 1].time;
        totalOffsetTime += lastEventTime + 1;
      }
    });

    let eventIndex = 0;

    const scheduleNextEvent = () => {
      if (!isPlaying || eventIndex >= scheduledEvents.length) {
        isPlaying = false;
        document.getElementById('stop-btn').disabled = true;
        document.getElementById('play-btn').disabled = false;
        return;
      }

      const noteEvent = scheduledEvents[eventIndex];
      const timeUntilEvent = noteEvent.time - (audioContext.currentTime - playbackStartTime);

      playbackTimer = setTimeout(() => {
        if (noteEvent.type === 'noteOn') {
          noteOn(noteEvent.note);
        } else if (noteEvent.type === 'noteOff') {
          noteOff(noteEvent.note);
        }
        eventIndex++;
        scheduleNextEvent();
      }, Math.max(0, timeUntilEvent * 1000));
    };

    scheduleNextEvent();
  }
}

function playPreviousChord() {
  if (chordIndex > 0) {
    stopAllNotes();
    chordIndex--;
    playChordAtIndex(chordIndex);
  }
}

function playNextChord() {
  if (chordIndex < chords.length - 1) {
    stopAllNotes();
    chordIndex++;
    playChordAtIndex(chordIndex);
  }
}

function playChordAtIndex(index) {
  if (index >= 0 && index < chords.length) {
    const chord = chords[index];
    chord.notes.forEach(note => {
      noteOn(note);
    });
  }
}

function stopAllNotes() {
  const notesToStop = Object.keys(activeNotes);
  notesToStop.forEach(note => {
    noteOff(note);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  createPiano();
  initMIDI();

  quill = new Quill('#editor', {
    modules: {
      toolbar: '#toolbar',
    },
    theme: 'snow',
  });

  initSequencerControls();
  initKeyboardControls();
});
