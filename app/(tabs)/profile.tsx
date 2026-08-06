import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/contexts/AuthContext';
import { Spacing } from '@/constants/theme';

export default function ProfileScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Button label="Sign out" onPress={() => signOut()} variant="secondary" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'flex-end', padding: Spacing.lg },
});
