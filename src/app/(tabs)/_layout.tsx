import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { type ColorValue, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChatStore } from "../../store/chatStore";
import { useMeshStore } from "../../store/meshStore";
import { radius } from "../../theme";

interface TabIconProps {
  name: ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: ColorValue;
  focused: boolean;
}

/** Active tab: primary icon on a primary-container pill. */
function TabIcon({ name, color, focused }: TabIconProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.pill,
        focused && { backgroundColor: theme.colors.primaryContainer },
      ]}>
      <MaterialCommunityIcons name={name} color={color} size={22} />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const unread = useChatStore((s) =>
    s.conversations.reduce((n, c) => n + c.unread, 0),
  );
  const nodeCount = useMeshStore((s) => s.nodes.length);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.primary,
        headerTitleAlign: "center",
        headerTitleStyle: { fontSize: 17, fontWeight: "600" },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          borderTopWidth: 1,
          elevation: 0,
          height: 64 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarBadgeStyle: {
          backgroundColor: theme.colors.primary,
          color: theme.colors.onPrimary,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Mesh Chat",
          tabBarLabel: "Czaty",
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: (p) => <TabIcon name="chat-outline" {...p} />,
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: "Sieć mesh",
          tabBarLabel: "Sieć",
          tabBarBadge: nodeCount > 0 ? nodeCount : undefined,
          tabBarIcon: (p) => <TabIcon name="access-point-network" {...p} />,
        }}
      />
      <Tabs.Screen
        name="rag"
        options={{
          title: "Informacje",
          tabBarIcon: (p) => <TabIcon name="information-outline" {...p} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ustawienia",
          tabBarIcon: (p) => <TabIcon name="cog-outline" {...p} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 56,
    height: 28,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
