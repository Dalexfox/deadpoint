/**
 * ClimbDatePicker — a zero-dependency month calendar in a bottom sheet.
 *
 * Days that have a climb are dotted in SAND and tappable; days without are
 * dimmed and disabled, so the user can only land on a date that has sends.
 * "Show all dates" clears the filter. Conditionally rendered by the caller
 * ({visible && <ClimbDatePicker .../>}) per the project's Modal rule.
 */
import { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BG      = '#ffffff';
const SURFACE = '#ece8df';
const SAND    = '#c8a84a';
const INK     = '#1a1408';
const INK3    = '#8a7a50';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Local Y-M-D key — the shared identity for "same calendar day". */
export function climbDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function ClimbDatePicker({
  onClose, selected, markedDays, initialMonth, onSelect,
}: {
  onClose: () => void;
  selected: Date | null;
  markedDays: Set<string>;       // climbDayKey()s that have at least one climb
  initialMonth?: Date;           // month to open on (e.g. most recent climb)
  onSelect: (date: Date | null) => void;
}) {
  const [view, setView] = useState(() => {
    const base = selected ?? initialMonth ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const year  = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selKey = selected ? climbDayKey(selected) : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Month nav */}
          <View style={s.navRow}>
            <TouchableOpacity onPress={() => setView(new Date(year, month - 1, 1))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={22} color={INK} />
            </TouchableOpacity>
            <Text style={s.monthTitle}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={() => setView(new Date(year, month + 1, 1))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={22} color={INK} />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={s.weekRow}>
            {WEEKDAYS.map((w, i) => <Text key={i} style={s.weekday}>{w}</Text>)}
          </View>

          {/* Day grid */}
          <View style={s.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={i} style={s.cell} />;
              const date   = new Date(year, month, d);
              const marked = markedDays.has(climbDayKey(date));
              const isSel  = climbDayKey(date) === selKey;
              return (
                <TouchableOpacity
                  key={i}
                  style={s.cell}
                  disabled={!marked}
                  activeOpacity={0.7}
                  onPress={() => { onSelect(date); onClose(); }}>
                  <View style={[s.dayCircle, isSel && s.daySelected]}>
                    <Text style={[s.dayText, !marked && s.dayDim, isSel && s.daySelectedText]}>{d}</Text>
                  </View>
                  {marked && !isSel && <View style={s.dot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={s.clearBtn} onPress={() => { onSelect(null); onClose(); }} activeOpacity={0.7}>
            <Text style={s.clearText}>Show all dates</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  handle: {
    width: 40, height: 4, backgroundColor: 'rgba(26,20,8,0.15)',
    borderRadius: 2, alignSelf: 'center', marginBottom: 12,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  monthTitle: { fontSize: 17, fontFamily: 'Syne_800ExtraBold', color: INK, letterSpacing: -0.4 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: INK },
  dayText: { fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK },
  dayDim: { color: 'rgba(26,20,8,0.22)' },
  daySelectedText: { color: '#ffffff', fontFamily: 'SpaceGrotesk_700Bold' },
  dot: { position: 'absolute', bottom: 6, width: 5, height: 5, borderRadius: 2.5, backgroundColor: SAND },
  clearBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  clearText: { fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3 },
});
