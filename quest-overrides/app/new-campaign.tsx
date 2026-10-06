import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton, Screen, usePalette } from '@/components/ui';
import { useGame } from '@/store/game-store';

const categories = [
  { name: 'Money', icon: '💰', example: 'Save for a new camera', unit: '₦' },
  { name: 'Fitness', icon: '💪', example: 'Reach my target weight', unit: 'kg' },
  { name: 'Career', icon: '💼', example: 'Land a better job', unit: '' },
  { name: 'Creative', icon: '🎨', example: 'Build my photography portfolio', unit: 'pieces' },
  { name: 'Study', icon: '📚', example: 'Finish a course', unit: 'hours' },
  { name: 'Personal', icon: '🧠', example: 'Become more consistent', unit: '' },
] as const;

type DraftGoal = {
  key: string;
  category: string;
  emoji: string;
  goal: string;
  tracking: 'simple' | 'number';
  current: string;
  target: string;
  unit: string;
  deadline?: string;
};

const isoDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const parseNumber = (value: string, fallback = 0) => {
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
};
const friendlyDate = (value?: string) => {
  if (!value) return 'No deadline';
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function CreateGoalsScreen() {
  const game = useGame();
  const c = usePalette();
  const s = useMemo(() => styles(c), [c]);
  const [stage, setStage] = useState<'areas' | 'details' | 'review'>('areas');
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<DraftGoal[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [iosDateDraft, setIosDateDraft] = useState<string | null>(null);

  const toggleArea = (name: string) => {
    setSelected(current => current.includes(name) ? current.filter(x => x !== name) : [...current, name]);
  };

  const buildDrafts = () => {
    if (!selected.length) return;
    setDrafts(selected.map((name, index) => {
      const item = categories.find(x => x.name === name)!;
      const isNumericFriendly = name === 'Money' || name === 'Fitness' || name === 'Creative' || name === 'Study';
      return {
        key: `${name}-${index}`,
        category: name,
        emoji: item.icon,
        goal: '',
        tracking: isNumericFriendly ? 'number' : 'simple',
        current: '0',
        target: '',
        unit: item.unit,
        deadline: undefined,
      };
    }));
    setActiveIndex(0);
    setStage('details');
  };

  const patchDraft = (key: string, patch: Partial<DraftGoal>) => setDrafts(current => current.map(d => d.key === key ? { ...d, ...patch } : d));
  const active = drafts[activeIndex];
  const activeCategory = active ? categories.find(x => x.name === active.category) : undefined;

  const openDatePicker = (draft: DraftGoal) => {
    const initial = draft.deadline ? new Date(`${draft.deadline}T12:00:00`) : new Date(Date.now() + 30 * 86400000);
    const min = new Date(); min.setHours(0, 0, 0, 0);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate: min,
        onChange: (event, picked) => {
          if (event.type === 'set' && picked) patchDraft(draft.key, { deadline: isoDate(picked) });
        },
      });
    } else {
      setIosDateDraft(draft.key);
    }
  };

  const validateActive = () => {
    if (!active?.goal.trim()) {
      Alert.alert('Add your goal', `Tell Quest what you want to achieve in ${active?.category ?? 'this area'}.`);
      return false;
    }
    if (active.tracking === 'number' && !active.target.trim()) {
      Alert.alert('Add a target', 'Enter the number you want to reach, or switch to Simple progress.');
      return false;
    }
    return true;
  };

  const nextGoal = () => {
    if (!validateActive()) return;
    if (activeIndex < drafts.length - 1) setActiveIndex(activeIndex + 1);
    else setStage('review');
  };

  const createGoals = () => {
    const valid = drafts.filter(d => d.goal.trim());
    if (!valid.length) return;
    valid.forEach(d => {
      const simple = d.tracking === 'simple';
      const current = simple ? 0 : parseNumber(d.current, 0);
      const target = simple ? 100 : parseNumber(d.target, 100);
      game.createGoalCampaign({
        title: d.goal.trim(),
        goal: `${d.category} goal`,
        category: d.category,
        emoji: d.emoji,
        start: current,
        current,
        target,
        unit: simple ? '%' : d.unit.trim(),
        deadline: d.deadline,
      });
    });
    router.replace('/(tabs)');
  };

  return <Screen><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    {stage === 'areas' ? <>
      <Text style={s.eyebrow}>SET UP YOUR GOALS</Text>
      <Text style={s.title}>What do you want to work on?</Text>
      <Text style={s.lead}>Choose as many as you want. You can always add more later.</Text>
      <View style={s.grid}>{categories.map(item => {
        const on = selected.includes(item.name);
        return <Pressable key={item.name} onPress={() => toggleArea(item.name)} style={[s.area, on && s.areaOn]}>
          <View style={s.areaTop}><Text style={s.areaEmoji}>{item.icon}</Text><View style={[s.check, on && s.checkOn]}><Text style={s.checkText}>{on ? '✓' : ''}</Text></View></View>
          <Text style={s.areaName}>{item.name}</Text>
        </Pressable>;
      })}</View>
      <PrimaryButton title={selected.length ? `Continue with ${selected.length} goal${selected.length === 1 ? '' : 's'}` : 'Choose at least one'} disabled={!selected.length} onPress={buildDrafts} />
      <Text style={s.helper}>You are not limited to one goal. Each selected area becomes its own goal.</Text>
    </> : null}

    {stage === 'details' && active ? <>
      <View style={s.progressHead}><Text style={s.eyebrow}>GOAL {activeIndex + 1} OF {drafts.length}</Text><Text style={s.counter}>{active.emoji} {active.category}</Text></View>
      <Text style={s.title}>What do you want to achieve?</Text>
      <Text style={s.lead}>Keep it simple. Quest will build the action plan after this.</Text>

      <Text style={s.label}>YOUR GOAL</Text>
      <TextInput value={active.goal} onChangeText={goal => patchDraft(active.key, { goal })} placeholder={activeCategory?.example ?? 'Describe your goal'} placeholderTextColor={c.muted} style={s.bigInput} multiline />

      <Text style={s.sectionTitle}>How should we track progress?</Text>
      <View style={s.choiceRow}>
        <Pressable onPress={() => patchDraft(active.key, { tracking: 'simple' })} style={[s.choice, active.tracking === 'simple' && s.choiceOn]}>
          <Text style={s.choiceIcon}>◎</Text><Text style={s.choiceTitle}>Simple progress</Text><Text style={s.choiceSub}>Just move from 0% to 100%</Text>
        </Pressable>
        <Pressable onPress={() => patchDraft(active.key, { tracking: 'number' })} style={[s.choice, active.tracking === 'number' && s.choiceOn]}>
          <Text style={s.choiceIcon}>#</Text><Text style={s.choiceTitle}>Track a number</Text><Text style={s.choiceSub}>Money, kg, books, hours…</Text>
        </Pressable>
      </View>

      {active.tracking === 'number' ? <View style={s.numberCard}>
        <View style={s.row}>
          <View style={s.half}><Text style={s.label}>WHERE ARE YOU NOW?</Text><TextInput value={active.current} onChangeText={current => patchDraft(active.key, { current })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.muted} style={s.input}/></View>
          <View style={s.half}><Text style={s.label}>WHERE DO YOU WANT TO GET?</Text><TextInput value={active.target} onChangeText={target => patchDraft(active.key, { target })} keyboardType="decimal-pad" placeholder="100" placeholderTextColor={c.muted} style={s.input}/></View>
        </View>
        <Text style={s.label}>WHAT ARE WE COUNTING?</Text>
        <TextInput value={active.unit} onChangeText={unit => patchDraft(active.key, { unit })} placeholder="₦, kg, books, hours, clients…" placeholderTextColor={c.muted} style={s.input}/>
      </View> : <View style={s.simpleCard}><Text style={s.simpleIcon}>✨</Text><View style={{flex:1}}><Text style={s.simpleTitle}>Quest will track this as 0% → 100%</Text><Text style={s.simpleText}>You can update the percentage as you make progress. No numbers to configure now.</Text></View></View>}

      <Text style={s.sectionTitle}>When do you want to achieve it?</Text>
      <Pressable onPress={() => openDatePicker(active)} style={s.dateButton}><Text style={s.dateIcon}>📅</Text><View style={{flex:1}}><Text style={s.dateLabel}>{active.deadline ? 'Target date' : 'No deadline yet'}</Text><Text style={s.dateValue}>{friendlyDate(active.deadline)}</Text></View><Text style={s.change}>Choose</Text></Pressable>
      {active.deadline ? <Pressable onPress={() => patchDraft(active.key, { deadline: undefined })}><Text style={s.removeDate}>Remove deadline</Text></Pressable> : null}

      {Platform.OS === 'ios' && iosDateDraft === active.key ? <View style={s.iosPicker}><DateTimePicker value={active.deadline ? new Date(`${active.deadline}T12:00:00`) : new Date(Date.now() + 30 * 86400000)} mode="date" display="inline" minimumDate={new Date()} onChange={(_, picked) => { if (picked) patchDraft(active.key, { deadline: isoDate(picked) }); }} /><Pressable onPress={() => setIosDateDraft(null)} style={s.donePicker}><Text style={s.donePickerText}>Done</Text></Pressable></View> : null}

      <View style={s.actions}><Pressable onPress={() => activeIndex > 0 ? setActiveIndex(activeIndex - 1) : setStage('areas')} style={s.back}><Text style={s.backText}>Back</Text></Pressable><View style={{flex:2}}><PrimaryButton title={activeIndex < drafts.length - 1 ? 'Next goal' : 'Review goals'} onPress={nextGoal} /></View></View>
    </> : null}

    {stage === 'review' ? <>
      <Text style={s.eyebrow}>READY TO START</Text>
      <Text style={s.title}>Your goals look good.</Text>
      <Text style={s.lead}>Quest will create a simple action plan for each one. You can edit everything later.</Text>
      <View style={s.reviewList}>{drafts.map((d, index) => <Pressable key={d.key} onPress={() => { setActiveIndex(index); setStage('details'); }} style={s.reviewCard}>
        <Text style={s.reviewEmoji}>{d.emoji}</Text><View style={{flex:1}}><Text style={s.reviewGoal}>{d.goal || `${d.category} goal`}</Text><Text style={s.reviewMeta}>{d.tracking === 'simple' ? 'Simple progress' : `${d.current || '0'} → ${d.target || '?'} ${d.unit}`}{d.deadline ? ` · ${friendlyDate(d.deadline)}` : ' · No deadline'}</Text></View><Text style={s.edit}>Edit</Text>
      </Pressable>)}</View>
      <PrimaryButton title={`Create ${drafts.length} goal${drafts.length === 1 ? '' : 's'}`} onPress={createGoals} />
      <Pressable onPress={() => { setActiveIndex(Math.max(0, drafts.length - 1)); setStage('details'); }} style={s.reviewBack}><Text style={s.reviewBackText}>Back</Text></Pressable>
    </> : null}
  </ScrollView></Screen>;
}

const styles = (c: any) => StyleSheet.create({
  content: { padding: 20, paddingTop: 30, paddingBottom: 80, gap: 14 },
  eyebrow: { color: c.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: c.text, fontSize: 31, lineHeight: 36, fontWeight: '900', marginTop: -2 },
  lead: { color: c.muted, fontSize: 15, lineHeight: 22, marginBottom: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 6 },
  area: { width: '48%', minHeight: 112, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, padding: 15 },
  areaOn: { borderColor: c.primary, borderWidth: 2, backgroundColor: c.panel2 },
  areaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  areaEmoji: { fontSize: 29 }, check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }, checkOn: { backgroundColor: c.primary, borderColor: c.primary }, checkText: { color: '#fff', fontWeight: '900' },
  areaName: { color: c.text, fontSize: 16, fontWeight: '900', marginTop: 15 },
  helper: { color: c.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, counter: { color: c.text, fontWeight: '900' },
  label: { color: c.muted, fontSize: 10, fontWeight: '900', letterSpacing: .8, marginTop: 3 },
  input: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, color: c.text, paddingHorizontal: 14, marginTop: 8, fontSize: 15, fontWeight: '800' },
  bigInput: { minHeight: 78, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, color: c.text, paddingHorizontal: 15, paddingVertical: 15, marginTop: 7, fontSize: 17, fontWeight: '800', textAlignVertical: 'top' },
  sectionTitle: { color: c.text, fontSize: 17, fontWeight: '900', marginTop: 8 },
  choiceRow: { flexDirection: 'row', gap: 10 }, choice: { flex: 1, minHeight: 122, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, padding: 14 }, choiceOn: { borderColor: c.primary, borderWidth: 2 }, choiceIcon: { color: c.cyan, fontWeight: '900', fontSize: 22 }, choiceTitle: { color: c.text, fontWeight: '900', marginTop: 9 }, choiceSub: { color: c.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  numberCard: { borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg2, padding: 14, gap: 8 }, row: { flexDirection: 'row', gap: 10 }, half: { flex: 1 },
  simpleCard: { flexDirection: 'row', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, padding: 15, alignItems: 'center' }, simpleIcon: { fontSize: 25 }, simpleTitle: { color: c.text, fontWeight: '900' }, simpleText: { color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  dateButton: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 66, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, paddingHorizontal: 15 }, dateIcon: { fontSize: 24 }, dateLabel: { color: c.muted, fontSize: 11, fontWeight: '800' }, dateValue: { color: c.text, fontSize: 15, fontWeight: '900', marginTop: 3 }, change: { color: c.cyan, fontSize: 12, fontWeight: '900' }, removeDate: { color: c.danger, fontWeight: '800', fontSize: 12, textAlign: 'right', marginTop: -5 },
  iosPicker: { borderRadius: 18, overflow: 'hidden', backgroundColor: c.panel, padding: 8 }, donePicker: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 10 }, donePickerText: { color: c.cyan, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 }, back: { flex: 1, minHeight: 52, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel2, alignItems: 'center', justifyContent: 'center' }, backText: { color: c.text, fontWeight: '900' },
  reviewList: { gap: 10 }, reviewCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, padding: 15 }, reviewEmoji: { fontSize: 29 }, reviewGoal: { color: c.text, fontSize: 15, fontWeight: '900' }, reviewMeta: { color: c.muted, fontSize: 11, lineHeight: 17, marginTop: 4 }, edit: { color: c.cyan, fontWeight: '900', fontSize: 12 }, reviewBack: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, reviewBackText: { color: c.muted, fontWeight: '900' },
});