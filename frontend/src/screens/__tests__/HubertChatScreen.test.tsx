import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Audio } from 'expo-av';
import HubertChatScreen from '../HubertChatScreen';
import { sendTutorMessage } from '../../services/api';

jest.mock('../../services/api', () => ({
  sendTutorMessage: jest.fn(),
  transcribeSpeech: jest.fn(),
  unloadTutorModel: jest.fn(),
}));

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    Recording: {
      createAsync: jest.fn(),
    },
    AndroidOutputFormat: {
      MPEG_4: 1,
    },
    AndroidAudioEncoder: {
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

describe('HubertChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
    (Audio.Recording.createAsync as jest.Mock).mockResolvedValue({
      recording: {
        stopAndUnloadAsync: jest.fn(),
        getURI: jest.fn().mockReturnValue('file:///attempt.wav'),
      },
    });
  });

  it('sends message with selected target language and renders assistant reply', async () => {
    (sendTutorMessage as jest.Mock).mockResolvedValue('Use bonjour in formal settings.');

    render(<HubertChatScreen />);
    fireEvent.press(screen.getByLabelText('Current language Korean'));
    fireEvent.changeText(screen.getByPlaceholderText('Type to search language'), 'fren');
    fireEvent.press(screen.getByLabelText('Select French'));
    fireEvent.changeText(screen.getByPlaceholderText('Ask Hubert'), 'How do I greet politely?');
    fireEvent.press(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(sendTutorMessage).toHaveBeenCalledWith('How do I greet politely?', 'French');
      expect(screen.getByText('Use')).toBeTruthy();
      expect(screen.getByText('bonjour')).toBeTruthy();
      expect(screen.getByText('settings')).toBeTruthy();
    });
  });

  it('renders fallback message when tutor request fails', async () => {
    (sendTutorMessage as jest.Mock).mockRejectedValue(new Error('Network down'));

    render(<HubertChatScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Ask Hubert'), 'Help me');
    fireEvent.press(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(screen.getByText('Network')).toBeTruthy();
      expect(screen.getByText('down')).toBeTruthy();
    });
  });
});
