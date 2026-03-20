import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import './global.css';
import RootTabs from './src/navigation/RootTabs';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f6fbef',
    card: '#ffffff',
    text: '#243526',
    border: '#dfeecd',
    primary: '#58cc02',
    notification: '#58cc02',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="dark" />
      <RootTabs />
    </NavigationContainer>
  );
}
