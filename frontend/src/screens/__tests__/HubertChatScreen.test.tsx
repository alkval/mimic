import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HubertChatScreen from '../HubertChatScreen';
import { sendTutorMessage } from '../../services/api';

jest.mock('../../services/api', () => ({
  sendTutorMessage: jest.fn(),
  unloadTutorModel: jest.fn(),
}));

describe('HubertChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
