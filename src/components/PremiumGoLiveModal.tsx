import React, { useState } from 'react';
import {
  Alert,
  Clipboard,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Radius, Shadow, Spacing, Typography } from '../theme';

interface PremiumGoLiveModalProps {
  visible: boolean;
  onClose: () => void;
}

const PHONE_1 = '03125096272';
const PHONE_2 = '03105258081';

export default function PremiumGoLiveModal({ visible, onClose }: PremiumGoLiveModalProps) {
  const [copied, setCopied] = useState(false);

  const makeCall = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Call Error', `Unable to place a call to ${phone}`);
    });
  };

  const openWhatsApp = (phone: string) => {
    // Format to international Pakistan format +92
    const cleanPhone = phone.startsWith('0') ? '92' + phone.slice(1) : phone;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
      'Hello! I want to get access to Go Live streaming for my matches on ABSScore.'
    )}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp Error', 'Could not open WhatsApp on this device.');
    });
  };

  const copyNumbers = () => {
    const text = `Contact for Go Live Access:\nPhone 1: ${PHONE_1}\nPhone 2: ${PHONE_2}`;
    Clipboard.setString(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
            <View style={styles.container}>
              {/* Gold Gradient Border Header Accent */}
              <LinearGradient
                colors={['#FFD700', '#FFA500', '#FF4500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topAccent}
              />

              {/* Close Button */}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>

              {/* Crown & Live Badge */}
              <View style={styles.headerArea}>
                <LinearGradient
                  colors={['#3B2706', '#1A1202']}
                  style={styles.crownCircle}>
                  <Icon name="trophy-outline" size={32} color="#FFD700" />
                </LinearGradient>
                <View style={styles.premiumTag}>
                  <Icon name="radio" size={12} color="#FFD700" style={{ marginRight: 4 }} />
                  <Text style={styles.premiumTagText}>GO LIVE PREMIUM</Text>
                </View>
              </View>

              {/* Main Title */}
              <Text style={styles.title}>Unlock Live Streaming</Text>

              {/* Inspiring Quote Box */}
              <View style={styles.quoteBox}>
                <LinearGradient
                  colors={['rgba(255, 215, 0, 0.08)', 'rgba(255, 140, 0, 0.03)']}
                  style={styles.quoteGradient}>
                  <Icon name="quote" size={18} color="#FFD700" style={styles.quoteIconLeft} />
                  <Text style={styles.quoteText}>
                    "Elevate your match to the world stage! Stream live in HD with TV-style scoreboards and let your fans experience every moment live."
                  </Text>
                </LinearGradient>
              </View>

              {/* Information Text */}
              <Text style={styles.description}>
                To activate Go Live streaming access for your matches or tournament, contact our support team directly:
              </Text>

              {/* Phone Contacts List */}
              <View style={styles.contactsContainer}>
                {/* Contact Card 1 */}
                <View style={styles.contactCard}>
                  <View style={styles.contactInfo}>
                    <Icon name="call" size={18} color="#FFD700" />
                    <Text style={styles.phoneText}>{PHONE_1}</Text>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => makeCall(PHONE_1)}>
                      <Icon name="call-outline" size={14} color="#000000" />
                      <Text style={styles.callBtnText}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.waBtn}
                      onPress={() => openWhatsApp(PHONE_1)}>
                      <Icon name="logo-whatsapp" size={14} color="#25D366" />
                      <Text style={styles.waBtnText}>Chat</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Contact Card 2 */}
                <View style={styles.contactCard}>
                  <View style={styles.contactInfo}>
                    <Icon name="call" size={18} color="#FFD700" />
                    <Text style={styles.phoneText}>{PHONE_2}</Text>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => makeCall(PHONE_2)}>
                      <Icon name="call-outline" size={14} color="#000000" />
                      <Text style={styles.callBtnText}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.waBtn}
                      onPress={() => openWhatsApp(PHONE_2)}>
                      <Icon name="logo-whatsapp" size={14} color="#25D366" />
                      <Text style={styles.waBtnText}>Chat</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Copy Numbers Helper */}
              <TouchableOpacity style={styles.copyBtn} onPress={copyNumbers}>
                <Icon
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={15}
                  color={copied ? '#4ADE80' : '#FFD700'}
                />
                <Text style={[styles.copyBtnText, copied && { color: '#4ADE80' }]}>
                  {copied ? 'Phone Numbers Copied!' : 'Copy Contact Details'}
                </Text>
              </TouchableOpacity>

              {/* Primary Dismiss Button */}
              <TouchableOpacity style={styles.dismissPressable} onPress={onClose}>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.dismissBtn}>
                  <Text style={styles.dismissText}>Got It</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F172A',
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    overflow: 'hidden',
    ...Shadow.lg,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  crownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  premiumTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    marginTop: 2,
  },
  premiumTagText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: 0.3,
  },
  quoteBox: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
    marginBottom: Spacing.md,
  },
  quoteGradient: {
    padding: Spacing.md,
    position: 'relative',
  },
  quoteIconLeft: {
    marginBottom: 4,
  },
  quoteText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
    fontWeight: '600',
  },
  description: {
    color: '#94A3B8',
    fontSize: Typography.xs,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  contactsContainer: {
    gap: 10,
    marginBottom: Spacing.md,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneText: {
    color: '#FFFFFF',
    fontSize: Typography.base,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  callBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  waBtnText: {
    color: '#25D366',
    fontSize: 12,
    fontWeight: '800',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: Spacing.md,
  },
  copyBtnText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
  },
  dismissPressable: {
    width: '100%',
  },
  dismissBtn: {
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    color: '#000000',
    fontSize: Typography.sm,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
