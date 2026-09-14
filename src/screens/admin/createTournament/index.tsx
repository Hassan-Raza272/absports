import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import BackButton from '../../../components/BackButton';
import PremiumIcon from '../../../components/PremiumIcon';
import TournamentBanner from '../../../components/TournamentBanner';
import { showAlert } from '../../../components/PremiumAlert';
import {
  BALL_TYPES,
  MATCH_KINDS,
  PITCH_TYPES,
  TOURNAMENT_BANNERS,
  TOURNAMENT_CATEGORIES,
  formatDay,
  matchKindToFormat,
  toYmd,
} from '../../../constants/tournamentSetup';
import { BallType, PitchType, TournamentCategory, TournamentMatchKind } from '../../../types';
import { useAuthStore, useScopeStore, useTournamentsStore } from '../../../store';
import { createTournament, uploadImage } from '../../../firebase';
import { isLocalImageUri } from '../../../services/cloudinary';
import { DEFAULT_CLUB_ID } from '../../../constants/scope';

type Step = 1 | 2;

export default function CreateTournamentScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user);
  const selectedClubId = useScopeStore(s => s.selectedClubId);
  const selectClub = useScopeStore(s => s.selectClub);
  const addTournamentLocal = useTournamentsStore(s => s.addTournament);

  const createClubId = selectedClubId || DEFAULT_CLUB_ID;

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [bannerSourceOpen, setBannerSourceOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [datePicker, setDatePicker] = useState<'start' | 'end' | null>(null);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [ground, setGround] = useState('');
  const [organiserName, setOrganiserName] = useState(user?.name || '');
  const [organiserPhone, setOrganiserPhone] = useState('');
  const [organiserEmail, setOrganiserEmail] = useState(user?.email || '');
  const [logoUri, setLogoUri] = useState('');
  const [bannerUri, setBannerUri] = useState('');
  const [bannerPresetId, setBannerPresetId] = useState('');

  const startDefault = new Date();
  const endDefault = new Date();
  endDefault.setDate(endDefault.getDate() + 14);
  const [startDate, setStartDate] = useState(startDefault);
  const [endDate, setEndDate] = useState(endDefault);
  const [category, setCategory] = useState<TournamentCategory | ''>('');
  const [ballType, setBallType] = useState<BallType | ''>('');
  const [pitchType, setPitchType] = useState<PitchType | ''>('');
  const [matchKind, setMatchKind] = useState<TournamentMatchKind | ''>('');
  const [homeAway, setHomeAway] = useState(false);
  const [needsMoreTeams, setNeedsMoreTeams] = useState(false);
  const [needsOfficials, setNeedsOfficials] = useState(false);

  function pickImage(onUri: (uri: string) => void) {
    launchImageLibrary({ mediaType: 'photo', quality: 0.85 }, response => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        showAlert('Gallery', response.errorMessage);
        return;
      }
      const uri = response.assets?.[0]?.uri;
      if (uri) onUri(uri);
    });
  }

  function onPickDate(which: 'start' | 'end') {
    return (event: DateTimePickerEvent, selected?: Date) => {
      if (Platform.OS === 'android') setDatePicker(null);
      if (event.type === 'dismissed' || !selected) return;
      if (which === 'start') {
        setStartDate(selected);
        if (endDate < selected) setEndDate(selected);
      } else {
        setEndDate(selected);
      }
    };
  }

  function goNext() {
    if (!name.trim()) {
      showAlert('Name required', 'Enter a tournament or series name.');
      return;
    }
    if (!city.trim()) {
      showAlert('City required', 'Enter the city for this competition.');
      return;
    }
    if (!ground.trim()) {
      showAlert('Ground required', 'Enter the ground or venue.');
      return;
    }
    if (!organiserName.trim()) {
      showAlert('Organiser required', 'Enter the organiser name.');
      return;
    }
    if (!organiserPhone.trim()) {
      showAlert('Number required', 'Enter the organiser phone number.');
      return;
    }
    if (organiserPhone.trim().length !== 11) {
      showAlert('Invalid number', 'Organiser number must be 11 digits.');
      return;
    }
    setStep(2);
  }

  async function handleCreate() {
    if (!category) {
      showAlert('Category required', 'Choose a tournament category.');
      return;
    }
    if (!ballType) {
      showAlert('Ball type required', 'Select tennis, leather, or other.');
      return;
    }
    if (!matchKind) {
      showAlert('Match type required', 'Select how this competition is played.');
      return;
    }
    if (endDate < startDate) {
      showAlert('Invalid dates', 'End date must be on or after the start date.');
      return;
    }

    setSaving(true);
    try {
      let logoURL: string | undefined;
      let bannerURL: string | undefined;
      if (isLocalImageUri(logoUri)) {
        logoURL = await uploadImage(logoUri, `tournaments/logo-${Date.now()}.jpg`);
      } else if (logoUri) {
        logoURL = logoUri;
      }
      if (isLocalImageUri(bannerUri)) {
        bannerURL = await uploadImage(bannerUri, `tournaments/banner-${Date.now()}.jpg`);
      } else if (bannerUri) {
        bannerURL = bannerUri;
      }
      const scoring = matchKindToFormat(matchKind);
      const year = startDate.getFullYear();
      const payload = {
        clubId: createClubId,
        createdBy: user?.id,
        name: name.trim(),
        season: `Season ${year}`,
        year,
        logoURL,
        bannerURL,
        bannerPresetId: bannerURL ? undefined : bannerPresetId || undefined,
        city: city.trim(),
        organiserName: organiserName.trim(),
        organiserPhone: organiserPhone.trim(),
        organiserEmail: organiserEmail.trim() || undefined,
        category,
        ballType,
        pitchType: pitchType || undefined,
        matchKind,
        homeAway,
        needsMoreTeams,
        needsOfficials,
        startDate: toYmd(startDate),
        endDate: toYmd(endDate),
        venue: ground.trim(),
        status: 'UPCOMING' as const,
        format: scoring.format,
        type: 'league' as const,
        totalTeams: 0,
        totalMatches: 0,
        overs: scoring.overs,
        ballsPerOver: scoring.ballsPerOver,
        wicketsPerInnings: 10,
        teamIds: [] as string[],
        groups: [] as [],
        pointsConfig: { win: 2, tie: 1, nr: 1 },
      };
      const ref = await createTournament(payload);
      addTournamentLocal({ ...payload, id: String(ref.id) });
      selectClub(createClubId, ref.id);
      navigation.replace('AdminTournamentDetail', { tournamentId: String(ref.id) });
    } catch (error: any) {
      showAlert('Save failed', error?.message || 'Could not create tournament.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton
          onPress={() => (step === 2 ? setStep(1) : navigation.goBack())}
          iconOnly
          size={20}
          style={styles.headerBtn}
        />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {step === 1 ? 'Create tournament' : 'Tournament setup'}
        </Text>
        <Text style={styles.stepMark}>{step}/2</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 1 ? (
          <>
            <TouchableOpacity style={styles.bannerBox} onPress={() => setBannerSourceOpen(true)} activeOpacity={0.88}>
              {bannerUri ? (
                <Image source={{ uri: bannerUri }} style={styles.bannerImg} />
              ) : bannerPresetId ? (
                <TournamentBanner presetId={bannerPresetId} style={styles.bannerFill} />
              ) : (
                <View style={styles.bannerEmpty}>
                  <PremiumIcon name="image" size={32} color={Colors.textMuted} />
                  <Text style={styles.bannerEmptyText}>Add banner</Text>
                </View>
              )}
              <View style={styles.camBadge}><PremiumIcon name="camera" size={14} color={Colors.onPrimary} /></View>
            </TouchableOpacity>

            <View style={styles.logoRow}>
              <TouchableOpacity style={styles.logoBox} onPress={() => pickImage(setLogoUri)} activeOpacity={0.88}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.logoImg} />
                ) : (
                  <PremiumIcon name="image" size={22} color={Colors.textMuted} />
                )}
                <View style={styles.camBadgeSm}><PremiumIcon name="camera" size={11} color={Colors.onPrimary} /></View>
              </TouchableOpacity>
              <Text style={styles.logoLabel}>Add logo</Text>
            </View>

            <Field label="Tournament / series name *" value={name} onChange={setName} />
            <Field label="City *" value={city} onChange={setCity} />
            <Field label="Ground *" value={ground} onChange={setGround} />
            <Field label="Organiser name *" value={organiserName} onChange={setOrganiserName} />
            <Field label="Organiser number *" value={organiserPhone} onChange={v => setOrganiserPhone(v.replace(/\D/g, '').slice(0, 11))} keyboardType="phone-pad" maxLength={11} />
            <Field label="Organiser email" value={organiserEmail} onChange={setOrganiserEmail} keyboardType="email-address" />
          </>
        ) : (
          <>
            <Text style={styles.section}>Tournament dates</Text>
            <View style={styles.dateRow}>
              <DateField label="Start date *" value={formatDay(startDate)} onPress={() => setDatePicker('start')} />
              <DateField label="End date *" value={formatDay(endDate)} onPress={() => setDatePicker('end')} />
            </View>
            {datePicker && (
              <DateTimePicker
                value={datePicker === 'start' ? startDate : endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickDate(datePicker)}
                themeVariant="light"
              />
            )}
            {Platform.OS === 'ios' && datePicker && (
              <TouchableOpacity style={styles.doneBtn} onPress={() => setDatePicker(null)}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.section}>Tournament category *</Text>
            <View style={styles.chipWrap}>
              {TOURNAMENT_CATEGORIES.map(item => (
                <Chip key={item.key} label={item.label} active={category === item.key} onPress={() => setCategory(item.key)} />
              ))}
            </View>

            <Text style={styles.section}>Select ball type *</Text>
            <View style={styles.ballRow}>
              {BALL_TYPES.map(item => (
                <TouchableOpacity key={item.key} style={styles.ballItem} onPress={() => setBallType(item.key)}>
                  <View style={[styles.ball, { backgroundColor: item.fill }]}>
                    {ballType === item.key && <PremiumIcon name="check" size={22} color="#fff" />}
                  </View>
                  <Text style={[styles.ballLabel, ballType === item.key && { color: Colors.textPrimary, fontWeight: '800' }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.section}>Pitch type</Text>
            <View style={styles.chipWrap}>
              {PITCH_TYPES.map(item => (
                <Chip key={item.key} label={item.label} active={pitchType === item.key} onPress={() => setPitchType(item.key)} />
              ))}
            </View>

            <Text style={styles.section}>Match type *</Text>
            <View style={styles.chipWrap}>
              {MATCH_KINDS.map(item => (
                <Chip key={item.key} label={item.label} active={matchKind === item.key} onPress={() => setMatchKind(item.key)} />
              ))}
            </View>

            <CheckRow label="Enable home / away format" value={homeAway} onToggle={() => setHomeAway(v => !v)} />
            <CheckRow label="Need more teams for this tournament?" value={needsMoreTeams} onToggle={() => setNeedsMoreTeams(v => !v)} />
            <CheckRow label="Need officials? (umpire, scorer)" value={needsOfficials} onToggle={() => setNeedsOfficials(v => !v)} />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={step === 1 ? goNext : handleCreate}
          disabled={saving}
          activeOpacity={0.9}>
          {saving ? (
            <ActivityIndicator color={Colors.onPrimary} />
          ) : (
            <Text style={styles.nextText}>{step === 1 ? 'Next' : 'Create tournament'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={bannerSourceOpen} transparent animationType="fade" onRequestClose={() => setBannerSourceOpen(false)}>
        <Pressable style={styles.modalDim} onPress={() => setBannerSourceOpen(false)}>
          <Pressable style={styles.sourceCard} onPress={() => {}}>
            <Text style={styles.sourceTitle}>Add banner</Text>
            <View style={styles.sourceRow}>
              <TouchableOpacity
                style={styles.sourceOpt}
                onPress={() => {
                  setBannerSourceOpen(false);
                  pickImage(uri => {
                    setBannerUri(uri);
                    setBannerPresetId('');
                  });
                }}>
                <View style={styles.sourceIcon}><PremiumIcon name="spark" size={26} color={Colors.textPrimary} /></View>
                <Text style={styles.sourceLabel}>Upload from device</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sourceOpt}
                onPress={() => {
                  setBannerSourceOpen(false);
                  setGalleryOpen(true);
                }}>
                <View style={styles.sourceIcon}><PremiumIcon name="image" size={26} color={Colors.textPrimary} /></View>
                <Text style={styles.sourceLabel}>AB Sports gallery</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={galleryOpen} animationType="slide" onRequestClose={() => setGalleryOpen(false)}>
        <View style={styles.galleryRoot}>
          <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
          <LinearGradient colors={Colors.gradHeader} style={styles.header}>
            <BackButton onPress={() => setGalleryOpen(false)} iconOnly size={20} style={styles.headerBtn} />
            <Text style={styles.headerTitle}>AB Sports gallery</Text>
            <View style={{ width: 36 }} />
          </LinearGradient>
          <ScrollView contentContainerStyle={styles.galleryList} showsVerticalScrollIndicator={false}>
            {TOURNAMENT_BANNERS.map(item => {
              const selected = bannerPresetId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.9}
                  onPress={() => {
                    setBannerPresetId(item.id);
                    setBannerUri('');
                    setGalleryOpen(false);
                  }}
                  style={[styles.galleryCard, selected && styles.galleryCardOn]}>
                  <TournamentBanner preset={item} style={styles.galleryBanner} />
                  {selected ? (
                    <View style={styles.galleryCheck}>
                      <PremiumIcon name="check" size={18} color={Colors.onPrimary} />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <TextInput
        style={styles.underline}
        placeholder={label}
        placeholderTextColor={Colors.textMuted}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function DateField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.dateField} onPress={onPress}>
      <Text style={styles.dateLabel}>{label}</Text>
      <View style={styles.dateValueRow}>
        <Text style={styles.dateValue}>{value}</Text>
        <PremiumIcon name="fixtures" size={16} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CheckRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onToggle} activeOpacity={0.8}>
      <View style={[styles.box, value && styles.boxOn]}>
        {value && <PremiumIcon name="check" size={16} color={Colors.onPrimary} />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgCard },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.lg },
  stepMark: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.xs, opacity: 0.95 },
  scroll: { padding: Spacing.base, paddingBottom: 120 },
  bannerBox: {
    height: 148,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  bannerImg: { width: '100%', height: '100%' },
  bannerFill: { width: '100%', height: '100%' },
  bannerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  bannerEmptyText: { color: Colors.textMuted, fontWeight: '700' },
  camBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: { alignItems: 'flex-start', marginBottom: Spacing.lg },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: { width: '100%', height: '100%', borderRadius: 36 },
  camBadgeSm: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLabel: { color: Colors.textSecondary, fontSize: Typography.xs, fontWeight: '700', marginTop: 6 },
  field: { marginBottom: Spacing.sm },
  underline: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: Typography.base,
  },
  section: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.sm,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  dateRow: { flexDirection: 'row', gap: Spacing.md },
  dateField: { flex: 1, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 8 },
  dateLabel: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: '700' },
  dateValueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  dateValue: { color: Colors.textPrimary, fontWeight: '700' },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: 8 },
  doneText: { color: Colors.accent, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.primary + '14', borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontWeight: '800', fontSize: 11 },
  chipTextOn: { color: Colors.primary },
  ballRow: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.sm },
  ballItem: { alignItems: 'center', width: 72 },
  ball: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballLabel: { color: Colors.textSecondary, fontSize: Typography.xs, fontWeight: '700', marginTop: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 12 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
  },
  boxOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkLabel: { flex: 1, color: Colors.textPrimary, fontWeight: '600' },
  footer: {
    padding: Spacing.base,
    paddingBottom: 28,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  nextBtn: {
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.base },
  modalDim: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sourceCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
  sourceTitle: { color: Colors.primary, fontWeight: '800', fontSize: Typography.lg, marginBottom: Spacing.lg },
  sourceRow: { flexDirection: 'row', justifyContent: 'space-around' },
  sourceOpt: { alignItems: 'center', width: 130 },
  sourceIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  sourceLabel: { color: Colors.textPrimary, fontWeight: '700', fontSize: Typography.xs, textAlign: 'center' },
  galleryRoot: { flex: 1, backgroundColor: '#F3F4F6' },
  galleryList: { padding: 12, paddingBottom: 40 },
  galleryCard: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  galleryCardOn: { borderColor: Colors.accent },
  galleryBanner: { height: 148, width: '100%' },
  galleryCheck: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
