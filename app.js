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
      allBlackKeys.push(note + (startOctave + Math.floor((octave - startOctave) / totalOctaves)));
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

// Variables for note collection in memory editor
let collectingNotes = false;
let collectedNotes = [];
let chordTimer = null;

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
        octave -= 1; // Cb is B of previous octave
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
        octave += 1; // B# is C of next octave
      }
      const naturalNoteBase = sharpToNaturalMap[noteBase];
      if (naturalNoteBase) {
        return naturalNoteBase + octave;
      }
    }
  }
  return note;
}

function noteOn(note, velocity = 127) {
  if (currentNoteInputField) {
    currentNoteInputField.value = note;
    currentNoteInputField = null;
    return; // Skip normal noteOn behavior
  }

  if (!pianoInstrument) return;

  if (collectingNotes) {
    collectNoteForInput(note);
  }

  if (activeNotes[note]) return;

  const gain = velocity / 127;

  const playableNote = getPlayableNoteName(note);

  const playedNote = pianoInstrument.play(playableNote, audioContext.currentTime, { gain });

  activeNotes[note] = playedNote;
  highlightKey(note, true);

  if (isRecording) {
    recordedNotes.push({
      type: 'noteOn',
      note: note,
      velocity: velocity,
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

function collectNoteForInput(note) {
  const now = performance.now();
  if (collectedNotes.length > 0) {
    const timeSinceLastNote = now - collectedNotes[collectedNotes.length - 1].time;
    if (timeSinceLastNote > 100) {
      // Time since last note is more than 100 ms, process collected notes as chord
      processCollectedNotes();
      collectedNotes = [];
    }
  }
  collectedNotes.push({ note: note, time: now });

  if (chordTimer) {
    clearTimeout(chordTimer);
  }
  chordTimer = setTimeout(() => {
    // Timer expired, process collected notes as chord
    processCollectedNotes();
    collectedNotes = [];
  }, 100);
}

function processCollectedNotes() {
  if (collectedNotes.length === 0) return;

  // Get the notes, sort them from lowest to highest pitch
  const sortedNotes = collectedNotes
    .map(n => ({ note: n.note, midi: noteNameToMidi(n.note) }))
    .sort((a, b) => a.midi - b.midi)
    .map(n => n.note);

  // Get the existing value of the 'add-notes-input' field
  const addNotesInput = document.getElementById('add-notes-input');
  let currentValue = addNotesInput.value.trim();

  // If current value is not empty, append a comma
  if (currentValue !== '') {
    currentValue += ', ';
  }

  // Append the collected notes, separated by commas
  currentValue += sortedNotes.join(', ');

  // Update the 'add-notes-input' field
  addNotesInput.value = currentValue;
}

function noteNameToMidi(noteName) {
  const noteRegex = /^([A-G][#b]?)(\d)$/;
  const match = noteName.match(noteRegex);
  if (!match) return null;

  const noteBase = match[1];
  const octave = parseInt(match[2], 10);

  const noteMap = {
    'C': 0,
    'C#': 1,
    'Db': 1,
    'D': 2,
    'D#': 3,
    'Eb': 3,
    'E': 4,
    'Fb': 4,
    'E#': 5,
    'F': 5,
    'F#': 6,
    'Gb': 6,
    'G': 7,
    'G#': 8,
    'Ab': 8,
    'A': 9,
    'A#': 10,
    'Bb': 10,
    'B': 11,
    'Cb': 11,
    'B#': 0,
  };

  const noteIndex = noteMap[noteBase];
  if (noteIndex === undefined) return null;

  const midiNumber = (octave + 1) * 12 + noteIndex; // MIDI note numbers start from C-1 (MIDI note 0)
  return midiNumber;
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
    if (currentNoteInputField) {
      currentNoteInputField.value = note;
      currentNoteInputField = null;
      return;
    }
    if (collectingNotes) {
      collectNoteForInput(note);
    }
    if (command === 144 && velocity > 0) { 
      noteOn(note, velocity);
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
        const sequenceDuration = sequence.duration;
        totalOffsetTime += sequenceDuration + 1;
      }
    });

    const scaledNotes = combinedNotes.map(noteEvent => ({
      ...noteEvent,
      time: noteEvent.time
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
          noteOn(noteEvent.note, noteEvent.velocity);
        } else if (noteEvent.type === 'noteOff') {
          noteOff(noteEvent.note);
        }
        recordedNotes.push({
          type: noteEvent.type,
          note: noteEvent.note,
          velocity: noteEvent.velocity !== undefined ? noteEvent.velocity : 100,
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
    
    // Change all active Note On events to Note Off
    for (const note in activeNotes) {
      if (activeNotes.hasOwnProperty(note)) {
        recordedNotes.push({
          type: 'noteOff',
          note: note,
          time: audioContext.currentTime - recordStartTime
        });
      }
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
}

function startPlayback() {
  if (isPlaying) return;

  const selectedMemories = memoryList.filter(sequence => sequence.selected);
  if (selectedMemories.length === 0) {
    return;
  }

  const playbackPercentage = tempoPercentage || 100;

  isPlaying = true;
  playbackStartTime = audioContext.currentTime;
  document.getElementById('stop-btn').disabled = false;
  document.getElementById('play-btn').disabled = true;

  playSelectedMemories(selectedMemories, playbackPercentage);
}

function playSelectedMemories(sequencesToPlay, playbackPercentage) {
  if (!isPlaying) return;

  let totalOffsetTime = 0;
  const scheduledEvents = [];
  const timeScale = 100 / playbackPercentage;

  sequencesToPlay.forEach(sequence => {
    const sequenceStartTime = totalOffsetTime;

    const timeUntilSequenceStart = sequenceStartTime - (audioContext.currentTime - playbackStartTime);
    const displayTimer = setTimeout(() => {
      if (!isPlaying) return;
      document.getElementById('selected-memory').textContent = sequence.name;
      quill.setContents(sequence.editorContent);
    }, Math.max(0, timeUntilSequenceStart * 1000));
    playbackTimers.push(displayTimer);

    sequence.notes.forEach(noteEvent => {
      scheduledEvents.push({
        ...noteEvent,
        time: (noteEvent.time * timeScale + sequenceStartTime)
      });
    });

    if (sequence.notes.length > 0) {
      const sequenceDuration = sequence.duration * timeScale;
      totalOffsetTime += sequenceDuration + 1;
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
        playSelectedMemories(sequencesToPlay, playbackPercentage);
        return;
      } else {
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
        noteOn(noteEvent.note, noteEvent.velocity);
      } else if (noteEvent.type === 'noteOff') {
        noteOff(noteEvent.note);
      } else if (noteEvent.type === 'controlChange') {
        // existing code for controlChange
      } else if (noteEvent.type === 'programChange') {
        // existing code for programChange
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

  // Remove silence before first note
  if (quantizedNotes.length > 0) {
    const firstNoteTime = quantizedNotes[0].time;
    quantizedNotes.forEach(noteEvent => {
      noteEvent.time -= firstNoteTime;
    });
  }

  // Calculate total duration
  let totalDuration = 0;
  quantizedNotes.forEach(noteEvent => {
    if (noteEvent.time > totalDuration) {
      totalDuration = noteEvent.time;
    }
  });

  // Remove silence after last note
  quantizedNotes = quantizedNotes.filter(noteEvent => noteEvent.time <= totalDuration);

  const sequenceData = {
    name: sequenceName,
    notes: quantizedNotes,
    editorContent: quill.getContents(),
    selected: false,
    duration: totalDuration,
    tempo: 100  // Default tempo
  };
  memoryList.push(sequenceData);
  sequenceCounter++;

  selectMemorySequence(memoryList.length - 1);
  updateMemoryList();
  document.getElementById('play-btn').disabled = false;
}

function removeFromMemory() {
  if (selectedMemoryIndex === null) {
    // No memory selected to clear
    return;
  }

  // Remove the selected memory from the playlist
  memoryList.splice(selectedMemoryIndex, 1);

  // Update UI to reflect that no memory is selected
  selectedMemoryIndex = null;
  document.getElementById('selected-memory').textContent = 'No Memory Selected';

  updateMemoryList();
}

function addEditorContentToMemory() {
  const selectedMemoryName = document.getElementById('selected-memory').textContent;
  const index = memoryList.findIndex(sequence => sequence.name === selectedMemoryName);
  if (index >= 0) {
    const selectedSequence = memoryList[index];
    selectedSequence.editorContent = quill.getContents();
    updateEditorAssociationButton();
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
  let filename = 'memoryList.json';
  if (memoryList.length > 0 && memoryList[0].name) {
    filename = memoryList[0].name + '.json';
  }
  a.download = filename;
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
          let previousMemoryListLength = memoryList.length;
          memoryList = memoryList.concat(data.memoryList);
          updateMemoryList();
          document.getElementById('play-btn').disabled = memoryList.length === 0;

          if (data.memoryList.length > 0) {
            selectMemorySequence(previousMemoryListLength);
          }
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

  selectedMemoryIndex = null;
  if (memoryEditorVisible) {
    populateMemoryEditor();
  }

  transposeAmount = 0;
  document.getElementById('transpose-amount').textContent = transposeAmount;
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
  const key = event.key.toLowerCase();

  if (collectingNotes) {
    const mapping = keyNoteMap[key];
    if (mapping && !event.repeat) {
      event.preventDefault();
      const { note: noteBase, octaveOffset } = mapping;
      const noteOctave = keyboardOctave + (octaveOffset || 0);
      const note = noteBase + noteOctave;
      if (!activeNotes[note]) {
        noteOn(note);
      }
    }
    return;
  }

  if (isInputFocused()) return;

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
      noteOn(note);
    }
  }
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();

  if (collectingNotes) {
    const mapping = keyNoteMap[key];
    if (mapping) {
      event.preventDefault();
      const { note: noteBase, octaveOffset } = mapping;
      const noteOctave = keyboardOctave + (octaveOffset || 0);
      const note = noteBase + noteOctave;
      noteOff(note);
    }
    return;
  }

  if (isInputFocused()) return;

  if (!keyboardEnabled) return;
  const mapping = keyNoteMap[key];
  if (mapping) {
    event.preventDefault();
    const { note: noteBase, octaveOffset } = mapping;
    const noteOctave = keyboardOctave + (octaveOffset || 0);
    const note = noteBase + noteOctave;
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

  const playableNote = getPlayableNoteName(note);

  const playedNote = pianoInstrument.play(playableNote);
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

function updateMemoryFromEditor() {
  // existing code...
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
});

function populateMemoryEditor() {
  const memoryEditorContainer = document.getElementById('memory-editor-container');

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
    <div id="memory-add-controls">
      <div id="memory-add-fields">
        <input type="text" id="add-notes-input" placeholder="Notes">
        <input type="number" id="add-velocity-input" value="100" placeholder="Velocity" min="1" max="127">
        <input type="text" id="add-start-input" placeholder="Start">
        <input type="number" id="add-duration-input" placeholder="Duration" step="0.001">
        <input type="number" id="add-cc-number-input" placeholder="CC#" min="0" max="127">
        <input type="number" id="add-cc-value-input" placeholder="CCV" min="0" max="127">
        <input type="number" id="add-pc-input" placeholder="PC">
      </div>
      <button id="add-entry-btn">Add</button>
    </div>
  </div>
  <table id="memory-editor-table">
    <tr><th>Time (s)</th><th>Type</th><th>Parameters</th><th>Action</th></tr>`;

  events.forEach((event, index) => {
    html += `<tr class="event-row ${event.type === 'noteOn' ? 'note-on' :
                                     event.type === 'noteOff' ? 'note-off' :
                                     event.type === 'controlChange' ? 'control-change' :
                                     event.type === 'programChange' ? 'program-change' : ''}">
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

    if (event.type === 'noteOn' || event.type === 'noteOff') {
      let formattedNote = formatNoteForDisplay(event.note);
      html += `<input type="text" class="event-note event-note-font" value="${formattedNote}">`;
      if (event.type === 'noteOn') {
        html += ` Velocity: <input type="number" class="event-velocity" value="${event.velocity !== undefined ? event.velocity : 100}" min="1" max="127">`;
      }
    } else if (event.type === 'controlChange') {
      html += `CC#: <input type="number" class="event-controller-number" value="${event.controllerNumber}" min="0" max="127">
               CCV: <input type="number" class="event-controller-value" value="${event.controllerValue}" min="0" max="127">`;
    } else if (event.type === 'programChange') {
      html += `Program Number: <input type="number" class="event-program-number" value="${event.programNumber}" min="0" max="127">`;
    }

    html += `</td>
      <td><button class="delete-entry-btn">X</button></td>
    </tr>`;
  });

  html += '</table>';
  memoryEditorContainer.innerHTML = html;

  // Set default values for Start and Duration fields
  const startInput = document.getElementById('add-start-input');
  const durationInput = document.getElementById('add-duration-input');

  if (events.length === 0) {
    startInput.value = "0";
  } else {
    startInput.value = "last";
  }
  durationInput.value = "1";

  // Add event listener for Enter key on 'memory-add-fields'
  const memoryAddFields = document.getElementById('memory-add-fields');
  memoryAddFields.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      document.getElementById('add-entry-btn').click();
    }
  });

  // Event listeners for dynamic content
  const memoryNameInput = document.getElementById('memory-name-input');
  memoryNameInput.addEventListener('blur', updateMemoryFromEditor);

  const addNotesInput = document.getElementById('add-notes-input');

  const addEntryBtn = document.getElementById('add-entry-btn');
  addEntryBtn.addEventListener('click', function () {
    const notesInput = document.getElementById('add-notes-input').value.trim();
    const velocityInput = document.getElementById('add-velocity-input').value;
    const startInput = document.getElementById('add-start-input').value;
    const durationInput = document.getElementById('add-duration-input').value;
    const ccNumberInput = document.getElementById('add-cc-number-input').value;
    const ccValueInput = document.getElementById('add-cc-value-input').value;
    const pcInput = document.getElementById('add-pc-input').value;

    let startTime;
    if (startInput.trim().toLowerCase() === 'last') {
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

    const newEvents = [];

    if (ccNumberInput && ccValueInput) {
      const ccEvent = {
        type: 'controlChange',
        time: startTime,
        controllerNumber: parseInt(ccNumberInput),
        controllerValue: parseInt(ccValueInput)
      };
      newEvents.push(ccEvent);
    }

    if (pcInput) {
      const pcEvent = {
        type: 'programChange',
        time: startTime,
        programNumber: parseInt(pcInput)
      };
      newEvents.push(pcEvent);
    }

    if (notesInput) {
      const noteNames = notesInput.split(',').map(note => note.trim());
      const velocity = parseInt(velocityInput) || 100;
      const duration = parseFloat(durationInput) || 1.0;

      const noteEvents = [];

      noteNames.forEach(note => {
        const noteOnEvent = {
          type: 'noteOn',
          note: note,
          velocity: velocity,
          time: startTime
        };
        const noteOffEvent = {
          type: 'noteOff',
          note: note,
          time: startTime + duration
        };
        noteEvents.push(noteOnEvent, noteOffEvent);
      });

      events.push(...noteEvents);
      events.sort((a, b) => a.time - b.time);
      selectedSequence.duration = Math.max(selectedSequence.duration, ...events.map(event => event.time));
    }

    populateMemoryEditor(); // Refresh the editor to display new events
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
}

function updateEventParamsCell(row) {
  const eventType = row.querySelector('.event-type').value;
  const eventParamsCell = row.querySelector('.event-params');
  eventParamsCell.innerHTML = '';

  if (eventType === 'noteOn') {
    eventParamsCell.innerHTML = `<input type="text" class="event-note event-note-font" value=""> Velocity: <input type="number" class="event-velocity" value="100" min="1" max="127">`;
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

  const paramsFields = eventParamsCell.querySelectorAll('input');
  paramsFields.forEach(inputField => {
    inputField.addEventListener('input', function () {
      const row = this.closest('tr');
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

function toggleMemoryEditor() {
  memoryEditorVisible = !memoryEditorVisible;
  const memoryEditorContainer = document.getElementById('memory-editor-container');
  if (memoryEditorVisible) {
    memoryEditorContainer.style.display = 'block';
    populateMemoryEditor();
    collectingNotes = true; // Start collecting notes when memory editor is open
  } else {
    updateMemoryFromEditor();
    memoryEditorContainer.style.display = 'none';
    collectingNotes = false; // Stop collecting notes when memory editor is closed
    collectedNotes = [];
    if (chordTimer) {
      clearTimeout(chordTimer);
      chordTimer = null;
    }
  }
}

function selectMemoryByName(name) {
  const index = memoryList.findIndex(sequence => sequence.name === name);
  if (index >= 0) {
    selectMemorySequence(index);
  }
}

function exportSelectedMemoryAsMidi() {
  // existing code...
}

function transposeSelectedMemoryDown() {
  transposeSelectedMemory(-1);
}

function transposeSelectedMemoryUp() {
  transposeSelectedMemory(1);
}

function transposeSelectedMemory(semitones) {
  // existing code...
}
