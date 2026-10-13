import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MarketScreen } from './src/screens/MarketScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <MarketScreen />
    </SafeAreaProvider>
  );
}
