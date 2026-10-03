import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, IconButton, Text, useTheme } from 'react-native-paper';

import { alertKey, useActiveAlerts, useAlertStore } from '../store/alertStore';
import { formatTime } from '../utils/time';

/**
 * Pinned strip for active alerts from certified authority accounts (DESIGN.md → Alert banner).
 * It cannot be dismissed while an alert is active – only folded to one line, and a newer alert
 * unfolds it again. Mounted as the first child of every main screen, like NetworkStatusBar.
 */
export function AlertBanner() {
  const theme = useTheme();
  const active = useActiveAlerts();
  const collapsedFor = useAlertStore((s) => s.collapsedFor);
  const setCollapsedFor = useAlertStore((s) => s.setCollapsedFor);
  const newest = active[0];
  if (!newest) return null;

  const collapsed = collapsedFor === alertKey(newest);
  const color = theme.colors.onError;
  const more = active.length > 1 ? ` · +${active.length - 1}` : '';

  return (
    <Pressable
      onPress={() => router.push('/alerts')}
      accessibilityRole="alert"
      accessibilityLabel={`Pilny komunikat urzędowy. ${newest.authority}. ${newest.headline}`}
      style={[styles.bar, { backgroundColor: theme.colors.error }]}
    >
      <Icon source="alert-octagon-outline" size={22} color={color} />
      <View style={styles.body}>
        <Text variant="labelMedium" numberOfLines={1} style={{ color }}>
          PILNE · {newest.authority}
          {more}
        </Text>
        <Text variant={collapsed ? 'labelMedium' : 'titleMedium'} numberOfLines={collapsed ? 1 : 2} style={{ color }}>
          {newest.headline}
        </Text>
        {!collapsed && (
          <>
            {!!newest.text && (
              <Text variant="bodyMedium" numberOfLines={3} style={{ color }}>
                {newest.text}
              </Text>
            )}
            <Text variant="labelSmall" style={{ color }}>
              Nadano {formatTime(newest.timestamp)} · dotknij, aby zobaczyć całość
            </Text>
          </>
        )}
      </View>
      <IconButton
        icon={collapsed ? 'chevron-down' : 'chevron-up'}
        iconColor={color}
        size={22}
        accessibilityLabel={collapsed ? 'Rozwiń komunikat' : 'Zwiń komunikat'}
        onPress={() => setCollapsedFor(collapsed ? null : alertKey(newest))}
        style={styles.toggle}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 16, paddingVertical: 8 },
  body: { flex: 1, gap: 2 },
  toggle: { margin: 0, width: 44, height: 44 },
});
