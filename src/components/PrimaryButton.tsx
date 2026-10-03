import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';

import { radius } from '../theme';

/** Full-width 48px pill – the one main action of a screen (DESIGN.md → button-primary). */
export function PrimaryButton(props: Omit<ComponentProps<typeof Button>, 'mode'>) {
  return (
    <Button
      mode="contained"
      {...props}
      style={[styles.button, props.style]}
      contentStyle={[styles.content, props.contentStyle]}
      labelStyle={[styles.label, props.labelStyle]}
    />
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: radius.full },
  content: { height: 48 },
  label: { fontSize: 17, fontWeight: '600', lineHeight: 23 },
});
