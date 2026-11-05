import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import {
  openAuthSession,
  type AuthSessionOptions,
} from 'react-native-web-auth-session';

// Start the test server with `node example/server.js`.
// Android emulator: also run `adb reverse tcp:8080 tcp:8080`.
const SERVER = 'http://localhost:8080';

export default function App() {
  const [result, setResult] = useState('');

  const open = (delay: number, options?: AuthSessionOptions) => {
    setResult('Open');
    openAuthSession(`${SERVER}/?delay=${delay}`, 'webauthexample', options).then(
      (r) =>
        setResult(
          r.type === 'success'
            ? `${r.url}\ncode: ${new URL(r.url).searchParams.get('code')}`
            : r.type
        ),
      (e: { code?: string; message: string }) =>
        setResult(`Error ${e.code}: ${e.message}`)
    );
  };

  return (
    <View style={styles.container}>
      <Button title="Return at once" onPress={() => open(0)} />
      <Button title="Return after 20 s" onPress={() => open(20)} />
      <Button
        title="Chrome only, after 20 s"
        onPress={() => open(20, { browserPackages: ['com.android.chrome'] })}
      />
      <Button
        title="Missing browser"
        onPress={() => open(0, { browserPackages: ['com.example.missing'] })}
      />
      <Button
        title="Ephemeral (iOS)"
        onPress={() => open(0, { preferEphemeralSession: true })}
      />
      <Text testID="result" style={styles.result}>
        {result}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  result: { marginTop: 24, fontSize: 16 },
});
