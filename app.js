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
let navigationActiveNotes = {};

let midiAccessObject = null;
let selectedMidiInput = null;

let keyboardEnabled = true; 
let keyboardOctave = 4; // Default octave for keyboard input
const keyNoteMap = {
  'a': 'C',
  'w': 'C#',
  's': 'D',
  'e': 'D#',
  'd': 'E',
  'f': 'F',
  't': 'F#',
  'g': 'G',
  'y': 'G#',
  'h': 'A',
  'u': 'A#',
  'j': 'B',
  'k': 'C',
};

let colorfulNotesEnabled = false;

const tempoSlider = document.getElementById('tempo-slider');
const tempoValueDisplay = document.getElementById('tempo-value');
let tempo = parseInt(tempoSlider.value) || 100;

tempoSlider.addEventListener('input', () => {
  tempo = parseInt(tempoSlider.value);
  tempoValueDisplay.textContent = tempo + ' BPM';
});

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
          const baseNote = note.replace(/[0-9]/g, '');
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
    if (command === 144 && velocity > 0) { 
      noteOn(note);
    } else if (command === 128 || (command === 144 && velocity === 0)) { 
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
  
  const prevNoteBtn = document.getElementById('prev-note-btn');
  const nextNoteBtn = document.getElementById('next-note-btn');

  prevNoteBtn.addEventListener('click', goToPreviousNoteOrChord);
  nextNoteBtn.addEventListener('click', goToNextNoteOrChord);
}

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
        totalOffsetTime += lastEventTime + 1; 
      }
    });

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

    const playBtn = document.getElementById('play-btn');
    playBtn.classList.remove('pressed');
  }
  stopNavigationActiveNotes();
  clearActiveNotes();
}

function startPlayback() {
  if (isPlaying) return;

  const selectedMemories = memoryList.filter(sequence => sequence.selected);
  if (selectedMemories.length === 0) {
    return;
  }

  isPlaying = true;
  playbackStartTime = audioContext.currentTime;
  document.getElementById('stop-btn').disabled = false;
  document.getElementById('play-btn').disabled = true;

  const playBtn = document.getElementById('play-btn');
  playBtn.classList.add('pressed');

  playSelectedMemories(selectedMemories);
}

function playSelectedMemories(sequencesToPlay) {
  if (!isPlaying) return;

  let totalOffsetTime = 0;
  const scheduledEvents = [];
  const tempoScale = 100 / tempo; 

  sequencesToPlay.forEach(sequence => {
    const sequenceStartTime = totalOffsetTime * tempoScale;

    const timeUntilSequenceStart = sequenceStartTime - (audioContext.currentTime - playbackStartTime);
    const displayTimer = setTimeout(() => {
      if (!isPlaying) return;
      document.getElementById('selected-memory').textContent = sequence.name;
      quill.setContents(sequence.editorContent);
    }, Math.max(0, timeUntilSequenceStart * 1000));
    playbackTimers.push(displayTimer);

    sequence.notes.forEach(noteEvent => {
      scheduledEvents.push({
        type: noteEvent.type,
        note: noteEvent.note,
        time: (noteEvent.time + totalOffsetTime) * tempoScale
      });
    });

    if (sequence.notes.length > 0) {
      const lastEventTime = sequence.notes[sequence.notes.length - 1].time;
      totalOffsetTime += lastEventTime + 1; 
    }
  });

  scheduledEvents.sort((a, b) => a.time - b.time);

  let eventIndex = 0;

  const scheduleNextEvent = () => {
    if (!isPlaying) return;

    if (eventIndex >= scheduledEvents.length) {
      if (isLooping) {
        eventIndex = 0;
        playbackStartTime = audioContext.currentTime;
        playSelectedMemories(sequencesToPlay); 
        return;
      } else {
        isPlaying = false;
        playbackTimers = [];
        document.getElementById('stop-btn').disabled = true;
        document.getElementById('play-btn').disabled = false;
        const playBtn = document.getElementById('play-btn');
        playBtn.classList.remove('pressed');
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
  const editMemoryBtn = document.getElementById('edit-memory-btn');
  const memorySelect = document.getElementById('memory-list');
  const addEditorContentBtn = document.getElementById('add-editor-content-btn');
  const memoryToggleBtn = document.getElementById('memory-toggle-btn');

  addToMemoryBtn.addEventListener('click', addToMemory);
  removeFromMemoryBtn.addEventListener('click', removeFromMemory);
  editMemoryBtn.addEventListener('click', editMemoryName);
  memorySelect.addEventListener('click', function(event) {
    if (event.target && event.target.nodeName === 'SPAN') {
      const index = event.target.parentElement.querySelector('input[type="checkbox"]').dataset.index;
      selectMemorySequence(index);
      toggleMemoryList();
    }
  });
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

    processSequenceNotes(selectedSequence);
    currentNoteIndex = -1; 
  }
}

function addToMemory() {
  if (recordedNotes.length === 0) {
    return;
  }

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

  if (key >= '1' && key <= '6' && !event.repeat) {
    event.preventDefault();
    keyboardOctave = parseInt(key);
    return;
  }

  if (!keyboardEnabled) return;
  const noteBase = keyNoteMap[key];
  if (noteBase && !event.repeat) {
    event.preventDefault();
    const note = noteBase + keyboardOctave;
    if (!activeNotes[note]) {
      noteOn(note);
    }
  }
}

function handleKeyUp(event) {
  if (isInputFocused()) return;

  if (!keyboardEnabled) return;
  const key = event.key.toLowerCase();
  const noteBase = keyNoteMap[key];
  if (noteBase) {
    event.preventDefault();
    const note = noteBase + keyboardOctave;
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
      while (j < events.length && events[j].time - events[i].time <= 0.2) { 
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

  stopNavigationActiveNotes();

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

function editMemoryName() {
  if (selectedMemoryIndex === null) {
    return;
  }

  const selectedMemoryDisplay = document.getElementById('selected-memory');
  const currentName = selectedMemoryDisplay.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.style.width = '100%';
  input.style.boxSizing = 'border-box';

  selectedMemoryDisplay.parentNode.replaceChild(input, selectedMemoryDisplay);

  input.focus();
  input.select();

  function handleBlur() {
    input.removeEventListener('blur', handleBlur);
    input.removeEventListener('keydown', handleKeyDown);
    saveNewMemoryName(input.value, input);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      input.removeEventListener('blur', handleBlur);
      input.removeEventListener('keydown', handleKeyDown);
      saveNewMemoryName(input.value, input);
    } else if (e.key === 'Escape') {
      input.removeEventListener('blur', handleBlur);
      input.removeEventListener('keydown', handleKeyDown);
      cancelEditMemoryName(currentName, input);
    }
  }

  input.addEventListener('blur', handleBlur);
  input.addEventListener('keydown', handleKeyDown);
}

function saveNewMemoryName(newName, input) {
  if (selectedMemoryIndex !== null) {
    memoryList[selectedMemoryIndex].name = newName;
    updateMemoryList(); 

    const selectedMemoryDisplay = document.createElement('span');
    selectedMemoryDisplay.id = 'selected-memory';
    selectedMemoryDisplay.textContent = newName;
    if (input.parentNode) {
      input.parentNode.replaceChild(selectedMemoryDisplay, input);
    }
  }
}

function cancelEditMemoryName(originalName, input) {
  const selectedMemoryDisplay = document.createElement('span');
  selectedMemoryDisplay.id = 'selected-memory';
  selectedMemoryDisplay.textContent = originalName;
  if (input.parentNode) {
    input.parentNode.replaceChild(selectedMemoryDisplay, input);
  }
}

function exportSelectedMemoryAsMidi() {
  if (selectedMemoryIndex === null) {
    alert('No memory selected to export.');
    return;
  }

  const selectedSequence = memoryList[selectedMemoryIndex];

  // Create a new track
  const track = new MidiWriter.Track();

  // Set tempo
  track.setTempo(tempo);

  // Process the recorded notes to get events with durations
  let noteOnEvents = {};
  const events = selectedSequence.notes;

  events.forEach(event => {
    if (event.type === 'noteOn') {
      noteOnEvents[event.note] = event.time;
    } else if (event.type === 'noteOff') {
      if (noteOnEvents[event.note] !== undefined) {
        const startTime = noteOnEvents[event.note];
        const duration = event.time - startTime;

        // Calculate start tick and duration in ticks (assuming 128 ticks per beat)
        const startTick = Math.round(startTime * (tempo / 60) * 128);
        const durationTicks = Math.round(duration * (tempo / 60) * 128) || 1;

        const noteEvent = new MidiWriter.NoteEvent({
          pitch: [event.note],
          duration: 'T' + durationTicks,
          startTick: startTick
        });
        track.addEvent(noteEvent);

        delete noteOnEvents[event.note];
      }
    }
  });

  // Create a writer and build the MIDI file
  const write = new MidiWriter.Writer([track]);
  const midiFileData = write.buildFile();

  // Create a Blob from the MIDI data
  const blob = new Blob([midiFileData], { type: 'audio/midi' });

  // Trigger download of the MIDI file
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${selectedSequence.name}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  createPiano();
  initMIDI();

  const fontNames = [
    'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Comic Sans MS',
    'Palatino Linotype', 'Lucida Console', 'Lucida Sans Unicode', 'Garamond', 'Bookman', 'Helvetica', 'Gill Sans',
    'Optima', 'Calibri', 'Candara', 'Century Gothic', 'Franklin Gothic Medium', 'Futura', 'Geneva', 'Rockwell',
    'Baskerville', 'Bodoni MT', 'Brush Script MT', 'Didot', 'Goudy Old Style', 'Perpetua', 'Symbol', 'Copperplate',
    'Papyrus', 'Segoe UI', 'Segoe Print', 'Segoe Script', 'Arial Black', 'Arial Narrow', 'Lucida Grande', 'Consolas',
    'Monaco', 'Menlo', 'Helvetica Neue', 'Courier', 'Cochin', 'Arial Rounded MT Bold', 'Bradley Hand', 'Snell Roundhand',
    'Chalkduster', 'Hiragino Maru Gothic Pro', 'Apple Chancery', 'Luminari', 'Marker Felt', 'Noteworthy', 'Zapfino',
    'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Roboto Condensed', 'Source Sans Pro', 'Raleway', 'Slabo 27px',
    'PT Sans', 'Noto Music',
    'Merriweather', 'Ubuntu', 'Playfair Display', 'Fira Sans', 'Poppins', 'Nunito', 'PT Serif', 'Noto Sans', 'Inconsolata', 'Cabin',
    'Droid Sans', 'Roboto Mono', 'Muli', 'Indie Flower', 'Pacifico', 'Lobster', 'Dancing Script', 'Shadows Into Light',
    'Lora', 'Karla', 'Rubik', 'Anton', 'Varela Round', 'Mukta', 'Noto Serif', 'Bitter', 'Arvo', 'Crimson Text',
    'Roboto Slab', 'Abril Fatface', 'Work Sans', 'Nanum Gothic', 'Josefin Sans', 'Righteous', 'Cinzel', 'Open Sans Condensed',
    'Dosis', 'Quicksand', 'Comfortaa', 'Old Standard TT', 'Pangolin', 'Alfa Slab One', 'Satisfy'
  ];

  const Font = Quill.import('formats/font');
  Font.whitelist = fontNames.map(font => font.replace(/\s+/g, '-'));
  Quill.register(Font, true);

  const Size = Quill.import('attributors/style/size');
  Size.whitelist = ['8pt', '10pt', '12pt', '14pt', '18pt', '24pt', '36pt', '48pt', '72pt'];
  Quill.register(Size, true);

  quill = new Quill('#editor', {
    modules: {
      toolbar: '#toolbar'
    },
    theme: 'snow',
  });

  const fontSelect = document.querySelector('select.ql-font');
  fontSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.setAttribute('value', '');
  defaultOption.textContent = 'Default';
  fontSelect.appendChild(defaultOption);
  fontNames.forEach(fontName => {
    const option = document.createElement('option');
    option.value = fontName.replace(/\s+/g, '-');
    option.textContent = fontName;
    option.style.fontFamily = fontName;
    fontSelect.appendChild(option);
  });

  const sizeSelect = document.querySelector('select.ql-size');
  ['8pt', '10pt', '12pt', '14pt', '18pt', '24pt', '36pt', '48pt', '72pt'].forEach(size => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size;
    sizeSelect.appendChild(option);
  });

  const pianoNoteColors = ['#FF0000', '#FFA500', '#FFFF00', '#008000', '#0000FF', '#6109AB', '#FF00FF'];
  const colors = [
    '#000000', '#e60000', '#ff9900', '#ffff00', '#008a00', '#0066cc', '#9933ff',
    '#ffffff', '#facccc', '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff',
    '#dddddd', '#ff0000', '#ff9c00', '#ffff00', '#00ff00', '#0000ff', '#cc66ff',
    '#eeeeee', '#ffcccc', '#ffe5cc', '#ffffcc', '#d9f2d9', '#ccd4ff', '#e6ccff',
    'magenta', 
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

  // Adjust editor height when content changes
  quill.on('text-change', adjustEditorHeight);

  function adjustEditorHeight() {
    const editorElement = document.querySelector('#editor');
    const iframe = editorElement.querySelector('iframe');
    if (iframe) {
      const iframeHeight = iframe.getAttribute('height') || '315';
      editorElement.style.height = iframeHeight + 'px';
    } else {
      editorElement.style.height = '600px';
    }
  }

  // Initial adjustment
  adjustEditorHeight();
  
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
  });

  const BlockEmbed = Quill.import('blots/block/embed');
  class IframeBlot extends BlockEmbed {
    static create(value) {
      const node = super.create();
      node.setAttribute('src', value.src);
      node.setAttribute('frameborder', '0');
      node.setAttribute('allowfullscreen', true);
      node.setAttribute('width', value.width || '560');
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
    const embedCode = prompt('Paste the embed code:');
    if (embedCode) {
      const range = quill.getSelection(true);
      quill.clipboard.dangerouslyPasteHTML(range.index, embedCode);
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
});
