import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import PracticeScreen, { recordingOptions } from '../PracticeScreen';
import { alignPronunciation } from '../../services/api';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  alignPronunciation: jest.fn(),
}));

const stopAndUnloadAsync = jest.fn();
const getURI = jest.fn();

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    Recording: {
      createAsync: jest.fn(),
    },
    AndroidOutputFormat: {
      DEFAULT: 0,
      MPEG_4: 1,
    },
    AndroidAudioEncoder: {
      DEFAULT: 0,
      AAC: 1,
    },
    IOSAudioQuality: {
      MAX: 0,
    },
    IOSOutputFormat: {
      LINEARPCM: 0,
    },
  },
}));

describe('PracticeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
    getURI.mockReturnValue('file:///attempt.wav');
    stopAndUnloadAsync.mockResolvedValue(undefined);
    (Audio.Recording.createAsync as jest.Mock).mockResolvedValue({
      recording: {
        stopAndUnloadAsync,
        getURI,
      },
    });
    (alignPronunciation as jest.Mock).mockResolvedValue({
      scores: [{ character: 'h', score: 0.95 }],
      transcript: 'hola',
    });
  });

  it('uses required mobile recording parameters', () => {
    expect(recordingOptions.android?.sampleRate).toBe(16000);
    expect(recordingOptions.android?.numberOfChannels).toBe(1);
    expect(recordingOptions.android?.bitRate).toBe(256000);
    expect(recordingOptions.android?.extension).toBe('.m4a');

    expect(recordingOptions.ios?.sampleRate).toBe(16000);
    expect(recordingOptions.ios?.numberOfChannels).toBe(1);
    expect(recordingOptions.ios?.bitRate).toBe(256000);
    expect(recordingOptions.ios?.extension).toBe('.wav');
  });

  it('speaks trimmed text on listen', () => {
    render(<PracticeScreen />);

    fireEvent.press(screen.getByLabelText('Current language Korean'));
    fireEvent.changeText(screen.getByPlaceholderText('Type to search language'), 'kore');
    fireEvent.press(screen.getByLabelText('Select Korean'));

    fireEvent.changeText(screen.getByPlaceholderText('Type target word or sentence'), '  bonjour  ');
    fireEvent.press(screen.getByLabelText('Listen to target word'));

    expect(Speech.speak).toHaveBeenCalledWith(
      'bonjour',
      expect.objectContaining({
        language: 'ko-KR',
      }),
    );
  });

  it('shows validation error when recording without target word', () => {
    render(<PracticeScreen />);

    fireEvent.press(screen.getByLabelText('Start recording'));

    expect(screen.getByText('Type a target word or sentence first so Hubert can score it.')).toBeTruthy();
  });

  it('records, uploads, and renders returned character scores', async () => {
    render(<PracticeScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Type target word or sentence'), 'hola');
    fireEvent.press(screen.getByLabelText('Start recording'));

    await waitFor(() => {
      expect(Audio.Recording.createAsync).toHaveBeenCalled();
      expect(screen.getByLabelText('Stop recording')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Stop recording'));

    await waitFor(() => {
      expect(alignPronunciation).toHaveBeenCalledWith('hola', 'file:///attempt.wav', 'ko');
      expect(screen.getByText('Very good')).toBeTruthy();
      expect(screen.getByText('HUBERT HEARD')).toBeTruthy();
      expect(screen.getByText('hola')).toBeTruthy();
    });
  });
});
