import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';

import { useChatStore } from '../../store/chatStore';
import { useMeshStore } from '../../store/meshStore';

export default function TabsLayout() {
  const theme = useTheme();
  const unread = useChatStore((s) => s.conversations.reduce((n, c) => n + c.unread, 0));
  const nodeCount = useMeshStore((s) => s.nodes.length);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mesh Chat',
          tabBarLabel: 'Czaty',
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chat" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: 'Sieć mesh',
          tabBarLabel: 'Sieć',
          tabBarBadge: nodeCount > 0 ? nodeCount : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.colors.primary },
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="access-point-network" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ustawienia',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
