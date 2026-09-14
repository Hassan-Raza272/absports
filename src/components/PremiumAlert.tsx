import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow, Spacing, Typography } from '../theme';
import { EasePress, EaseView, fadeTransition } from '../motion';
import PremiumIcon, { PremiumIconName } from './PremiumIcon';

export type PremiumAlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type PremiumAlertOptions = {
  cancelable?: boolean;
};

type Dialog = {
  title: string;
  message?: string;
  buttons: PremiumAlertButton[];
  cancelable: boolean;
};

type ShowFn = (dialog: Dialog) => void;

let deliver: ShowFn | null = null;
const pending: Dialog[] = [];

function normalize(
  title: string,
  message?: string,
  buttons?: PremiumAlertButton[],
  options?: PremiumAlertOptions,
): Dialog {
  return {
    title,
    message,
    buttons: buttons?.length ? buttons : [{ text: 'OK' }],
    cancelable: options?.cancelable !== false,
  };
}

/** Drop-in replacement for React Native `Alert.alert`. */
export function showAlert(
  title: string,
  message?: string,
  buttons?: PremiumAlertButton[],
  options?: PremiumAlertOptions,
) {
  const dialog = normalize(title, message, buttons, options);
  if (deliver) {
    deliver(dialog);
    return;
  }
  pending.push(dialog);
}

function iconFor(dialog: Dialog): PremiumIconName {
  const blob = `${dialog.title} ${dialog.message || ''}`.toLowerCase();
  if (dialog.buttons.some(btn => btn.style === 'destructive')) return 'warning';
  if (/fail|error|invalid|required|missing|denied|could not|needed/.test(blob)) return 'warning';
  if (/saved|success|welcome|created|complete|done|updated|registered/.test(blob)) return 'check';
  if (/photo|picture|camera|gallery/.test(blob)) return 'camera';
  return 'spark';
}

function accentFor(icon: PremiumIconName) {
  if (icon === 'warning') return Colors.loss;
  if (icon === 'check') return Colors.win;
  return Colors.primary;
}

function registerHost(fn: ShowFn | null) {
  deliver = fn;
  if (fn) {
    pending.splice(0).forEach(fn);
  }
}

export function PremiumAlertHost() {
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const dialogRef = useRef<Dialog | null>(null);
  const queue = useRef<Dialog[]>([]);

  useEffect(() => {
    registerHost(next => {
      if (dialogRef.current) {
        queue.current.push(next);
        return;
      }
      dialogRef.current = next;
      setDialog(next);
    });
    return () => registerHost(null);
  }, []);

  function close(after?: () => void) {
    dialogRef.current = null;
    setDialog(null);
    requestAnimationFrame(() => {
      after?.();
      if (dialogRef.current) return;
      const next = queue.current.shift();
      if (!next) return;
      dialogRef.current = next;
      setDialog(next);
    });
  }

  function onButton(button: PremiumAlertButton) {
    close(() => button.onPress?.());
  }

  function onRequestClose() {
    if (!dialog?.cancelable) return;
    const cancel = dialog.buttons.find(btn => btn.style === 'cancel');
    close(() => cancel?.onPress?.());
  }

  const visible = !!dialog;
  const icon = dialog ? iconFor(dialog) : 'spark';
  const accent = accentFor(icon);
  const defaults = dialog?.buttons.filter(btn => btn.style !== 'cancel' && btn.style !== 'destructive') || [];
  const lastDefault = defaults[defaults.length - 1];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onRequestClose}
    >
      {dialog && (
        <View style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
          <EaseView
            initialAnimate={{ opacity: 0, scale: 0.92, translateY: 18 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={fadeTransition}
            key={`${dialog.title}|${dialog.message || ''}`}
            style={styles.cardWrap}
          >
            <LinearGradient colors={Colors.gradCard} style={styles.card}>
              <View style={[styles.iconRing, { borderColor: accent + '88', backgroundColor: accent + '18' }]}>
                <PremiumIcon name={icon} size={26} color={accent} />
              </View>
              <Text style={styles.title}>{dialog.title}</Text>
              {!!dialog.message && <Text style={styles.message}>{dialog.message}</Text>}
              <View style={styles.actions}>
                {dialog.buttons.map((button, index) => {
                  const isCancel = button.style === 'cancel';
                  const isDestructive = button.style === 'destructive';
                  const isPrimary = !isCancel && !isDestructive && button === lastDefault;
                  if (isCancel) {
                    return (
                      <EasePress key={`${button.text}-${index}`} onPress={() => onButton(button)} style={styles.cancelBtn}>
                        <Text style={styles.cancelText}>{button.text}</Text>
                      </EasePress>
                    );
                  }
                  if (isDestructive) {
                    return (
                      <EasePress key={`${button.text}-${index}`} onPress={() => onButton(button)} style={styles.destructiveBtn}>
                        <Text style={styles.destructiveText}>{button.text}</Text>
                      </EasePress>
                    );
                  }
                  if (isPrimary) {
                    return (
                      <EasePress key={`${button.text}-${index}`} onPress={() => onButton(button)} style={styles.primaryBtn}>
                        <LinearGradient colors={Colors.gradPrimary} style={styles.primaryGrad}>
                          <Text style={styles.primaryText}>{button.text}</Text>
                        </LinearGradient>
                      </EasePress>
                    );
                  }
                  return (
                    <EasePress key={`${button.text}-${index}`} onPress={() => onButton(button)} style={styles.outlineBtn}>
                      <Text style={styles.outlineText}>{button.text}</Text>
                    </EasePress>
                  );
                })}
              </View>
            </LinearGradient>
          </EaseView>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  cardWrap: {
    ...Shadow.lg,
  },
  card: {
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    alignItems: 'center',
  },
  iconRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontWeight: '900',
    fontSize: Typography.lg,
    textAlign: 'center',
  },
  message: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  primaryBtn: {
    height: 48,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  primaryGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: Colors.onPrimary,
    fontWeight: '800',
    fontSize: Typography.base,
  },
  outlineBtn: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '88',
    backgroundColor: Colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: Typography.sm,
  },
  destructiveBtn: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.loss + '88',
    backgroundColor: Colors.loss + '16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveText: {
    color: Colors.loss,
    fontWeight: '800',
    fontSize: Typography.sm,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  cancelText: {
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: Typography.sm,
  },
});
