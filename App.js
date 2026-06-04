import React, { useState, useEffect, useReducer, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Dimensions, Animated, StatusBar, Platform,
  Alert, KeyboardAvoidingView, BackHandler, PanResponder,
  Easing, Share, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const { width: SW, height: SH } = Dimensions.get('window');
const SPRING_CFG = { tension: 68, friction: 12, useNativeDriver: true };
const STORAGE_KEY = 'expenses_app_v1';

// ─── THEMES ──────────────────────────────────────────────────────────────────
const THEMES = {
  default: {
    bg: '#1C1B1F', surface: '#2B2930', surface2: '#322F37',
    text: '#E6E1E5', textSub: 'rgba(230,225,229,0.45)',
    border: 'rgba(255,255,255,0.07)', accentHi: '#B985FA',
    grad1: '#6750A4', grad2: '#9C68E8', nav: '#2B2930', cardGrad: '#6750A4',
  },
  amoled: {
    bg: '#000000', surface: '#0A0A0A', surface2: '#111111',
    text: '#FFFFFF', textSub: 'rgba(255,255,255,0.38)',
    border: 'rgba(255,255,255,0.06)', accentHi: '#D0BCFF',
    grad1: '#4A0080', grad2: '#7B2FBE', nav: '#050505', cardGrad: '#3D0075',
  },
};

// ─── CATEGORIES ──────────────────────────────────────────────────────────────
const CATS = [
  { name: 'Food',          icon: '🍔', color: '#4CAF50' },
  { name: 'Transport',     icon: '🚗', color: '#2196F3' },
  { name: 'Shopping',      icon: '🛍️', color: '#9C27B0' },
  { name: 'Entertainment', icon: '🎬', color: '#E91E63' },
  { name: 'Utilities',     icon: '💡', color: '#FF5722' },
  { name: 'Health',        icon: '💊', color: '#00BCD4' },
  { name: 'Education',     icon: '📚', color: '#FF9800' },
  { name: 'Travel',        icon: '✈️', color: '#3F51B5' },
  { name: 'Groceries',     icon: '🛒', color: '#8BC34A' },
  { name: 'Dining',        icon: '🍽️', color: '#F44336' },
  { name: 'Subscriptions', icon: '📱', color: '#673AB7' },
  { name: 'Other',         icon: '🎯', color: '#607D8B' },
];
const CM = Object.fromEntries(CATS.map(c => [c.name, c]));

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt      = n => '₹' + Number(n).toLocaleString('en-IN');
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthOf  = d => d?.slice(0, 7) ?? '';
const curMonth = () => new Date().toISOString().slice(0, 7);
const dispDate = d => {
  if (!d) return '';
  const t = todayStr(), y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (d === t) return 'Today';
  if (d === y) return 'Yesterday';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const weekOf = d => {
  const date = new Date(d);
  const day  = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const mon  = new Date(date.setDate(diff));
  return mon.toISOString().slice(0, 10);
};
const quarterOf = d => {
  const m = parseInt(d.slice(5, 7));
  const q = Math.ceil(m / 3);
  return `${d.slice(0, 4)}-Q${q}`;
};

// ─── REDUCER ─────────────────────────────────────────────────────────────────
const INIT_STATE = {
  expenses: [], budget: 15000, theme: 'default',
  pin: null, biometric: false,
  catBudgets: {}, recurring: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':           return { ...INIT_STATE, ...action.state };
    case 'ADD':            return { ...state, expenses: [{ ...action.payload, id: Date.now() }, ...state.expenses] };
    case 'EDIT':           return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE':         return { ...state, expenses: state.expenses.filter(e => e.id !== action.id) };
    case 'SET_BUDGET':     return { ...state, budget: action.budget };
    case 'SET_THEME':      return { ...state, theme: action.theme };
    case 'SET_PIN':        return { ...state, pin: action.pin };
    case 'SET_BIO':        return { ...state, biometric: action.biometric };
    case 'SET_CAT_BUDGET': return { ...state, catBudgets: { ...state.catBudgets, [action.cat]: action.amount } };
    case 'ADD_RECURRING':  return { ...state, recurring: [...state.recurring, { ...action.payload, id: Date.now() }] };
    case 'DEL_RECURRING':  return { ...state, recurring: state.recurring.filter(r => r.id !== action.id) };
    default:               return state;
  }
}

// ─── COUNT UP ─────────────────────────────────────────────────────────────────
function CountUp({ value, style, prefix = '₹', duration = 900 }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current, end = value, startTime = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - startTime) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + (end - start) * e));
      if (p < 1) requestAnimationFrame(tick); else prev.current = end;
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <Text style={style}>{prefix}{display.toLocaleString('en-IN')}</Text>;
}

// ─── ANIM PROGRESS BAR ────────────────────────────────────────────────────────
function AnimBar2({ pct, color, delay = 0, height = 5 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  const w = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 99, height }}>
      <Animated.View style={{ width: w, backgroundColor: color, borderRadius: 99, height, shadowColor: color, shadowOpacity: 0.4, shadowRadius: 3, elevation: 2 }} />
    </View>
  );
}

// ─── SLIDE SCREEN ────────────────────────────────────────────────────────────
function SlideScreen({ children, onClose, zIndex = 50, T }) {
  const translateY = useRef(new Animated.Value(SH)).current;
  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, ...SPRING_CFG }).start();
  }, []);
  const close = useCallback(() => {
    Animated.timing(translateY, { toValue: SH, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  }, [onClose]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => sub.remove();
  }, [close]);
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > SH * 0.28 || g.vy > 0.8) {
        Animated.timing(translateY, { toValue: SH, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
      } else {
        Animated.spring(translateY, { toValue: 0, ...SPRING_CFG }).start();
      }
    },
  })).current;
  return (
    <Animated.View style={[styles.slideScreen, { zIndex, backgroundColor: T.bg, transform: [{ translateY }] }]}>
      <View {...pan.panHandlers} style={styles.dragHandleArea}>
        <View style={styles.dragHandle} />
      </View>
      {children(close)}
    </Animated.View>
  );
}

// ─── EXPENSE ROW ─────────────────────────────────────────────────────────────
function Row({ expense, onPress, T, delay = 0 }) {
  const cat = CM[expense.category] ?? CM['Other'];
  const scale = useRef(new Animated.Value(1)).current;
  const slideX = useRef(new Animated.Value(-28)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideX,  { toValue: 0, duration: 380, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 320, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <TouchableOpacity
      onPress={() => onPress(expense)}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, ...SPRING_CFG }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, ...SPRING_CFG }).start()}
      activeOpacity={1}
    >
      <Animated.View style={[styles.row, { backgroundColor: T.surface, transform: [{ scale }, { translateX: slideX }], opacity }]}>
        <View style={[styles.rowIcon, { backgroundColor: cat.color + '28' }]}>
          <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: T.text }]}>{expense.title}</Text>
          <Text style={[styles.rowSub, { color: T.textSub }]}>{expense.category} · {dispDate(expense.date)}</Text>
        </View>
        <Text style={styles.rowAmount}>−{fmt(expense.amount)}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── ANIM BAR CHART ──────────────────────────────────────────────────────────
function AnimBar({ heightPct, color, delay, label, isActive }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: heightPct, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [heightPct]);
  const h = anim.interpolate({ inputRange: [0, 100], outputRange: [2, 56] });
  return (
    <View style={styles.barCol}>
      <Animated.View style={[styles.bar, { height: h, backgroundColor: color }]} />
      <Text style={[styles.barLabel, { color: isActive ? '#B985FA' : 'rgba(230,225,229,0.4)', fontWeight: isActive ? '700' : '400' }]}>{label}</Text>
    </View>
  );
}

// ─── INSIGHT CARD ─────────────────────────────────────────────────────────────
function InsightCard({ icon, text, color, T, delay = 0 }) {
  const slideY = useRef(new Animated.Value(18)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: 0, duration: 500, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.insightCard, { backgroundColor: color + '18', borderColor: color + '44', transform: [{ translateY: slideY }], opacity }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[styles.insightText, { color: T.text }]}>{text}</Text>
    </Animated.View>
  );
}

// ─── GENERATE INSIGHTS ────────────────────────────────────────────────────────
function generateInsights(expenses) {
  const insights = [];
  const mEx  = expenses.filter(e => monthOf(e.date) === curMonth());
  const lmEx = expenses.filter(e => monthOf(e.date) === (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })());
  const mTotal  = mEx.reduce((a, e) => a + e.amount, 0);
  const lmTotal = lmEx.reduce((a, e) => a + e.amount, 0);

  // vs last month
  if (lmTotal > 0) {
    const diff = Math.round(((mTotal - lmTotal) / lmTotal) * 100);
    if (diff < 0)  insights.push({ icon: '🎉', text: `You're spending ${Math.abs(diff)}% less than last month!`, color: '#4CAF50' });
    if (diff > 20) insights.push({ icon: '⚠️', text: `Spending is up ${diff}% compared to last month`, color: '#FF9800' });
  }

  // top category
  const ct = {};
  mEx.forEach(e => { ct[e.category] = (ct[e.category] || 0) + e.amount; });
  const top = Object.entries(ct).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const c = CM[top[0]] ?? CM['Other'];
    insights.push({ icon: c.icon, text: `${top[0]} is your biggest spend this month at ${fmt(top[1])}`, color: c.color });
  }

  // weekend vs weekday
  const wknd = mEx.filter(e => { const d = new Date(e.date).getDay(); return d === 0 || d === 6; }).reduce((a, e) => a + e.amount, 0);
  const wkdy = mEx.filter(e => { const d = new Date(e.date).getDay(); return d > 0 && d < 6; }).reduce((a, e) => a + e.amount, 0);
  const wkndDays = 8, wkdyDays = 22;
  if (wknd / wkndDays > (wkdy / wkdyDays) * 1.5 && wknd > 0) {
    insights.push({ icon: '🎭', text: `You spend ${Math.round((wknd/wkndDays)/(wkdy/wkdyDays))}x more per day on weekends`, color: '#E91E63' });
  }

  // streak
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (expenses.some(e => e.date === iso)) streak++; else break;
  }
  if (streak >= 3) insights.push({ icon: '🔥', text: `${streak}-day tracking streak! Keep it up`, color: '#FF9800' });

  if (insights.length === 0) insights.push({ icon: '💡', text: 'Add more expenses to unlock spending insights', color: '#B985FA' });
  return insights.slice(0, 3);
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
function HomeScreen({ expenses, budget, catBudgets, onRow, onQuickAdd, T }) {
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim   = useRef(new Animated.Value(0)).current;
  const chartAnim  = useRef(new Animated.Value(0)).current;
  const catsAnim   = useRef(new Animated.Value(0)).current;
  const budgetWidth = useRef(new Animated.Value(0)).current;

  const mEx   = expenses.filter(e => monthOf(e.date) === curMonth());
  const spent = mEx.reduce((a, e) => a + e.amount, 0);
  const pct   = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
  const WD    = ['M','T','W','T','F','S','S'];
  const bars  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return expenses.filter(e => e.date === d.toISOString().slice(0, 10)).reduce((a, e) => a + e.amount, 0);
  });
  const mb = Math.max(...bars, 1);
  const ct = {}; mEx.forEach(e => { ct[e.category] = (ct[e.category] || 0) + e.amount; });
  const top = Object.entries(ct).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const insights = generateInsights(expenses);
  const budgetWidthPct = budgetWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  useEffect(() => {
    Animated.stagger(75, [
      Animated.spring(headerAnim, { toValue: 1, ...SPRING_CFG }),
      Animated.spring(cardAnim,   { toValue: 1, ...SPRING_CFG }),
      Animated.spring(chartAnim,  { toValue: 1, ...SPRING_CFG }),
      Animated.spring(catsAnim,   { toValue: 1, ...SPRING_CFG }),
    ]).start();
    setTimeout(() => {
      Animated.timing(budgetWidth, { toValue: pct, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }, 300);
  }, []);

  const aS = anim => ({
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
      { scale:      anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  });

  // cat budget alerts
  const catAlerts = CATS.map(c => {
    const limit = catBudgets[c.name];
    if (!limit) return null;
    const catSpent = mEx.filter(e => e.category === c.name).reduce((a, e) => a + e.amount, 0);
    const catPct = Math.round((catSpent / limit) * 100);
    if (catPct < 70) return null;
    return { ...c, catSpent, limit, catPct };
  }).filter(Boolean);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Animated.View style={[styles.headerRow, aS(headerAnim)]}>
        <View>
          <Text style={[styles.greet, { color: T.textSub }]}>Good morning,</Text>
          <Text style={[styles.name,  { color: T.text }]}>Celestial ✨</Text>
        </View>
        <TouchableOpacity onPress={onQuickAdd} style={[styles.avatar, { backgroundColor: T.grad1 }]}>
          <Text style={{ fontSize: 18 }}>⚡</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Spending card */}
      <Animated.View style={[{ marginHorizontal: 16, marginBottom: 12 }, aS(cardAnim)]}>
        <View style={[styles.card, { backgroundColor: T.cardGrad }]}>
          <Text style={styles.cardLabel}>Total Spent — {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</Text>
          <CountUp value={spent} style={styles.cardAmount} />
          <View style={styles.cardRow}>
            {[['Budget', budget], ['Remaining', Math.max(budget - spent, 0)]].map(([l, v]) => (
              <View key={l} style={styles.cardPill}>
                <Text style={styles.cardPillLabel}>{l}</Text>
                <CountUp value={v} style={styles.cardPillValue} />
              </View>
            ))}
          </View>
          <View style={styles.budgetBarBg}>
            <Animated.View style={[styles.budgetBarFill, { width: budgetWidthPct, backgroundColor: pct > 85 ? '#FF8A80' : '#fff' }]} />
          </View>
          <Text style={styles.cardPct}>{pct}% of monthly budget used</Text>
        </View>
      </Animated.View>

      {/* Cat budget alerts */}
      {catAlerts.length > 0 && (
        <Animated.View style={[{ marginHorizontal: 16, marginBottom: 10 }, aS(catsAnim)]}>
          {catAlerts.map(c => (
            <View key={c.name} style={[styles.alertCard, { backgroundColor: (c.catPct >= 100 ? '#FF6B6B' : '#FF9800') + '18', borderColor: (c.catPct >= 100 ? '#FF6B6B' : '#FF9800') + '44' }]}>
              <Text style={{ fontSize: 16 }}>{c.icon}</Text>
              <Text style={[styles.alertText, { color: T.text }]}>
                {c.catPct >= 100 ? `Over budget on ${c.name}! Spent ${fmt(c.catSpent)} of ${fmt(c.limit)}` : `${c.name} at ${c.catPct}% of budget`}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Week chart */}
      <Animated.View style={[styles.section, { backgroundColor: T.surface }, aS(chartAnim)]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>This Week</Text>
          <Text style={[styles.sectionSub, { color: T.accentHi }]}>Last 7 days</Text>
        </View>
        <View style={styles.barsRow}>
          {bars.map((v, i) => (
            <AnimBar key={i} heightPct={Math.round((v / mb) * 100) || 4} color={i === 6 ? T.accentHi : 'rgba(103,80,164,0.35)'} delay={i * 55} label={WD[i]} isActive={i === 6} />
          ))}
        </View>
      </Animated.View>

      {/* Top cats */}
      {top.length > 0 && (
        <Animated.View style={[styles.topCatRow, aS(catsAnim)]}>
          {top.map(([name, amt]) => {
            const c = CM[name] ?? CM['Other'];
            const limit = catBudgets[name];
            const catPct = limit ? Math.min(Math.round((amt / limit) * 100), 100) : null;
            return (
              <View key={name} style={[styles.topCatCard, { backgroundColor: T.surface }]}>
                <Text style={{ fontSize: 20 }}>{c.icon}</Text>
                <Text style={[styles.topCatName, { color: T.textSub }]}>{name}</Text>
                <Text style={[styles.topCatAmt, { color: T.text }]}>{fmt(amt)}</Text>
                {catPct !== null && (
                  <View style={{ marginTop: 5 }}>
                    <AnimBar2 pct={catPct} color={catPct > 85 ? '#FF6B6B' : c.color} height={3} />
                  </View>
                )}
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* Insights */}
      {expenses.length > 2 && (
        <View style={{ marginHorizontal: 16, marginBottom: 4 }}>
          <Text style={[styles.sectionTitle, { color: T.text, marginBottom: 8 }]}>💡 Insights</Text>
          {insights.map((ins, i) => (
            <InsightCard key={i} icon={ins.icon} text={ins.text} color={ins.color} T={T} delay={i * 80} />
          ))}
        </View>
      )}

      {/* Recent */}
      <View style={styles.recentHeader}>
        <Text style={[styles.sectionTitle, { color: T.text }]}>Recent Expenses</Text>
        {expenses.length > 0 && <Text style={[styles.sectionSub, { color: T.accentHi }]}>Tap any row</Text>}
      </View>
      {expenses.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 44 }}>💸</Text>
          <Text style={[styles.emptyTitle, { color: T.text }]}>No expenses yet</Text>
          <Text style={[styles.emptySub, { color: T.textSub }]}>Tap ➕ to add your first one</Text>
        </View>
      ) : (
        expenses.slice(0, 8).map((e, i) => <Row key={e.id} expense={e} onPress={onRow} T={T} delay={i * 55} />)
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── TREND DETAIL ─────────────────────────────────────────────────────────────
function TrendDetail({ expenses, selectedMonth, onClose, T }) {
  const mEx    = expenses.filter(e => monthOf(e.date) === selectedMonth);
  const total  = mEx.reduce((a, e) => a + e.amount, 0);
  const days   = Array.from({ length: 31 }, (_, i) => {
    const d = `${selectedMonth}-${String(i + 1).padStart(2, '0')}`;
    return mEx.filter(e => e.date === d).reduce((a, e) => a + e.amount, 0);
  });
  const maxDay = Math.max(...days, 1);
  const ct = {}; mEx.forEach(e => { ct[e.category] = (ct[e.category] || 0) + e.amount; });
  const catData = Object.entries(ct).sort((a, b) => b[1] - a[1]);

  const exportCSV = async () => {
    const header = 'Title,Category,Amount,Date,Payment,Note';
    const rows   = mEx.map(e => `"${e.title}","${e.category}",${e.amount},"${e.date}","${e.payment || ''}","${e.note || ''}"`);
    const csv    = [header, ...rows].join('\n');
    try {
      await Share.share({ message: csv, title: `Expenses ${selectedMonth}.csv` });
    } catch (e) {}
  };

  return (
    <SlideScreen onClose={onClose} zIndex={60} T={T}>
      {(close) => (
        <>
          <View style={[styles.detailHero, { backgroundColor: T.grad1 + '22' }]}>
            <TouchableOpacity onPress={close} style={styles.backBtn}>
              <Text style={{ color: T.text, fontSize: 18 }}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={exportCSV} style={[styles.backBtn, { right: 20, left: undefined }]}>
              <Text style={{ fontSize: 16 }}>📤</Text>
            </TouchableOpacity>
            <Text style={[styles.detailTitle, { color: T.text, marginTop: 8 }]}>
              {new Date(selectedMonth + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
            <CountUp value={total} style={[styles.detailAmount, { color: T.accentHi }]} />
            <Text style={[styles.detailSub, { color: T.textSub }]}>{mEx.length} expenses</Text>
          </View>
          <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionTitle, { color: T.text, marginTop: 14, marginBottom: 10 }]}>Daily Spending</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 2, marginBottom: 16 }}>
              {days.map((v, i) => {
                const h = Math.max(Math.round((v / maxDay) * 64), v > 0 ? 4 : 2);
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ height: h, width: '100%', backgroundColor: v > 0 ? T.accentHi : 'rgba(103,80,164,0.15)', borderRadius: 3 }} />
                  </View>
                );
              })}
            </View>
            <Text style={[styles.sectionTitle, { color: T.text, marginBottom: 10 }]}>Category Breakdown</Text>
            {catData.map(([name, amt], i) => {
              const c = CM[name] ?? CM['Other'];
              const pct = Math.round((amt / (total || 1)) * 100);
              return (
                <View key={name} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ color: T.text, fontSize: 13 }}>{c.icon} {name}</Text>
                    <Text style={{ color: T.textSub, fontSize: 12 }}>{fmt(amt)} · {pct}%</Text>
                  </View>
                  <AnimBar2 pct={pct} color={c.color} delay={i * 70} />
                </View>
              );
            })}
            <Text style={[styles.sectionTitle, { color: T.text, marginBottom: 8, marginTop: 4 }]}>All Expenses</Text>
            {mEx.length === 0
              ? <Text style={{ color: T.textSub, fontSize: 13 }}>No expenses</Text>
              : mEx.map((e, i) => <Row key={e.id} expense={e} onPress={() => {}} T={T} delay={i * 45} />)
            }
            <View style={{ height: 24 }} />
          </ScrollView>
        </>
      )}
    </SlideScreen>
  );
}

// ─── STATS SCREEN ─────────────────────────────────────────────────────────────
function StatsScreen({ expenses, T }) {
  const allM = [...new Set(expenses.map(e => monthOf(e.date)))].sort().reverse();
  const [selM,       setSelM     ] = useState(curMonth());
  const [trendOpen,  setTrendOpen] = useState(false);
  const [trendMonth, setTrendMonth] = useState(null);
  const [view,       setView     ] = useState('monthly'); // weekly|monthly|quarterly|yearly

  const mEx   = expenses.filter(e => monthOf(e.date) === selM);
  const total = mEx.reduce((a, e) => a + e.amount, 0) || 1;
  const catD  = CATS.map(c => {
    const amt = mEx.filter(e => e.category === c.name).reduce((a, e) => a + e.amount, 0);
    return { ...c, amt, pct: Math.round((amt / total) * 100) };
  }).filter(c => c.amt > 0).sort((a, b) => b.amt - a.amt);

  // Build trend bars based on view
  const buildTrend = () => {
    if (view === 'weekly') {
      return Array.from({ length: 8 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (7 - i) * 7);
        const w = weekOf(d.toISOString().slice(0, 10));
        const v = expenses.filter(e => weekOf(e.date) === w).reduce((a, e) => a + e.amount, 0);
        return { label: `W${i + 1}`, value: v, key: w };
      });
    }
    if (view === 'monthly') {
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - 5 + i);
        const m = d.toISOString().slice(0, 7);
        const v = expenses.filter(e => monthOf(e.date) === m).reduce((a, e) => a + e.amount, 0);
        return { label: new Date(m + '-01').toLocaleString('en-IN', { month: 'short' }), value: v, key: m };
      });
    }
    if (view === 'quarterly') {
      return Array.from({ length: 4 }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - (3 - i) * 3);
        const q = quarterOf(d.toISOString().slice(0, 10));
        const v = expenses.filter(e => quarterOf(e.date) === q).reduce((a, e) => a + e.amount, 0);
        return { label: q.slice(-2), value: v, key: q };
      });
    }
    if (view === 'yearly') {
      return Array.from({ length: 3 }, (_, i) => {
        const yr = new Date().getFullYear() - 2 + i;
        const v  = expenses.filter(e => e.date?.startsWith(String(yr))).reduce((a, e) => a + e.amount, 0);
        return { label: String(yr), value: v, key: String(yr) };
      });
    }
    return [];
  };

  const trend = buildTrend();
  const tmx   = Math.max(...trend.map(t => t.value), 1);

  const exportAll = async () => {
    const header = 'Title,Category,Amount,Date,Payment,Note';
    const rows   = expenses.map(e => `"${e.title}","${e.category}",${e.amount},"${e.date}","${e.payment || ''}","${e.note || ''}"`);
    const csv    = [header, ...rows].join('\n');
    try { await Share.share({ message: csv, title: 'All Expenses.csv' }); } catch (e) {}
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={[styles.screenTitle, { color: T.text, paddingHorizontal: 0, paddingTop: 0 }]}>Analytics</Text>
          <TouchableOpacity onPress={exportAll} style={[styles.filterPill, { backgroundColor: T.surface }]}>
            <Text style={{ color: T.accentHi, fontSize: 12 }}>📤 Export</Text>
          </TouchableOpacity>
        </View>

        {expenses.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 44 }}>📊</Text>
            <Text style={[styles.emptyTitle, { color: T.text }]}>No data yet</Text>
            <Text style={[styles.emptySub, { color: T.textSub }]}>Add expenses to see analytics</Text>
          </View>
        ) : (
          <>
            {/* View toggle */}
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, backgroundColor: T.surface, borderRadius: 14, padding: 4 }}>
              {['weekly','monthly','quarterly','yearly'].map(v => (
                <TouchableOpacity key={v} onPress={() => setView(v)}
                  style={{ flex: 1, paddingVertical: 7, borderRadius: 11, backgroundColor: view === v ? T.grad1 : 'transparent', alignItems: 'center' }}>
                  <Text style={{ color: view === v ? '#fff' : T.textSub, fontSize: 10, fontWeight: view === v ? '700' : '400', textTransform: 'capitalize' }}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Trend bars */}
            <View style={[styles.section, { backgroundColor: T.surface }]}>
              <Text style={[styles.sectionTitle, { color: T.text, marginBottom: 4 }]}>
                {view.charAt(0).toUpperCase() + view.slice(1)} Trend
              </Text>
              <Text style={{ color: T.textSub, fontSize: 11, marginBottom: 14 }}>Tap any bar to see full breakdown</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 6 }}>
                {trend.map((t, i) => {
                  const h = Math.max(Math.round((t.value / tmx) * 80), t.value > 0 ? 5 : 2);
                  const isCur = i === trend.length - 1;
                  return (
                    <TouchableOpacity key={t.key} onPress={() => { if (view === 'monthly') { setTrendMonth(t.key); setTrendOpen(true); } }}
                      style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                      <Text style={{ color: T.textSub, fontSize: 8 }}>{t.value > 0 ? fmt(t.value).replace('₹','') : ''}</Text>
                      <View style={{ height: h, width: '100%', backgroundColor: isCur ? T.accentHi : T.grad1, borderRadius: 6, opacity: isCur ? 1 : 0.65 }} />
                      <Text style={{ color: isCur ? T.accentHi : T.textSub, fontSize: 9, fontWeight: isCur ? '700' : '400' }}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Month selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              {allM.slice(0, 6).map(m => (
                <TouchableOpacity key={m} onPress={() => setSelM(m)}
                  style={[styles.monthPill, { backgroundColor: selM === m ? T.grad1 : T.surface }]}>
                  <Text style={{ color: selM === m ? '#fff' : T.textSub, fontSize: 12, fontWeight: selM === m ? '700' : '400' }}>
                    {new Date(m + '-01').toLocaleString('en-IN', { month: 'short', year: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Breakdown */}
            <View style={[styles.section, { backgroundColor: T.surface }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.sectionTitle, { color: T.text }]}>
                  {new Date(selM + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={() => { setTrendMonth(selM); setTrendOpen(true); }}>
                  <Text style={{ color: T.accentHi, fontSize: 11 }}>Details →</Text>
                </TouchableOpacity>
              </View>
              <CountUp value={catD.reduce((a, c) => a + c.amt, 0)} style={{ color: T.accentHi, fontSize: 26, fontWeight: '800', marginBottom: 2 }} />
              <Text style={{ color: T.textSub, fontSize: 11, marginBottom: 14 }}>{mEx.length} expenses</Text>
              {catD.length === 0
                ? <Text style={{ color: T.textSub, fontSize: 13 }}>No expenses this month</Text>
                : catD.map((c, i) => (
                  <View key={c.name} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ color: T.text, fontSize: 13 }}>{c.icon} {c.name}</Text>
                      <Text style={{ color: T.textSub, fontSize: 12 }}>{fmt(c.amt)} · {c.pct}%</Text>
                    </View>
                    <AnimBar2 pct={c.pct} color={c.color} delay={i * 65} />
                  </View>
                ))
              }
            </View>
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
      {trendOpen && trendMonth && (
        <TrendDetail expenses={expenses} selectedMonth={trendMonth} onClose={() => setTrendOpen(false)} T={T} />
      )}
    </View>
  );
}

// ─── HISTORY SCREEN ───────────────────────────────────────────────────────────
function HistoryScreen({ expenses, onRow, T }) {
  const [search, setSearch] = useState('');
  const [catF,   setCatF  ] = useState('All');
  const fil = expenses.filter(e => {
    const mC = catF === 'All' || e.category === catF;
    const mT = (e.title + e.category).toLowerCase().includes(search.toLowerCase());
    return mC && mT;
  });
  const grp = {}; fil.forEach(e => { (grp[e.date] = grp[e.date] || []).push(e); });
  const dates = Object.keys(grp).sort().reverse();
  const uc = ['All', ...[...new Set(expenses.map(e => e.category))]];
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <Text style={[styles.screenTitle, { color: T.text }]}>History</Text>
      <View style={[styles.searchBar, { backgroundColor: T.surface }]}>
        <Text style={{ fontSize: 16, opacity: 0.5 }}>🔍</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search expenses…" placeholderTextColor={T.textSub} style={[styles.searchInput, { color: T.text }]} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color: T.textSub, fontSize: 16 }}>✕</Text></TouchableOpacity> : null}
      </View>
      {uc.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          {uc.map(c => (
            <TouchableOpacity key={c} onPress={() => setCatF(c)} style={[styles.filterPill, { backgroundColor: catF === c ? T.grad1 : T.surface, marginRight: 7 }]}>
              <Text style={{ color: catF === c ? '#fff' : T.textSub, fontSize: 11, fontWeight: catF === c ? '700' : '400' }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {expenses.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 44 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: T.text }]}>No history yet</Text>
          <Text style={[styles.emptySub, { color: T.textSub }]}>Your expenses will appear here</Text>
        </View>
      ) : fil.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 36 }}>🔍</Text>
          <Text style={[styles.emptySub, { color: T.textSub, marginTop: 8 }]}>No expenses found</Text>
        </View>
      ) : dates.map(date => (
        <View key={date}>
          <View style={styles.dateHeader}>
            <Text style={[styles.dateLabel, { color: T.accentHi }]}>{dispDate(date).toUpperCase()}</Text>
            <Text style={{ color: T.textSub, fontSize: 11 }}>{fmt(grp[date].reduce((a, e) => a + e.amount, 0))}</Text>
          </View>
          {grp[date].map((e, i) => <Row key={e.id} expense={e} onPress={onRow} T={T} delay={i * 50} />)}
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── DETAIL SCREEN ────────────────────────────────────────────────────────────
function DetailScreen({ expense, onClose, onDelete, onEdit, T }) {
  const cat = CM[expense?.category] ?? CM['Other'];
  const details = [
    ['📝', 'Note',     expense?.note || '—'],
    ['📅', 'Date',     dispDate(expense?.date) + ' · ' + expense?.date],
    ['🏷️', 'Category', expense?.category],
    ['💳', 'Payment',  expense?.payment || '—'],
    ['🔖', 'Status',   'Confirmed'],
  ];
  return (
    <SlideScreen onClose={onClose} zIndex={50} T={T}>
      {(close) => (
        <>
          <View style={[styles.detailHero, { backgroundColor: cat.color + '18' }]}>
            <TouchableOpacity onPress={close} style={styles.backBtn}>
              <Text style={{ color: T.text, fontSize: 18 }}>←</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 44, textAlign: 'center', marginBottom: 12 }}>{cat.icon}</Text>
            <Text style={[styles.detailTitle,  { color: T.text }]}>{expense?.title}</Text>
            <Text style={[styles.detailAmount, { color: cat.color }]}>−{fmt(expense?.amount ?? 0)}</Text>
            <Text style={[styles.detailSub,    { color: T.textSub }]}>{dispDate(expense?.date)} · {expense?.category}</Text>
          </View>
          <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
            {details.map(([icon, label, val]) => (
              <View key={label} style={[styles.detailRow, { borderBottomColor: T.border }]}>
                <View style={[styles.detailRowIcon, { backgroundColor: T.surface }]}>
                  <Text style={{ fontSize: 16 }}>{icon}</Text>
                </View>
                <View><Text style={{ color: T.textSub, fontSize: 10, marginBottom: 2 }}>{label.toUpperCase()}</Text><Text style={{ color: T.text, fontSize: 14, fontWeight: '500' }}>{val}</Text></View>
              </View>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>
          <View style={styles.detailActions}>
            <TouchableOpacity onPress={() => Alert.alert('Delete', 'Delete this expense?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { onDelete(expense.id); close(); } }])} style={styles.deleteBtn}>
              <Text style={{ color: '#FF6B6B', fontSize: 14, fontWeight: '600' }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { close(); setTimeout(() => onEdit(expense), 420); }} style={[styles.editBtn, { backgroundColor: T.grad1 }]}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Edit Expense</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SlideScreen>
  );
}

// ─── FORM SCREEN ──────────────────────────────────────────────────────────────
function FormScreen({ existing, onSave, onClose, T, quickAdd = false }) {
  const [title,     setTitle    ] = useState(existing?.title    ?? '');
  const [amount,    setAmount   ] = useState(existing?.amount ? String(existing.amount) : '');
  const [cat,       setCat      ] = useState(existing?.category ?? 'Food');
  const [date,      setDate     ] = useState(existing?.date     ?? todayStr());
  const [note,      setNote     ] = useState(existing?.note     ?? '');
  const [payment,   setPayment  ] = useState(existing?.payment  ?? 'UPI');
  const [recurring, setRecurring] = useState(false);
  const [recurFreq, setRecurFreq] = useState('monthly');
  const [saved,     setSaved    ] = useState(false);
  const [err,       setErr      ] = useState('');
  const [bounce,    setBounce   ] = useState(null);
  const payments = ['UPI', 'Cash', 'Credit Card', 'Debit Card', 'Net Banking', 'UPI · GPay', 'UPI · PhonePe', 'Other'];
  const pick = name => { setCat(name); setBounce(name); setTimeout(() => setBounce(null), 320); };
  const handleSave = (close) => {
    if (!title.trim())              { setErr('Please enter a title'); return; }
    if (!amount || Number(amount) <= 0) { setErr('Enter a valid amount'); return; }
    setSaved(true);
    setTimeout(() => {
      onSave({ id: existing?.id, title: title.trim(), amount: Number(amount), category: cat, date, note: note.trim(), payment, recurring, recurFreq });
      close();
    }, 700);
  };
  return (
    <SlideScreen onClose={onClose} zIndex={60} T={T}>
      {(close) => (
        <>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={close} style={styles.closeBtn}>
              <Text style={{ color: T.text, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.formTitle, { color: T.text }]}>{quickAdd ? '⚡ Quick Add' : existing ? 'Edit Expense' : 'Add Expense'}</Text>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={[styles.amountBox, { backgroundColor: T.surface }]}>
                <Text style={{ color: T.textSub, fontSize: 10, letterSpacing: 0.8, marginBottom: 6 }}>AMOUNT (₹)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: T.accentHi, fontSize: 26, fontWeight: '300' }}>₹</Text>
                  <TextInput value={amount} onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))} placeholder="0" placeholderTextColor={T.textSub} keyboardType="decimal-pad" style={[styles.amountInput, { color: T.text }]} />
                </View>
                <View style={{ height: 2, backgroundColor: T.accentHi, marginTop: 8, opacity: 0.5 }} />
              </View>
              <View style={[styles.formField, { backgroundColor: T.surface }]}>
                <Text style={[styles.fieldLabel, { color: T.textSub }]}>TITLE</Text>
                <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Grocery Shopping" placeholderTextColor={T.textSub} style={[styles.fieldInput, { color: T.text }]} />
              </View>
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: T.textSub, marginBottom: 8 }]}>CATEGORY</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CATS.map(c => (
                    <TouchableOpacity key={c.name} onPress={() => pick(c.name)} style={[styles.catPill, { backgroundColor: cat === c.name ? c.color + '28' : T.surface, borderColor: cat === c.name ? c.color : 'transparent', transform: [{ scale: bounce === c.name ? 1.12 : cat === c.name ? 1.04 : 1 }] }]}>
                      <Text style={{ fontSize: 13 }}>{c.icon}</Text>
                      <Text style={{ color: cat === c.name ? c.color : T.textSub, fontSize: 11, fontWeight: cat === c.name ? '700' : '400' }}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {!quickAdd && (
                <>
                  <View style={[styles.formField, { backgroundColor: T.surface }]}>
                    <Text style={[styles.fieldLabel, { color: T.textSub }]}>DATE (YYYY-MM-DD)</Text>
                    <TextInput value={date} onChangeText={setDate} placeholder="e.g. 2026-06-04" placeholderTextColor={T.textSub} style={[styles.fieldInput, { color: T.text }]} />
                  </View>
                  <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, { color: T.textSub, marginBottom: 8 }]}>PAYMENT</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {payments.map(p => (
                        <TouchableOpacity key={p} onPress={() => setPayment(p)} style={[styles.filterPill, { backgroundColor: payment === p ? T.grad1 : T.surface, marginRight: 7 }]}>
                          <Text style={{ color: payment === p ? '#fff' : T.textSub, fontSize: 11, fontWeight: payment === p ? '700' : '400' }}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <View style={[styles.formField, { backgroundColor: T.surface }]}>
                    <Text style={[styles.fieldLabel, { color: T.textSub }]}>NOTE (optional)</Text>
                    <TextInput value={note} onChangeText={setNote} placeholder="Add a note…" placeholderTextColor={T.textSub} style={[styles.fieldInput, { color: T.text }]} />
                  </View>
                  {/* Recurring toggle */}
                  <View style={[styles.formField, { backgroundColor: T.surface }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>🔁 Recurring</Text>
                        <Text style={{ color: T.textSub, fontSize: 11, marginTop: 2 }}>Auto-add this expense</Text>
                      </View>
                      <TouchableOpacity onPress={() => setRecurring(!recurring)} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: recurring ? T.grad1 : T.surface2, justifyContent: 'center', paddingHorizontal: 2 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: recurring ? 'flex-end' : 'flex-start' }} />
                      </TouchableOpacity>
                    </View>
                    {recurring && (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                        {['weekly', 'monthly', 'yearly'].map(f => (
                          <TouchableOpacity key={f} onPress={() => setRecurFreq(f)} style={[styles.filterPill, { backgroundColor: recurFreq === f ? T.grad1 : T.surface2 }]}>
                            <Text style={{ color: recurFreq === f ? '#fff' : T.textSub, fontSize: 11, fontWeight: recurFreq === f ? '700' : '400', textTransform: 'capitalize' }}>{f}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}
              {err ? <Text style={styles.errText}>{err}</Text> : null}
              <View style={{ height: 20 }} />
            </ScrollView>
          </KeyboardAvoidingView>
          <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <TouchableOpacity onPress={() => handleSave(close)} style={[styles.saveBtn, { backgroundColor: saved ? '#4CAF50' : T.grad1 }]}>
              <Text style={styles.saveBtnText}>{saved ? '✓ Saved!' : existing ? 'Save Changes' : 'Add Expense'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SlideScreen>
  );
}

// ─── SETTINGS SCREEN ──────────────────────────────────────────────────────────
function SettingsScreen({ state, dispatch, T }) {
  const [bi,       setBi      ] = useState(String(state.budget));
  const [saved,    setSaved   ] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [bioAvail, setBioAvail] = useState(false);
  const [catBudgetInput, setCatBudgetInput] = useState({});

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(has =>
      LocalAuthentication.isEnrolledAsync().then(enrolled => setBioAvail(has && enrolled))
    );
    const init = {};
    CATS.forEach(c => { init[c.name] = state.catBudgets?.[c.name] ? String(state.catBudgets[c.name]) : ''; });
    setCatBudgetInput(init);
  }, []);

  const saveBudget = () => {
    const v = Number(bi); if (!v || v < 0) return;
    dispatch({ type: 'SET_BUDGET', budget: v });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };
  const setPin = () => {
    if (pinInput.length < 4) { Alert.alert('PIN too short', 'Please enter at least 4 digits'); return; }
    dispatch({ type: 'SET_PIN', pin: pinInput }); setPinInput('');
    Alert.alert('PIN set!', 'Your PIN has been saved.');
  };
  const removePin = () => Alert.alert('Remove PIN', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => dispatch({ type: 'SET_PIN', pin: null }) }]);
  const clearAll  = () => Alert.alert('Clear All Data', 'Delete all expenses and reset everything?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: async () => { await AsyncStorage.removeItem(STORAGE_KEY); dispatch({ type: 'LOAD', state: INIT_STATE }); } }]);
  const total = state.expenses.reduce((a, e) => a + e.amount, 0);

  const exportAll = async () => {
    const header = 'Title,Category,Amount,Date,Payment,Note';
    const rows   = state.expenses.map(e => `"${e.title}","${e.category}",${e.amount},"${e.date}","${e.payment || ''}","${e.note || ''}"`);
    const csv    = [header, ...rows].join('\n');
    try { await Share.share({ message: csv, title: 'All Expenses.csv' }); } catch (e) {}
  };

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <Text style={[styles.screenTitle, { color: T.text }]}>Settings</Text>
      <View style={[styles.profileCard, { backgroundColor: T.grad1 }]}>
        <View style={styles.profileAvatar}><Text style={{ fontSize: 24 }}>🌙</Text></View>
        <View><Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Celestial</Text><Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{state.expenses.length} expenses · {fmt(total)}</Text></View>
      </View>
      <View style={styles.statRow}>
        {[['💸','Total',fmt(total)],['📊','This Month',fmt(state.expenses.filter(e=>monthOf(e.date)===curMonth()).reduce((a,e)=>a+e.amount,0))],['📁','Categories',String(new Set(state.expenses.map(e=>e.category)).size)]].map(([icon,l,v])=>(
          <View key={l} style={[styles.statCard,{backgroundColor:T.surface}]}><Text style={{fontSize:16}}>{icon}</Text><Text style={{color:T.textSub,fontSize:9,marginTop:4}}>{l}</Text><Text style={{color:T.text,fontSize:12,fontWeight:'700'}}>{v}</Text></View>
        ))}
      </View>

      {/* Appearance */}
      <View style={styles.settingSection}>
        <Text style={[styles.settingHeader, { color: T.accentHi }]}>APPEARANCE</Text>
        <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
          <Text style={{ color: T.textSub, fontSize: 10, marginBottom: 10 }}>THEME</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[['default','🌑 Default'],['amoled','⬛ AMOLED']].map(([key,label])=>(
              <TouchableOpacity key={key} onPress={()=>dispatch({type:'SET_THEME',theme:key})} style={[styles.themeBtn,{backgroundColor:state.theme===key?T.grad1:T.surface2}]}>
                <Text style={{color:state.theme===key?'#fff':T.textSub,fontSize:12,fontWeight:state.theme===key?'700':'400'}}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Budget */}
      <View style={styles.settingSection}>
        <Text style={[styles.settingHeader, { color: T.accentHi }]}>MONTHLY BUDGET</Text>
        <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={[styles.budgetInput, { backgroundColor: T.surface2 }]}>
              <Text style={{ color: T.accentHi, fontSize: 18 }}>₹</Text>
              <TextInput value={bi} onChangeText={t=>setBi(t.replace(/[^0-9]/g,''))} keyboardType="number-pad" style={[styles.budgetInputText,{color:T.text}]} />
            </View>
            <TouchableOpacity onPress={saveBudget} style={[styles.saveBudgetBtn,{backgroundColor:saved?'#4CAF50':T.grad1}]}>
              <Text style={{color:'#fff',fontSize:13,fontWeight:'700'}}>{saved?'✓':'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Category budgets */}
      <View style={styles.settingSection}>
        <Text style={[styles.settingHeader, { color: T.accentHi }]}>CATEGORY BUDGETS</Text>
        <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
          <Text style={{ color: T.textSub, fontSize: 11, marginBottom: 12 }}>Set individual limits per category</Text>
          {CATS.map((c, i) => (
            <View key={c.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottomWidth: i < CATS.length - 1 ? 1 : 0, borderBottomColor: T.border }}>
              <Text style={{ fontSize: 18 }}>{c.icon}</Text>
              <Text style={{ color: T.text, fontSize: 13, flex: 1 }}>{c.name}</Text>
              <View style={[styles.budgetInput, { backgroundColor: T.surface2, flex: 0, width: 110 }]}>
                <Text style={{ color: T.accentHi, fontSize: 14 }}>₹</Text>
                <TextInput
                  value={catBudgetInput[c.name] ?? ''}
                  onChangeText={t => setCatBudgetInput(prev => ({ ...prev, [c.name]: t.replace(/[^0-9]/g, '') }))}
                  onBlur={() => {
                    const v = Number(catBudgetInput[c.name]);
                    if (v > 0) dispatch({ type: 'SET_CAT_BUDGET', cat: c.name, amount: v });
                  }}
                  keyboardType="number-pad" placeholder="No limit"
                  placeholderTextColor={T.textSub}
                  style={[styles.budgetInputText, { color: T.text, fontSize: 13, flex: 1 }]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Security */}
      <View style={styles.settingSection}>
        <Text style={[styles.settingHeader, { color: T.accentHi }]}>SECURITY</Text>
        <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: T.border, paddingBottom: 14, marginBottom: 14 }}>
            <Text style={{ color: T.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>{state.pin ? '🔒 PIN is set' : '🔓 Set a PIN lock'}</Text>
            <TextInput value={pinInput} onChangeText={t=>setPinInput(t.replace(/[^0-9]/g,''))} placeholder="Enter new PIN (min 4 digits)" placeholderTextColor={T.textSub} keyboardType="number-pad" secureTextEntry maxLength={8} style={[styles.fieldInput,{color:T.text,backgroundColor:T.surface2,borderRadius:10,padding:10}]} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity onPress={setPin} style={[styles.saveBudgetBtn,{backgroundColor:T.grad1,flex:1,alignItems:'center'}]}><Text style={{color:'#fff',fontSize:13,fontWeight:'700'}}>Set PIN</Text></TouchableOpacity>
              {state.pin && <TouchableOpacity onPress={removePin} style={[styles.saveBudgetBtn,{backgroundColor:'rgba(244,67,54,0.2)',flex:1,alignItems:'center'}]}><Text style={{color:'#FF6B6B',fontSize:13,fontWeight:'700'}}>Remove</Text></TouchableOpacity>}
            </View>
          </View>
          {bioAvail ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.text, fontSize: 13 }}>Fingerprint / Face Unlock</Text>
                <Text style={{ color: T.textSub, fontSize: 11, marginTop: 2 }}>Use biometrics to unlock app</Text>
              </View>
              <TouchableOpacity onPress={()=>dispatch({type:'SET_BIO',biometric:!state.biometric})} style={{width:44,height:24,borderRadius:12,backgroundColor:state.biometric?T.grad1:T.surface2,justifyContent:'center',paddingHorizontal:2}}>
                <View style={{width:20,height:20,borderRadius:10,backgroundColor:'#fff',alignSelf:state.biometric?'flex-end':'flex-start'}} />
              </TouchableOpacity>
            </View>
          ) : <Text style={{ color: T.textSub, fontSize: 12 }}>No biometric hardware found</Text>}
        </View>
      </View>

      {/* Data */}
      <View style={styles.settingSection}>
        <Text style={[styles.settingHeader, { color: T.accentHi }]}>DATA</Text>
        <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
          <TouchableOpacity onPress={exportAll} style={[styles.settingRow,{borderBottomColor:T.border}]}>
            <Text style={{fontSize:16}}>📤</Text>
            <View style={{flex:1}}><Text style={{color:T.text,fontSize:13,fontWeight:'600'}}>Export CSV</Text><Text style={{color:T.textSub,fontSize:10}}>Export all expenses</Text></View>
            <Text style={{color:T.accentHi,fontSize:13}}>→</Text>
          </TouchableOpacity>
          <View style={[styles.settingRow,{borderBottomColor:T.border}]}>
            <Text style={{fontSize:16}}>💾</Text>
            <View style={{flex:1}}><Text style={{color:T.text,fontSize:13}}>Auto-Save</Text><Text style={{color:T.textSub,fontSize:10}}>Data saved on your device</Text></View>
            <View style={styles.onBadge}><Text style={{color:'#4CAF50',fontSize:10,fontWeight:'700'}}>ON</Text></View>
          </View>
          <TouchableOpacity onPress={clearAll} style={[styles.settingRow,{borderBottomWidth:0}]}>
            <Text style={{fontSize:16}}>🗑️</Text>
            <View style={{flex:1}}><Text style={{color:'#FF6B6B',fontSize:13,fontWeight:'600'}}>Clear All Data</Text><Text style={{color:T.textSub,fontSize:10}}>Resets everything to zero</Text></View>
            <Text style={{color:'rgba(255,107,107,0.5)',fontSize:13}}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// ─── LOCK SCREEN ──────────────────────────────────────────────────────────────
function LockScreen({ pin, biometric, onUnlock, T }) {
  const [input,    setInput   ] = useState('');
  const [error,    setError   ] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    if (biometric) tryBio();
  }, []);
  useEffect(() => {
    if (cooldown > 0) { const t = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(t); }
  }, [cooldown]);
  const tryBio = async () => {
    try { const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Expenses', fallbackLabel: 'Use PIN' }); if (r.success) onUnlock(); } catch (e) {}
  };
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };
  const press = digit => {
    if (cooldown > 0) return;
    const next = input + digit; setInput(next); setError(false);
    if (next.length >= (pin?.length ?? 4)) {
      if (next === pin) { onUnlock(); }
      else { shake(); setError(true); setInput(''); const na = attempts + 1; setAttempts(na); if (na >= 3) { setCooldown(30); setAttempts(0); } }
    }
  };
  const dots = Array.from({ length: pin?.length ?? 4 }, (_, i) => i < input.length);
  return (
    <Animated.View style={[styles.lockScreen, { backgroundColor: T.bg, opacity: fadeAnim }]}>
      <Text style={{ fontSize: 44, marginBottom: 16 }}>🔒</Text>
      <Text style={[styles.name, { color: T.text, marginBottom: 8 }]}>Celestial</Text>
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 32 }}>Enter your PIN to continue</Text>
      <Animated.View style={{ flexDirection: 'row', gap: 16, marginBottom: 24, transform: [{ translateX: shakeAnim }] }}>
        {dots.map((filled, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: filled ? T.accentHi : T.surface2, borderWidth: 1.5, borderColor: T.border }} />
        ))}
      </Animated.View>
      {error      && <Text style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 12 }}>Incorrect PIN</Text>}
      {cooldown>0 && <Text style={{ color: '#FF9800', fontSize: 13, marginBottom: 12 }}>Too many attempts. Wait {cooldown}s</Text>}
      <View style={{ width: 240 }}>
        {[[1,2,3],[4,5,6],[7,8,9],['bio',0,'del']].map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            {row.map(k => {
              if (k === 'bio') return <TouchableOpacity key={k} onPress={biometric?tryBio:undefined} style={[styles.numKey,{backgroundColor:biometric?T.surface:'transparent'}]}><Text style={{fontSize:22}}>{biometric?'👆':''}</Text></TouchableOpacity>;
              if (k === 'del') return <TouchableOpacity key={k} onPress={()=>setInput(i=>i.slice(0,-1))} style={[styles.numKey,{backgroundColor:T.surface}]}><Text style={{color:T.text,fontSize:20}}>⌫</Text></TouchableOpacity>;
              return <TouchableOpacity key={k} onPress={()=>press(String(k))} style={[styles.numKey,{backgroundColor:T.surface}]}><Text style={{color:T.text,fontSize:22,fontWeight:'600'}}>{k}</Text></TouchableOpacity>;
            })}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav({ tab, onChange, T }) {
  const fabScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(fabScale, { toValue: 1.06, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(fabScale, { toValue: 1,    duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={[styles.nav, { backgroundColor: T.nav, borderTopColor: T.border }]}>
      {[['🏠','home'],['📊','stats'],['➕','add'],['📋','history'],['⚙️','settings']].map(([icon,t]) =>
        t==='add' ? (
          <TouchableOpacity key={t} onPress={()=>onChange('add')}>
            <Animated.View style={[styles.fab,{backgroundColor:T.grad1,transform:[{scale:fabScale}]}]}>
              <Text style={{fontSize:24,color:'#fff'}}>➕</Text>
            </Animated.View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity key={t} onPress={()=>onChange(t)} style={[styles.navItem,{backgroundColor:tab===t?'rgba(103,80,164,0.18)':'transparent'}]}>
            <Text style={{fontSize:20,opacity:tab===t?1:0.38}}>{icon}</Text>
            <Text style={{fontSize:9,color:tab===t?T.accentHi:T.textSub,fontWeight:tab===t?'700':'400',textTransform:'capitalize'}}>{t}</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [state,      dispatch    ] = useReducer(reducer, INIT_STATE);
  const [tab,        setTab      ] = useState('home');
  const [loaded,     setLoaded   ] = useState(false);
  const [locked,     setLocked   ] = useState(false);
  const [detailEx,   setDetailEx ] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [formEx,     setFormEx   ] = useState(null);
  const [showForm,   setShowForm ] = useState(false);
  const [showQuick,  setShowQuick] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(s => {
      if (s) {
        try {
          const p = JSON.parse(s);
          dispatch({ type: 'LOAD', state: { ...INIT_STATE, ...p } });
          if (p.pin) setLocked(true);
        } catch (e) {}
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  const T = THEMES[state.theme] || THEMES.default;
  const handleNav    = t  => { if (t==='add') { setFormEx(null); setShowForm(true); return; } setTab(t); };
  const handleRow    = e  => { setDetailEx(e); setShowDetail(true); };
  const handleEdit   = e  => { setFormEx(e);   setShowForm(true);   };
  const handleDelete = id => { dispatch({ type: 'DELETE', id }); setShowDetail(false); };
  const handleSave   = p  => {
    if (p.id) dispatch({ type: 'EDIT', payload: p });
    else      dispatch({ type: 'ADD',  payload: p });
    if (p.recurring) dispatch({ type: 'ADD_RECURRING', payload: p });
  };

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1C1B1F', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 44 }}>💸</Text>
        <Text style={{ color: '#B985FA', fontSize: 14, marginTop: 12 }}>Loading…</Text>
      </View>
    );
  }
  if (locked) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor={T.bg} />
        <LockScreen pin={state.pin} biometric={state.biometric} onUnlock={() => setLocked(false)} T={T} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />
      {tab==='home'     && <HomeScreen     expenses={state.expenses} budget={state.budget} catBudgets={state.catBudgets||{}} onRow={handleRow} onQuickAdd={()=>setShowQuick(true)} T={T} />}
      {tab==='stats'    && <StatsScreen    expenses={state.expenses} T={T} />}
      {tab==='history'  && <HistoryScreen  expenses={state.expenses} onRow={handleRow} T={T} />}
      {tab==='settings' && <SettingsScreen state={state} dispatch={dispatch} T={T} />}
      <BottomNav tab={tab} onChange={handleNav} T={T} />
      {showDetail && detailEx && <DetailScreen expense={detailEx} onClose={()=>setShowDetail(false)} onDelete={handleDelete} onEdit={handleEdit} T={T} />}
      {showForm   && <FormScreen existing={formEx} onSave={handleSave} onClose={()=>setShowForm(false)} T={T} />}
      {showQuick  && <FormScreen existing={null} onSave={handleSave} onClose={()=>setShowQuick(false)} T={T} quickAdd={true} />}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:           { flex: 1 },
  headerRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  greet:          { fontSize: 12 },
  name:           { fontSize: 20, fontWeight: '700' },
  avatar:         { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  card:           { borderRadius: 22, padding: 20, overflow: 'hidden' },
  cardLabel:      { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 4 },
  cardAmount:     { color: '#fff', fontSize: 34, fontWeight: '700', letterSpacing: -1, marginBottom: 2 },
  cardRow:        { flexDirection: 'row', gap: 12, marginTop: 14 },
  cardPill:       { backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 11, padding: 10 },
  cardPillLabel:  { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
  cardPillValue:  { color: '#fff', fontSize: 13, fontWeight: '600' },
  budgetBarBg:    { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 99, height: 4, marginTop: 12 },
  budgetBarFill:  { borderRadius: 99, height: 4 },
  cardPct:        { color: 'rgba(255,255,255,0.55)', fontSize: 9, marginTop: 4 },
  section:        { marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 14 },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle:   { fontSize: 13, fontWeight: '600' },
  sectionSub:     { fontSize: 11 },
  barsRow:        { flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 5 },
  barCol:         { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  bar:            { width: '100%', borderRadius: 5 },
  barLabel:       { fontSize: 9 },
  topCatRow:      { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  topCatCard:     { flex: 1, borderRadius: 14, padding: 10 },
  topCatName:     { fontSize: 9, marginTop: 4 },
  topCatAmt:      { fontSize: 12, fontWeight: '700' },
  recentHeader:   { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  emptyBox:       { alignItems: 'center', padding: 48 },
  emptyTitle:     { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySub:       { fontSize: 13, marginTop: 6 },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 15, marginHorizontal: 16, marginBottom: 7 },
  rowIcon:        { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle:       { fontSize: 13, fontWeight: '600' },
  rowSub:         { fontSize: 11, marginTop: 2 },
  rowAmount:      { color: '#FF8A80', fontSize: 13, fontWeight: '700' },
  screenTitle:    { fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  monthPill:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 11, marginRight: 8 },
  filterPill:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  searchBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, padding: 10, borderRadius: 14 },
  searchInput:    { flex: 1, fontSize: 13 },
  dateHeader:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  dateLabel:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  nav:            { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 24, borderTopWidth: 1 },
  navItem:        { alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  fab:            { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: -14, shadowColor: '#6750A4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  slideScreen:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dragHandleArea: { alignItems: 'center', paddingVertical: 10 },
  dragHandle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  detailHero:     { padding: 24, paddingTop: 16, alignItems: 'center' },
  backBtn:        { position: 'absolute', top: 14, left: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  detailTitle:    { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  detailAmount:   { fontSize: 32, fontWeight: '800', textAlign: 'center', marginTop: 6, letterSpacing: -1 },
  detailSub:      { fontSize: 12, textAlign: 'center', marginTop: 4 },
  detailRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1 },
  detailRowIcon:  { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  detailActions:  { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 32 },
  deleteBtn:      { flex: 1, backgroundColor: 'rgba(244,67,54,0.14)', borderWidth: 1.5, borderColor: 'rgba(244,67,54,0.28)', borderRadius: 16, padding: 14, alignItems: 'center' },
  editBtn:        { flex: 2, borderRadius: 16, padding: 14, alignItems: 'center' },
  formHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  closeBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  formTitle:      { fontSize: 17, fontWeight: '700' },
  amountBox:      { marginHorizontal: 16, marginBottom: 12, borderRadius: 20, padding: 18, alignItems: 'center' },
  amountInput:    { fontSize: 42, fontWeight: '700', letterSpacing: -1, minWidth: 120, textAlign: 'center' },
  formField:      { marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 14 },
  fieldLabel:     { fontSize: 10, letterSpacing: 0.6, marginBottom: 4 },
  fieldInput:     { fontSize: 14 },
  catPill:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1.5, marginBottom: 4 },
  errText:        { color: '#FF6B6B', fontSize: 11, textAlign: 'center', marginBottom: 8 },
  saveBtn:        { borderRadius: 18, padding: 16, alignItems: 'center' },
  saveBtnText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  profileCard:    { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar:  { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  statRow:        { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },
  statCard:       { flex: 1, borderRadius: 14, padding: 10 },
  settingSection: { marginHorizontal: 16, marginBottom: 14 },
  settingHeader:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 7 },
  settingCard:    { borderRadius: 16, padding: 14 },
  settingRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  themeBtn:       { flex: 1, alignItems: 'center', padding: 10, borderRadius: 12 },
  budgetInput:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, padding: 12 },
  budgetInputText:{ flex: 1, fontSize: 16, fontWeight: '700' },
  saveBudgetBtn:  { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  onBadge:        { backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  lockScreen:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  numKey:         { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  insightCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  insightText:    { flex: 1, fontSize: 12, lineHeight: 17 },
  alertCard:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  alertText:      { flex: 1, fontSize: 12, lineHeight: 17 },
});
