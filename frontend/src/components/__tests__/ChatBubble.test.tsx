import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import ChatBubble from '../ChatBubble';
import { defineWord } from '../../services/api';

jest.mock('../../services/api', () => ({
  defineWord: jest.fn(),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  isSpeakingAsync: jest.fn(),
  stop: jest.fn(),
}));

describe('ChatBubble', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Speech.isSpeakingAsync as jest.Mock).mockResolvedValue(false);
    (defineWord as jest.Mock).mockResolvedValue('A short greeting.');
  });

  it('shows assistant text', () => {
    render(
      <ChatBubble
        message={{
          id: '1',
          role: 'assistant',
          text: 'Bonjour means hello.',
        }}
      />,
    );
    expect(screen.getByText('Bonjour')).toBeTruthy();
    expect(screen.getByText('means')).toBeTruthy();
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getByText('.')).toBeTruthy();
  });

  it('speaks when assistant audio button is pressed', async () => {
    render(
      <ChatBubble
        message={{
          id: '2',
          role: 'assistant',
          text: 'Salut means hi.',
        }}
      />,
    );

    fireEvent.press(screen.getByLabelText('Speak Hubert reply'));
    await Promise.resolve();
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect((Speech.speak as jest.Mock).mock.calls[0][0]).toBe('Salut means hi.');
  });

  it('stops speech when assistant audio button is pressed again', async () => {
    render(
      <ChatBubble
        message={{
          id: '2b',
          role: 'assistant',
          text: 'Salut means hi.',
        }}
      />,
    );

    const button = screen.getByLabelText('Speak Hubert reply');
    fireEvent.press(button);
    await waitFor(() => {
      expect(Speech.speak).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(button);
    await waitFor(() => {
      expect(Speech.stop).toHaveBeenCalled();
    });
  });

  it('replaces active speech when already speaking', async () => {
    (Speech.isSpeakingAsync as jest.Mock).mockResolvedValue(true);

    render(
      <ChatBubble
        message={{
          id: '3',
          role: 'assistant',
          text: 'Already speaking.',
        }}
      />,
    );

    fireEvent.press(screen.getByLabelText('Speak Hubert reply'));
    await waitFor(() => {
      expect(Speech.stop).toHaveBeenCalled();
      expect(Speech.speak).toHaveBeenCalled();
    });
  });

  it('opens a definition popup when tapping an assistant word', async () => {
    render(
      <ChatBubble
        message={{
          id: '4',
          role: 'assistant',
          text: 'Annyeong haseyo',
        }}
        targetLanguageName="Korean"
      />,
    );

    fireEvent.press(screen.getByText('Annyeong'));

    await waitFor(() => {
      expect(defineWord).toHaveBeenCalledWith('Annyeong', 'Korean', 'Annyeong haseyo');
      expect(screen.getByText('A short greeting.')).toBeTruthy();
    });
  });

  it('toggles definition speaker icon to stop while speaking', async () => {
    render(
      <ChatBubble
        message={{
          id: '5',
          role: 'assistant',
          text: 'Annyeong haseyo',
        }}
        targetLanguageName="Korean"
      />,
    );

    fireEvent.press(screen.getByText('Annyeong'));

    await waitFor(() => {
      expect(screen.getByText('A short greeting.')).toBeTruthy();
    });

    const speakWordButton = screen.getByLabelText('Speak selected word');
    fireEvent.press(speakWordButton);
    await waitFor(() => {
      expect(Speech.speak).toHaveBeenCalled();
    });

    fireEvent.press(speakWordButton);
    await waitFor(() => {
      expect(Speech.stop).toHaveBeenCalled();
    });
  });
});
