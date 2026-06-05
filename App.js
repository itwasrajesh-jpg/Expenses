import React, {
  useState, useEffect, useReducer, useRef, useCallback
} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Dimensions, Animated, StatusBar, Platform,
  Alert, KeyboardAvoidingView, BackHandler, PanResponder,
  Easing, Share
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const { width: SW, height: SH } = Dimensions.get('window');
const SPRING = { tension: 68, friction: 12, useNativeDriver: true };
const STORAGE_KEY = 'expenses_app_v1';

// ─── THEMES ──────────────────────────────────────────────────────────────────
const THEMES = {
  default: {
    bg: '#1C1B1F', surface: '#2B2930', surface2: '#322F37',
    text: '#E6E1E5', sub: 'rgba(230,225,229,0.45)',
    border: 'rgba(255,255,255,0.07)', accent: '#B985FA',
    grad1: '#6750A4', grad2: '#9C68E8', nav: '#2B2930', card: '#6750A4',
  },
  amoled: {
    bg: '#000000', surface: '#0A0A0A', surface2: '#111111',
    text: '#FFFFFF', sub: 'rgba(255,255,255,0.38)',
    border: 'rgba(255,255,255,0.06)', accent: '#D0BCFF',
    grad1: '#4A0080', grad2: '#7B2FBE', nav: '#050505', card: '#3D0075',
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

// ─── FEATURES ────────────────────────────────────────────────────────────────
const FEATURES = [
  { id: 'income',      name: 'Income Tracking',  icon: '💰', color: '#4CAF50', desc: 'Salary, freelance & more' },
  { id: 'investments', name: 'Investments',       icon: '💹', color: '#2196F3', desc: 'Stocks, MF, FD, Gold' },
  { id: 'goals',       name: 'Financial Goals',   icon: '🎯', color: '#E91E63', desc: 'Save for trips & dreams' },
  { id: 'emi',         name: 'EMI Tracker',       icon: '🏦', color: '#FF9800', desc: 'Loans, home & car EMI' },
  { id: 'accounts',    name: 'Multiple Accounts', icon: '💳', color: '#9C27B0', desc: 'Cash, bank & UPI' },
  { id: 'split',       name: 'Bill Splitting',    icon: '🧾', color: '#00BCD4', desc: 'Split with friends' },
  { id: 'tax',         name: 'Tax Summary',       icon: '📊', color: '#8BC34A', desc: '80C, HRA & deductions' },
];

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

// ─── REDUCER ─────────────────────────────────────────────────────────────────
const INIT = {
  expenses: [], budget: 15000, theme: 'default', animLevel: 'full',
  pin: null, biometric: false, catBudgets: {},
  features: { income: false, investments: false, goals: false, emi: false, accounts: false, split: false, tax: false },
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':           return { ...INIT, ...action.state };
    case 'ADD':            return { ...state, expenses: [{ ...action.payload, id: Date.now() }, ...state.expenses] };
    case 'EDIT':           return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE':         return { ...state, expenses: state.expenses.filter(e => e.id !== action.id) };
    case 'SET_BUDGET':     return { ...state, budget: action.v };
    case 'SET_THEME':      return { ...state, theme: action.v };
    case 'SET_ANIM':       return { ...state, animLevel: action.v };
    case 'SET_PIN':        return { ...state, pin: action.v };
    case 'SET_BIO':        return { ...state, biometric: action.v };
    case 'SET_CAT_BUDGET': return { ...state, catBudgets: { ...state.catBudgets, [action.cat]: action.v } };
    case 'SET_FEATURE':    return { ...state, features: { ...state.features, [action.id]: action.v } };
    default:               return state;
  }
}

// ─── COUNT UP ─────────────────────────────────────────────────────────────────
function CountUp({ value, style, duration = 900 }) {
  const [disp, setDisp] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current, end = value, t0 = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(start + (end - start) * e));
      if (p < 1) requestAnimationFrame(tick); else prev.current = end;
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <Text style={style}>{'₹' + disp.toLocaleString('en-IN')}</Text>;
}

// ─── ANIM PROGRESS BAR ────────────────────────────────────────────────────────
function AnimBar({ pct, color, delay = 0, animLevel }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (animLevel === 'none') { anim.setValue(pct); return; }
    Animated.timing(anim, { toValue: pct, duration: animLevel === 'reduced' ? 500 : 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, animLevel]);
  const w = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 99, height: 5 }}>
      <Animated.View style={{ width: w, backgroundColor: color, borderRadius: 99, height: 5, shadowColor: color, shadowOpacity: 0.4, shadowRadius: 3, elevation: 2 }} />
    </View>
  );
}

// ─── SLIDE SCREEN ────────────────────────────────────────────────────────────
function SlideScreen({ children, onClose, zIndex = 50, T, animLevel }) {
  const ty = useRef(new Animated.Value(SH)).current;
  useEffect(() => {
    if (animLevel === 'none') { ty.setValue(0); return; }
    Animated.spring(ty, { toValue: 0, ...SPRING }).start();
  }, []);
  const close = useCallback(() => {
    if (animLevel === 'none') { onClose(); return; }
    Animated.timing(ty, { toValue: SH, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  }, [onClose, animLevel]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => sub.remove();
  }, [close]);
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) ty.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > SH * 0.28 || g.vy > 0.8) {
        Animated.timing(ty, { toValue: SH, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
      } else {
        Animated.spring(ty, { toValue: 0, ...SPRING }).start();
      }
    },
  })).current;
  return (
    <Animated.View style={[styles.slideScreen, { zIndex, backgroundColor: T.bg, transform: [{ translateY: ty }] }]}>
      <View {...pan.panHandlers} style={styles.dragHandleArea}>
        <View style={styles.dragHandle} />
      </View>
      {children(close)}
    </Animated.View>
  );
}

// ─── ROW ─────────────────────────────────────────────────────────────────────
function Row({ expense, onPress, T, delay = 0, animLevel }) {
  const cat = CM[expense.category] ?? CM['Other'];
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(animLevel === 'none' ? 0 : -28)).current;
  const op = useRef(new Animated.Value(animLevel === 'none' ? 1 : 0)).current;
  useEffect(() => {
    if (animLevel === 'none') return;
    Animated.parallel([
      Animated.timing(tx, { toValue: 0, duration: animLevel === 'reduced' ? 250 : 380, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: animLevel === 'reduced' ? 200 : 320, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <TouchableOpacity onPress={() => onPress(expense)}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, ...SPRING }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, ...SPRING }).start()}
      activeOpacity={1}>
      <Animated.View style={[styles.row, { backgroundColor: T.surface, transform: [{ scale }, { translateX: tx }], opacity: op }]}>
        <View style={[styles.rowIcon, { backgroundColor: cat.color + '28' }]}>
          <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: T.text }]}>{expense.title}</Text>
          <Text style={[styles.rowSub, { color: T.sub }]}>{expense.category} · {dispDate(expense.date)}</Text>
        </View>
        <Text style={styles.rowAmt}>−{fmt(expense.amount)}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── FLOATING BUBBLES (DOM-style via RAF, no React re-renders) ────────────────
// We render bubbles as Animated.View with direct ref manipulation
function BubbleField({ cats, onSelect, selected, T, animLevel, fieldH, bSize, collapsed, onCollapseChange }) {
  const W2 = SW;
  const PAD = bSize * 1.16;
  const cols = 3;
  const startX = (W2 - (cols - 1) * PAD) / 2;
  const startY = bSize / 2 + 10;

  const HOME = cats.map((_, i) => ({
    x: startX + (i % cols) * PAD + (Math.random() - 0.5) * PAD * 0.15,
    y: startY + Math.floor(i / cols) * PAD + (Math.random() - 0.5) * PAD * 0.12,
  }));
  const CX = W2 / 2, CY = fieldH / 2;

  const bs = useRef(cats.map((_, i) => ({
    x: CX, y: CY, tx: HOME[i].x, ty: HOME[i].y, homeX: HOME[i].x, homeY: HOME[i].y,
    sc: 0.01, tsc: 1, op: 0, top: 1, glow: 0,
    fax: 7 + Math.random() * 9, fay: 9 + Math.random() * 11,
    fsx: 0.26 + Math.random() * 0.32, fsy: 0.20 + Math.random() * 0.26,
    fpx: Math.random() * Math.PI * 2, fpy: Math.random() * Math.PI * 2,
    gpx: Math.random() * Math.PI * 2, gspd: 0.3 + Math.random() * 0.4,
    ft: Math.random() * 100, fb: 0,
  }))).current;

  const refs = useRef(cats.map(() => ({
    wrap: React.createRef(), glow: React.createRef(), circ: React.createRef(), lbl: React.createRef(),
  }))).current;

  const collRef = useRef(collapsed);
  const selRef  = useRef(selected);
  const rafRef  = useRef(null);

  useEffect(() => { collRef.current = collapsed; }, [collapsed]);
  useEffect(() => { selRef.current = selected; }, [selected]);

  // Fly in from random off-screen positions on mount (same as More tab)
  useEffect(() => {
    if (animLevel === 'none') {
      bs.forEach((b, i) => { b.x = b.homeX; b.y = b.homeY; b.sc = 1; b.op = 1; });
      return;
    }
    // Start all from random off-screen positions
    bs.forEach((b, i) => {
      const angle = Math.random() * Math.PI * 2;
      const launch = Math.max(SW, SH) * 0.85;
      b.x = CX + Math.cos(angle) * launch;
      b.y = CY + Math.sin(angle) * launch;
      b.sc = 0.1; b.op = 0; b.fb = 0;
    });
    // Stagger fly-in to home positions
    bs.forEach((b, i) => {
      setTimeout(() => { b.tx = HOME[i].x; b.ty = HOME[i].y; b.tsc = 1; b.top = 1; }, i * 55 + 200);
    });
  }, []);

  // For animLevel=none: apply positions directly, no animation
  useEffect(() => {
    if (animLevel !== 'none') return;
    // Apply positions directly to refs after a brief layout delay
    const t = setTimeout(() => {
      bs.forEach((b, i) => {
        const r = refs[i];
        if (r.wrap.current) {
          r.wrap.current.setNativeProps({
            style: {
              transform: [{ translateX: b.x - bSize / 2 }, { translateY: b.y - bSize / 2 }, { scale: 1 }],
              opacity: 1,
              zIndex: 1,
            }
          });
        }
      });
    }, 50);
    return () => clearTimeout(t);
  }, [animLevel]);

  // RAF loop — writes directly to refs
  useEffect(() => {
    if (animLevel === 'none') return;
    let last = performance.now();
    const lerp = (a, b, t) => a + (b - a) * t;
    const loop = now => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      bs.forEach((b, i) => {
        b.ft += dt;
        const fx = b.fax * Math.sin(b.ft * b.fsx + b.fpx);
        const fy = b.fay * Math.sin(b.ft * b.fsy + b.fpy);
        const isCollapsed = collRef.current;
        if (!isCollapsed) b.fb = Math.min(b.fb + dt * 0.5, 1);
        else b.fb = Math.max(b.fb - dt * 2, 0);
        const glowBase = selRef.current === i ? 0.28 : 0.08;
        const tglow = glowBase + 0.055 * Math.sin(b.ft * b.gspd + b.gpx);
        const sp = isCollapsed ? 0.072 : 0.065;
        b.x = lerp(b.x, b.tx + fx * b.fb, sp * 1.4);
        b.y = lerp(b.y, b.ty + fy * b.fb, sp * 1.4);
        b.sc = lerp(b.sc, b.tsc, sp * 1.8);
        b.op = lerp(b.op, b.top, sp * 1.8);
        b.glow = lerp(b.glow, tglow, 0.055);
      });
      // ── Repulsion: push overlapping bubbles apart ──────────────────────────
      const minDist = bSize * 1.08;
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          const dx = bs[j].x - bs[i].x;
          const dy = bs[j].y - bs[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (dist < minDist) {
            const overlap = (minDist - dist) / minDist;
            const force = overlap * 0.55; // gentle nudge
            const nx = dx / dist, ny = dy / dist;
            bs[i].x -= nx * force * bSize * 0.5;
            bs[i].y -= ny * force * bSize * 0.5;
            bs[j].x += nx * force * bSize * 0.5;
            bs[j].y += ny * force * bSize * 0.5;
          }
        }
      }
      bs.forEach((b, i) => {
        // Write to DOM via refs
        const r = refs[i];
        const cat = cats[i];
        const isSel = selRef.current === i;
        if (r.wrap.current) {
          r.wrap.current.setNativeProps({
            style: {
              transform: [{ translateX: b.x - bSize / 2 }, { translateY: b.y - bSize / 2 }, { scale: b.sc }],
              opacity: b.op,
              zIndex: isSel ? 20 : 1,
            }
          });
        }
      });  // end refs write forEach
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animLevel]);

  // Collapse / expand
  const collapseAll = useCallback(() => {
    const order = [...Array(cats.length).keys()].sort(() => Math.random() - 0.5);
    order.forEach((i, rank) => {
      setTimeout(() => { bs[i].tx = CX; bs[i].ty = CY; bs[i].tsc = 0.10; bs[i].top = 0.38; }, rank * 55);
    });
  }, []);
  const expandAll = useCallback(() => {
    bs.forEach(b => { b.x = CX; b.y = CY; b.sc = 0.12; b.op = 0.5; b.fb = 0; });
    const withDist = HOME.map((p, i) => ({ i, d: Math.hypot(p.x - CX, p.y - CY) })).sort((a, b) => b.d - a.d);
    withDist.forEach(({ i }, rank) => {
      setTimeout(() => { bs[i].tx = HOME[i].x; bs[i].ty = HOME[i].y; bs[i].tsc = 1; bs[i].top = 1; }, rank * 36);
    });
  }, []);

  useEffect(() => {
    if (collapsed) collapseAll(); else expandAll();
  }, [collapsed]);

  // Update selected visual
  useEffect(() => {
    if (animLevel === 'none') return;
    bs.forEach((b, j) => {
      b.tsc = selected === j ? 1.13 : selected === -1 ? 1 : 0.9;
      b.top = selected === j ? 1 : selected === -1 ? 1 : 0.4;
    });
  }, [selected]);

  return (
    <View style={{ width: SW, height: fieldH, position: 'relative' }}>
      {cats.map((cat, i) => (
        <Animated.View key={cat.name} ref={refs[i].wrap}
          style={{ position: 'absolute', width: bSize, height: bSize, opacity: 0 }}>
          <TouchableOpacity onPress={() => onSelect(i)} activeOpacity={0.9}
            style={{ width: bSize, height: bSize, alignItems: 'center' }}>
            {/* Glow */}
            <View ref={refs[i].glow} style={{ position: 'absolute', top: -bSize * 0.22, left: -bSize * 0.22, right: -bSize * 0.22, bottom: -bSize * 0.22, borderRadius: 999, backgroundColor: cat.color, opacity: 0.08 }} />
            {/* Circle */}
            <View ref={refs[i].circ}
              style={{ width: bSize, height: bSize, borderRadius: bSize / 2, backgroundColor: cat.color + '28', borderWidth: 2, borderColor: cat.color + '99', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {/* Shine */}
              <View style={{ position: 'absolute', top: '10%', left: '14%', width: '28%', height: '18%', borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.25)' }} />
              <Text style={{ fontSize: bSize * 0.36, lineHeight: bSize * 0.44 }}>{cat.icon}</Text>
              <Text ref={refs[i].lbl} style={{ fontSize: bSize * 0.13, color: cat.color + 'cc', fontWeight: '500', marginTop: bSize * 0.04, textAlign: 'center' }}>{cat.name}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
function HomeScreen({ state, dispatch, onRow, onQuickAdd, T, animLevel, collapsed, setCollapsed }) {
  const mEx   = state.expenses.filter(e => monthOf(e.date) === curMonth());
  const spent = mEx.reduce((a, e) => a + e.amount, 0);
  const pct   = state.budget > 0 ? Math.min(Math.round((spent / state.budget) * 100), 100) : 0;
  const WD    = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const bars  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return state.expenses.filter(e => e.date === d.toISOString().slice(0, 10)).reduce((a, e) => a + e.amount, 0);
  });
  const mb  = Math.max(...bars, 1);
  const ct  = {}; mEx.forEach(e => { ct[e.category] = (ct[e.category] || 0) + e.amount; });
  const top = Object.entries(ct).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const budgetWidth = useRef(new Animated.Value(0)).current;
  const headerAnim  = useRef(new Animated.Value(animLevel === 'none' ? 1 : 0)).current;
  const cardAnim    = useRef(new Animated.Value(animLevel === 'none' ? 1 : 0)).current;
  const chartAnim   = useRef(new Animated.Value(animLevel === 'none' ? 1 : 0)).current;
  const catsAnim    = useRef(new Animated.Value(animLevel === 'none' ? 1 : 0)).current;

  const [selBbl,    setSelBbl]    = useState(-1);
  const [sheetCat,  setSheetCat]  = useState(null);

  const BSIZE = Math.min(SW * 0.185, 78);
  const ROWS  = 4;
  const FIELD_H = (ROWS - 1) * BSIZE * 1.16 + BSIZE + 20;

  useEffect(() => {
    if (animLevel === 'none') return;
    Animated.stagger(75, [
      Animated.spring(headerAnim, { toValue: 1, ...SPRING }),
      Animated.spring(cardAnim,   { toValue: 1, ...SPRING }),
      Animated.spring(chartAnim,  { toValue: 1, ...SPRING }),
      Animated.spring(catsAnim,   { toValue: 1, ...SPRING }),
    ]).start();
    setTimeout(() => {
      Animated.timing(budgetWidth, { toValue: pct, duration: animLevel === 'reduced' ? 600 : 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }, 300);
  }, []);

  const aS = anim => ({
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
      { scale:      anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  });
  const budgetW = budgetWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  // Cat budget alerts
  const catAlerts = CATS.map(c => {
    const limit = state.catBudgets?.[c.name];
    if (!limit) return null;
    const catSpent = mEx.filter(e => e.category === c.name).reduce((a, e) => a + e.amount, 0);
    const catPct = Math.round((catSpent / limit) * 100);
    if (catPct < 70) return null;
    return { ...c, catSpent, limit, catPct };
  }).filter(Boolean);

  // Insights
  const insights = [];
  const lmEx = state.expenses.filter(e => { const d = new Date(); d.setMonth(d.getMonth() - 1); return monthOf(e.date) === d.toISOString().slice(0, 7); });
  const mTotal = mEx.reduce((a, e) => a + e.amount, 0);
  const lmTotal = lmEx.reduce((a, e) => a + e.amount, 0);
  if (lmTotal > 0) {
    const diff = Math.round(((mTotal - lmTotal) / lmTotal) * 100);
    if (diff < 0) insights.push({ icon: '🎉', text: `Spending ${Math.abs(diff)}% less than last month!`, color: '#4CAF50' });
    if (diff > 20) insights.push({ icon: '⚠️', text: `Spending up ${diff}% vs last month`, color: '#FF9800' });
  }
  if (top[0]) {
    const c = CM[top[0][0]] ?? CM['Other'];
    insights.push({ icon: c.icon, text: `${top[0][0]} is your biggest spend at ${fmt(top[0][1])}`, color: c.color });
  }
  if (insights.length === 0) insights.push({ icon: '💡', text: 'Add more expenses to unlock insights', color: '#B985FA' });

  const handleBbl = i => {
    if (collapsed) { setCollapsed(false); return; }
    if (selBbl === i) { setSelBbl(-1); return; }
    setSelBbl(i);
    setSheetCat(CATS[i]);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View style={[styles.headerRow, aS(headerAnim)]}>
          <View>
            <Text style={[styles.greet, { color: T.sub }]}>Good morning,</Text>
            <Text style={[styles.name,  { color: T.text }]}>Celestial ✨</Text>
          </View>
          <TouchableOpacity onPress={onQuickAdd} style={[styles.avatar, { backgroundColor: T.grad1 }]}>
            <Text style={{ fontSize: 18 }}>⚡</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Card */}
        <Animated.View style={[{ marginHorizontal: 16, marginBottom: 12 }, aS(cardAnim)]}>
          <View style={[styles.card, { backgroundColor: T.card }]}>
            <Text style={styles.cardLabel}>Total Spent — {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</Text>
            <CountUp value={spent} style={styles.cardAmt} />
            <View style={styles.cardRow}>
              {[['Budget', state.budget], ['Remaining', Math.max(state.budget - spent, 0)]].map(([l, v]) => (
                <View key={l} style={styles.cardPill}>
                  <Text style={styles.cardPillLbl}>{l}</Text>
                  <CountUp value={v} style={styles.cardPillVal} />
                </View>
              ))}
            </View>
            <View style={styles.budgetBg}>
              <Animated.View style={[styles.budgetFill, { width: budgetW, backgroundColor: pct > 85 ? '#FF8A80' : '#fff' }]} />
            </View>
            <Text style={styles.cardPct}>{pct}% of monthly budget used</Text>
          </View>
        </Animated.View>

        {/* Cat budget alerts */}
        {catAlerts.length > 0 && (
          <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
            {catAlerts.map(c => (
              <View key={c.name} style={[styles.alertCard, { backgroundColor: (c.catPct >= 100 ? '#FF6B6B' : '#FF9800') + '18', borderColor: (c.catPct >= 100 ? '#FF6B6B' : '#FF9800') + '44' }]}>
                <Text style={{ fontSize: 16 }}>{c.icon}</Text>
                <Text style={{ color: T.text, fontSize: 12, flex: 1, lineHeight: 17 }}>
                  {c.catPct >= 100 ? `Over budget on ${c.name}! ${fmt(c.catSpent)} of ${fmt(c.limit)}` : `${c.name} at ${c.catPct}% of ₹${c.limit} budget`}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Week chart */}
        <Animated.View style={[styles.section, { backgroundColor: T.surface }, aS(chartAnim)]}>
          <View style={styles.secHeader}>
            <Text style={[styles.secTitle, { color: T.text }]}>This Week</Text>
            <Text style={{ color: T.accent, fontSize: 10 }}>Last 7 days</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 56, gap: 5 }}>
            {bars.map((v, i) => {
              const h = Math.max(Math.round((v / mb) * 52), 3);
              const isCur = i === 6;
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  <View style={{ width: '100%', height: h, borderRadius: 5, backgroundColor: isCur ? T.accent : 'rgba(103,80,164,0.3)' }} />
                  <Text style={{ fontSize: 9, color: isCur ? T.accent : T.sub, fontWeight: isCur ? '700' : '400' }}>{WD[i]}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Top cats */}
        {top.length > 0 && (
          <Animated.View style={[{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 }, aS(catsAnim)]}>
            {top.map(([name, amt]) => {
              const c = CM[name] ?? CM['Other'];
              const limit = state.catBudgets?.[name];
              const cp = limit ? Math.min(Math.round((amt / limit) * 100), 100) : null;
              return (
                <View key={name} style={[{ flex: 1, borderRadius: 14, padding: 10 }, { backgroundColor: T.surface }]}>
                  <Text style={{ fontSize: 20 }}>{c.icon}</Text>
                  <Text style={{ color: T.sub, fontSize: 9, marginTop: 3 }}>{name}</Text>
                  <Text style={{ color: T.text, fontSize: 12, fontWeight: '700' }}>{fmt(amt)}</Text>
                  {cp !== null && (
                    <View style={{ marginTop: 5 }}>
                      <AnimBar pct={cp} color={cp > 85 ? '#FF6B6B' : c.color} height={3} animLevel={animLevel} />
                    </View>
                  )}
                </View>
              );
            })}
          </Animated.View>
        )}

        {/* Insights */}
        {state.expenses.length > 2 && (
          <View style={{ marginHorizontal: 16, marginBottom: 4 }}>
            <Text style={[styles.secTitle, { color: T.text, marginBottom: 8 }]}>💡 Insights</Text>
            {insights.map((ins, i) => (
              <View key={i} style={[styles.insightCard, { backgroundColor: ins.color + '18', borderColor: ins.color + '44' }]}>
                <Text style={{ fontSize: 18 }}>{ins.icon}</Text>
                <Text style={{ color: T.text, fontSize: 12, flex: 1, lineHeight: 17 }}>{ins.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bubbles section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={[styles.secTitle, { color: T.text }]}>Categories</Text>
          <TouchableOpacity onPress={() => { setCollapsed(prev => !prev); setSelBbl(-1); }}
            style={{ backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.accent + '55', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12 }}>{collapsed ? '✨' : '🔵'}</Text>
            <Text style={{ color: T.accent, fontSize: 11, fontWeight: '700' }}>{collapsed ? 'Expand' : 'Collapse'}</Text>
          </TouchableOpacity>
        </View>

        <BubbleField
          cats={CATS} onSelect={handleBbl} selected={selBbl} T={T}
          animLevel={animLevel} fieldH={FIELD_H} bSize={BSIZE}
          collapsed={collapsed} onCollapseChange={setCollapsed}
        />

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Category sheet */}
      {sheetCat && selBbl >= 0 && (
        <SlideScreen onClose={() => { setSelBbl(-1); setSheetCat(null); }} zIndex={50} T={T} animLevel={animLevel}>
          {close => {
            const cat = sheetCat;
            const catEx = state.expenses.filter(e => e.category === cat.name);
            const catTotal = catEx.reduce((a, e) => a + e.amount, 0);
            const catPct = catTotal > 0 && mEx.reduce((a, e) => a + e.amount, 0) > 0
              ? Math.round((catTotal / mEx.reduce((a, e) => a + e.amount, 0)) * 100) : 0;
            return (
              <>
                <View style={[styles.detailHero, { backgroundColor: cat.color + '18' }]}>
                  <TouchableOpacity onPress={close} style={styles.backBtn}>
                    <Text style={{ color: T.text, fontSize: 18 }}>←</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 44, textAlign: 'center', marginBottom: 12 }}>{cat.icon}</Text>
                  <Text style={[styles.detailTitle, { color: T.text }]}>{cat.name}</Text>
                  <Text style={[styles.detailAmt, { color: cat.color }]}>{fmt(catTotal)}</Text>
                  <Text style={{ color: T.sub, fontSize: 12, textAlign: 'center', marginTop: 4 }}>{catPct}% of this month's spending</Text>
                </View>
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {catEx.length === 0
                    ? <View style={styles.emptyBox}><Text style={{ fontSize: 36 }}>💸</Text><Text style={[styles.emptyTitle, { color: T.sub }]}>No expenses yet</Text></View>
                    : catEx.slice(0, 15).map((e, idx) => <Row key={e.id} expense={e} onPress={(exp) => { onRow(exp); }} T={T} delay={idx * 50} animLevel={animLevel} />)
                  }
                  <View style={{ height: 24 }} />
                </ScrollView>
              </>
            );
          }}
        </SlideScreen>
      )}
    </View>
  );
}

// ─── STATS SCREEN ─────────────────────────────────────────────────────────────
function StatsScreen({ expenses, T, animLevel }) {
  const allM = [...new Set(expenses.map(e => monthOf(e.date)))].sort().reverse();
  const [selM,  setSelM]  = useState(curMonth());
  const [view,  setView]  = useState('Monthly');
  const [selSeg, setSelSeg] = useState(-1);
  const [trendOpen, setTrendOpen] = useState(false);
  const [trendMonth, setTrendMonth] = useState(null);

  const mEx   = expenses.filter(e => monthOf(e.date) === selM);
  const total = mEx.reduce((a, e) => a + e.amount, 0) || 1;
  const catD  = CATS.map(c => {
    const amt = mEx.filter(e => e.category === c.name).reduce((a, e) => a + e.amount, 0);
    return { ...c, amt, pct: Math.round((amt / total) * 100) };
  }).filter(c => c.amt > 0).sort((a, b) => b.amt - a.amt);

  const buildTrend = () => {
    if (view === 'Weekly') return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (7 - i) * 7);
      const w = d.toISOString().slice(0, 10);
      return { label: `W${i + 1}`, value: expenses.filter(e => Math.abs(new Date(e.date) - new Date(w)) < 7 * 86400000).reduce((a, e) => a + e.amount, 0), key: null };
    });
    if (view === 'Monthly') return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - 5 + i);
      const m = d.toISOString().slice(0, 7);
      return { label: new Date(m + '-01').toLocaleString('en-IN', { month: 'short' }), value: expenses.filter(e => monthOf(e.date) === m).reduce((a, e) => a + e.amount, 0), key: m };
    });
    if (view === 'Quarterly') return Array.from({ length: 4 }, (_, i) => {
      const q = i + 1;
      const months = [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3].map(m => `2026-${String(m).padStart(2, '0')}`);
      return { label: `Q${q}`, value: expenses.filter(e => months.includes(monthOf(e.date))).reduce((a, e) => a + e.amount, 0), key: null };
    });
    if (view === 'Yearly') return Array.from({ length: 3 }, (_, i) => {
      const yr = new Date().getFullYear() - 2 + i;
      return { label: String(yr), value: expenses.filter(e => e.date?.startsWith(String(yr))).reduce((a, e) => a + e.amount, 0), key: null };
    });
    return [];
  };
  const trend = buildTrend();
  const tmx = Math.max(...trend.map(t => t.value), 1);

  const exportCSV = async () => {
    const header = 'Title,Category,Amount,Date,Payment,Note';
    const rows = expenses.map(e => `"${e.title}","${e.category}",${e.amount},"${e.date}","${e.payment || ''}","${e.note || ''}"`);
    try { await Share.share({ message: [header, ...rows].join('\n'), title: 'Expenses.csv' }); } catch (e) {}
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={[styles.screenTitle, { color: T.text, paddingHorizontal: 0, paddingTop: 0 }]}>Analytics</Text>
          <TouchableOpacity onPress={exportCSV} style={[styles.filterPill, { backgroundColor: T.surface }]}>
            <Text style={{ color: T.accent, fontSize: 12 }}>📤 Export</Text>
          </TouchableOpacity>
        </View>

        {expenses.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 44 }}>📊</Text>
            <Text style={[styles.emptyTitle, { color: T.text }]}>No data yet</Text>
            <Text style={{ color: T.sub, fontSize: 13, marginTop: 6 }}>Add expenses to see analytics</Text>
          </View>
        ) : (
          <>
            {/* View toggle */}
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, backgroundColor: T.surface, borderRadius: 14, padding: 4 }}>
              {['Weekly', 'Monthly', 'Quarterly', 'Yearly'].map(v => (
                <TouchableOpacity key={v} onPress={() => setView(v)}
                  style={{ flex: 1, paddingVertical: 7, borderRadius: 11, backgroundColor: view === v ? T.grad1 : 'transparent', alignItems: 'center' }}>
                  <Text style={{ color: view === v ? '#fff' : T.sub, fontSize: 10, fontWeight: view === v ? '700' : '400' }}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Trend bars */}
            <View style={[styles.section, { backgroundColor: T.surface }]}>
              <Text style={[styles.secTitle, { color: T.text, marginBottom: 4 }]}>{view} Trend</Text>
              <Text style={{ color: T.sub, fontSize: 11, marginBottom: 14 }}>Tap any bar to see full breakdown</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 6 }}>
                {trend.map((t, i) => {
                  const h = Math.max(Math.round((t.value / tmx) * 80), t.value > 0 ? 5 : 2);
                  const isCur = i === trend.length - 1;
                  return (
                    <TouchableOpacity key={i} onPress={() => { if (t.key) { setTrendMonth(t.key); setTrendOpen(true); } else if (view === 'Monthly') {} }}
                      style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                      <Text style={{ color: T.sub, fontSize: 8 }}>{t.value > 0 ? fmt(t.value).replace('₹', '') : ''}</Text>
                      <View style={{ height: h, width: '100%', backgroundColor: isCur ? T.accent : T.grad1, borderRadius: 6, opacity: isCur ? 1 : 0.65 }} />
                      <Text style={{ color: isCur ? T.accent : T.sub, fontSize: 9, fontWeight: isCur ? '700' : '400' }}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Month pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              {allM.slice(0, 6).map(m => (
                <TouchableOpacity key={m} onPress={() => setSelM(m)}
                  style={[styles.monthPill, { backgroundColor: selM === m ? T.grad1 : T.surface }]}>
                  <Text style={{ color: selM === m ? '#fff' : T.sub, fontSize: 12, fontWeight: selM === m ? '700' : '400' }}>
                    {new Date(m + '-01').toLocaleString('en-IN', { month: 'short', year: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Breakdown */}
            <View style={[styles.section, { backgroundColor: T.surface }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.secTitle, { color: T.text }]}>
                  {new Date(selM + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={() => { setTrendMonth(selM); setTrendOpen(true); }}>
                  <Text style={{ color: T.accent, fontSize: 11 }}>Details →</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: T.accent, fontSize: 26, fontWeight: '800', marginBottom: 2 }}>{fmt(catD.reduce((a, c) => a + c.amt, 0))}</Text>
              <Text style={{ color: T.sub, fontSize: 11, marginBottom: 14 }}>{mEx.length} expenses</Text>
              {catD.length === 0
                ? <Text style={{ color: T.sub, fontSize: 13 }}>No expenses this month</Text>
                : catD.map((c, i) => (
                  <View key={c.name} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ color: T.text, fontSize: 13 }}>{c.icon} {c.name}</Text>
                      <Text style={{ color: T.sub, fontSize: 12 }}>{fmt(c.amt)} · {c.pct}%</Text>
                    </View>
                    <AnimBar pct={c.pct} color={c.color} delay={i * 65} animLevel={animLevel} />
                  </View>
                ))
              }
            </View>
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {trendOpen && trendMonth && (
        <SlideScreen onClose={() => setTrendOpen(false)} zIndex={60} T={T} animLevel={animLevel}>
          {close => {
            const tEx = expenses.filter(e => monthOf(e.date) === trendMonth);
            const tTot = tEx.reduce((a, e) => a + e.amount, 0);
            const days = Array.from({ length: 31 }, (_, i) => {
              const d = `${trendMonth}-${String(i + 1).padStart(2, '0')}`;
              return tEx.filter(e => e.date === d).reduce((a, e) => a + e.amount, 0);
            });
            const maxDay = Math.max(...days, 1);
            const ct2 = {}; tEx.forEach(e => { ct2[e.category] = (ct2[e.category] || 0) + e.amount; });
            const catData = Object.entries(ct2).sort((a, b) => b[1] - a[1]);
            return (
              <>
                <View style={[styles.detailHero, { backgroundColor: T.grad1 + '22' }]}>
                  <TouchableOpacity onPress={close} style={styles.backBtn}><Text style={{ color: T.text, fontSize: 18 }}>←</Text></TouchableOpacity>
                  <Text style={[styles.detailTitle, { color: T.text, marginTop: 8 }]}>{new Date(trendMonth + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</Text>
                  <Text style={[styles.detailAmt, { color: T.accent }]}>{fmt(tTot)}</Text>
                  <Text style={{ color: T.sub, fontSize: 12, textAlign: 'center', marginTop: 4 }}>{tEx.length} expenses</Text>
                </View>
                <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.secTitle, { color: T.text, marginTop: 14, marginBottom: 10 }]}>Daily Spending</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 2, marginBottom: 16 }}>
                    {days.map((v, i) => (
                      <View key={i} style={{ flex: 1 }}>
                        <View style={{ height: Math.max(Math.round((v / maxDay) * 64), v > 0 ? 4 : 2), backgroundColor: v > 0 ? T.accent : 'rgba(103,80,164,0.15)', borderRadius: 3 }} />
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.secTitle, { color: T.text, marginBottom: 10 }]}>Category Breakdown</Text>
                  {catData.map(([name, amt], i) => {
                    const c = CM[name] ?? CM['Other'];
                    return (
                      <View key={name} style={{ marginBottom: 14 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                          <Text style={{ color: T.text, fontSize: 13 }}>{c.icon} {name}</Text>
                          <Text style={{ color: T.sub, fontSize: 12 }}>{fmt(amt)} · {Math.round((amt / tTot) * 100)}%</Text>
                        </View>
                        <AnimBar pct={Math.round((amt / tTot) * 100)} color={c.color} delay={i * 70} animLevel={animLevel} />
                      </View>
                    );
                  })}
                  <View style={{ height: 24 }} />
                </ScrollView>
              </>
            );
          }}
        </SlideScreen>
      )}
    </View>
  );
}

// ─── HISTORY SCREEN ───────────────────────────────────────────────────────────
function HistoryScreen({ expenses, onRow, T, animLevel }) {
  const [search, setSearch] = useState('');
  const [catF, setCatF] = useState('All');
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
        <TextInput value={search} onChangeText={setSearch} placeholder="Search…" placeholderTextColor={T.sub} style={[styles.searchInput, { color: T.text }]} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color: T.sub }}>✕</Text></TouchableOpacity> : null}
      </View>
      {uc.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          {uc.map(c => (
            <TouchableOpacity key={c} onPress={() => setCatF(c)} style={[styles.filterPill, { backgroundColor: catF === c ? T.grad1 : T.surface, marginRight: 7 }]}>
              <Text style={{ color: catF === c ? '#fff' : T.sub, fontSize: 11, fontWeight: catF === c ? '700' : '400' }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {expenses.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 44 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: T.text }]}>No history yet</Text>
        </View>
      ) : fil.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 36 }}>🔍</Text>
          <Text style={{ color: T.sub, marginTop: 8 }}>No expenses found</Text>
        </View>
      ) : dates.map(date => (
        <View key={date}>
          <View style={styles.dateHeader}>
            <Text style={[styles.dateLabel, { color: T.accent }]}>{dispDate(date).toUpperCase()}</Text>
            <Text style={{ color: T.sub, fontSize: 11 }}>{fmt(grp[date].reduce((a, e) => a + e.amount, 0))}</Text>
          </View>
          {grp[date].map((e, i) => <Row key={e.id} expense={e} onPress={onRow} T={T} delay={i * 50} animLevel={animLevel} />)}
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── MORE SCREEN ──────────────────────────────────────────────────────────────
function MoreScreen({ features, T, animLevel }) {
  const enabledFeats = FEATURES.filter(f => features[f.id]);
  const [showFeat, setShowFeat] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [selBbl, setSelBbl] = useState(-1);
  const BSIZE = Math.min(SW * 0.185, 78);
  const n = enabledFeats.length;
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3;
  const rows = n > 0 ? Math.ceil(n / cols) : 0;
  const FIELD_H = n > 0 ? (rows - 1) * BSIZE * 1.16 + BSIZE + 40 : 200;

  const handleBbl = i => {
    if (collapsed) { setCollapsed(false); return; }
    setSelBbl(i);
    setShowFeat(enabledFeats[i]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <View>
          <Text style={{ color: T.sub, fontSize: 12 }}>Your Features</Text>
          <Text style={[styles.screenTitle, { color: T.text, paddingHorizontal: 0, paddingTop: 0 }]}>More ✦</Text>
        </View>
        {enabledFeats.length > 0 && (
          <TouchableOpacity onPress={() => { setCollapsed(prev => !prev); setSelBbl(-1); }}
            style={{ backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.accent + '55', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12 }}>{collapsed ? '✨' : '🔵'}</Text>
            <Text style={{ color: T.accent, fontSize: 11, fontWeight: '700' }}>{collapsed ? 'Expand' : 'Collapse'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {enabledFeats.length === 0 ? (
        <View style={[styles.emptyBox, { flex: 1 }]}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>✦</Text>
          <Text style={[styles.emptyTitle, { color: T.text }]}>No features enabled</Text>
          <Text style={{ color: T.sub, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>Go to {'Settings → Features'}{'\n'}to enable Income, Investments and more</Text>
        </View>
      ) : (
        <BubbleField
          cats={enabledFeats} onSelect={handleBbl} selected={selBbl} T={T}
          animLevel={animLevel} fieldH={FIELD_H} bSize={BSIZE}
          collapsed={collapsed} onCollapseChange={setCollapsed}
        />
      )}

      {showFeat && (
        <SlideScreen onClose={() => { setShowFeat(null); setSelBbl(-1); }} zIndex={60} T={T} animLevel={animLevel}>
          {close => (
            <>
              <View style={[styles.detailHero, { backgroundColor: showFeat.color + '18' }]}>
                <TouchableOpacity onPress={close} style={styles.backBtn}><Text style={{ color: T.text, fontSize: 18 }}>←</Text></TouchableOpacity>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: showFeat.color + '28', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 30 }}>{showFeat.icon}</Text>
                </View>
                <Text style={[styles.detailTitle, { color: T.text }]}>{showFeat.name}</Text>
                <Text style={{ color: T.sub, fontSize: 12, textAlign: 'center', marginTop: 4 }}>{showFeat.desc}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <Text style={{ color: T.sub, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
                  {showFeat.name} is enabled!{'\n'}Full functionality coming in the next update.
                </Text>
                <TouchableOpacity onPress={close} style={{ backgroundColor: showFeat.color, borderRadius: 16, padding: 14, marginTop: 24, paddingHorizontal: 32 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Got it</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </SlideScreen>
      )}
    </View>
  );
}

// ─── DETAIL SCREEN ────────────────────────────────────────────────────────────
function DetailScreen({ expense, onClose, onDelete, onEdit, T, animLevel }) {
  const cat = CM[expense?.category] ?? CM['Other'];
  const details = [
    ['📝', 'Note',     expense?.note || '—'],
    ['📅', 'Date',     dispDate(expense?.date) + ' · ' + expense?.date],
    ['🏷️', 'Category', expense?.category],
    ['💳', 'Payment',  expense?.payment || '—'],
  ];
  return (
    <SlideScreen onClose={onClose} zIndex={50} T={T} animLevel={animLevel}>
      {close => (
        <>
          <View style={[styles.detailHero, { backgroundColor: cat.color + '18' }]}>
            <TouchableOpacity onPress={close} style={styles.backBtn}><Text style={{ color: T.text, fontSize: 18 }}>←</Text></TouchableOpacity>
            <Text style={{ fontSize: 44, textAlign: 'center', marginBottom: 12 }}>{cat.icon}</Text>
            <Text style={[styles.detailTitle, { color: T.text }]}>{expense?.title}</Text>
            <Text style={[styles.detailAmt, { color: cat.color }]}>−{fmt(expense?.amount ?? 0)}</Text>
            <Text style={{ color: T.sub, fontSize: 12, textAlign: 'center', marginTop: 4 }}>{dispDate(expense?.date)} · {expense?.category}</Text>
          </View>
          <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
            {details.map(([icon, label, val]) => (
              <View key={label} style={[styles.detailRow, { borderBottomColor: T.border }]}>
                <View style={[styles.detailRowIcon, { backgroundColor: T.surface }]}><Text style={{ fontSize: 16 }}>{icon}</Text></View>
                <View><Text style={{ color: T.sub, fontSize: 10, marginBottom: 2 }}>{label.toUpperCase()}</Text><Text style={{ color: T.text, fontSize: 14, fontWeight: '500' }}>{val}</Text></View>
              </View>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>
          <View style={styles.detailActions}>
            <TouchableOpacity onPress={() => Alert.alert('Delete', 'Delete this expense?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => { onDelete(expense.id); close(); } },
            ])} style={styles.deleteBtn}>
              <Text style={{ color: '#FF6B6B', fontSize: 14, fontWeight: '600' }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { close(); setTimeout(() => onEdit(expense), 420); }} style={[styles.editBtn, { backgroundColor: T.grad1 }]}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Edit</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SlideScreen>
  );
}

// ─── FORM SCREEN ──────────────────────────────────────────────────────────────
function FormScreen({ existing, onSave, onClose, T, animLevel }) {
  const [title,   setTitle  ] = useState(existing?.title    ?? '');
  const [amount,  setAmount ] = useState(existing?.amount   ? String(existing.amount) : '');
  const [cat,     setCat    ] = useState(existing?.category ?? 'Food');
  const [date,    setDate   ] = useState(existing?.date     ?? todayStr());
  const [note,    setNote   ] = useState(existing?.note     ?? '');
  const [payment, setPayment] = useState(existing?.payment  ?? 'UPI');
  const [saved,   setSaved  ] = useState(false);
  const [err,     setErr    ] = useState('');
  const PAYMENTS = ['UPI', 'Cash', 'Credit Card', 'Debit Card', 'Net Banking', 'UPI · GPay', 'UPI · PhonePe', 'Other'];

  const handleSave = close => {
    if (!title.trim())                { setErr('Please enter a title'); return; }
    if (!amount || Number(amount) <= 0) { setErr('Enter a valid amount'); return; }
    setSaved(true);
    setTimeout(() => {
      onSave({ id: existing?.id, title: title.trim(), amount: Number(amount), category: cat, date, note: note.trim(), payment });
      close();
    }, 700);
  };

  return (
    <SlideScreen onClose={onClose} zIndex={60} T={T} animLevel={animLevel}>
      {close => (
        <>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={close} style={styles.closeBtn}><Text style={{ color: T.text, fontSize: 16 }}>✕</Text></TouchableOpacity>
            <Text style={[styles.formTitle, { color: T.text }]}>{existing ? 'Edit Expense' : 'Add Expense'}</Text>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={[styles.amountBox, { backgroundColor: T.surface }]}>
                <Text style={{ color: T.sub, fontSize: 10, letterSpacing: 0.8, marginBottom: 6 }}>AMOUNT (₹)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: T.accent, fontSize: 26, fontWeight: '300' }}>₹</Text>
                  <TextInput value={amount} onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))}
                    placeholder="0" placeholderTextColor={T.sub} keyboardType="decimal-pad"
                    style={[styles.amountInput, { color: T.text }]} />
                </View>
                <View style={{ height: 2, backgroundColor: T.accent, marginTop: 8, opacity: 0.5 }} />
              </View>
              <View style={[styles.formField, { backgroundColor: T.surface }]}>
                <Text style={[styles.fieldLabel, { color: T.sub }]}>TITLE</Text>
                <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Grocery Shopping"
                  placeholderTextColor={T.sub} style={[styles.fieldInput, { color: T.text }]} />
              </View>
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>CATEGORY</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CATS.map(c => (
                    <TouchableOpacity key={c.name} onPress={() => setCat(c.name)}
                      style={[styles.catPill, { backgroundColor: cat === c.name ? c.color + '28' : T.surface, borderColor: cat === c.name ? c.color : 'transparent' }]}>
                      <Text style={{ fontSize: 13 }}>{c.icon}</Text>
                      <Text style={{ color: cat === c.name ? c.color : T.sub, fontSize: 11, fontWeight: cat === c.name ? '700' : '400' }}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={[styles.formField, { backgroundColor: T.surface }]}>
                <Text style={[styles.fieldLabel, { color: T.sub }]}>DATE (YYYY-MM-DD)</Text>
                <TextInput value={date} onChangeText={setDate} placeholder="e.g. 2026-06-05"
                  placeholderTextColor={T.sub} style={[styles.fieldInput, { color: T.text }]} />
              </View>
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>PAYMENT</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {PAYMENTS.map(p => (
                    <TouchableOpacity key={p} onPress={() => setPayment(p)}
                      style={[styles.filterPill, { backgroundColor: payment === p ? T.grad1 : T.surface, marginRight: 7 }]}>
                      <Text style={{ color: payment === p ? '#fff' : T.sub, fontSize: 11, fontWeight: payment === p ? '700' : '400' }}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={[styles.formField, { backgroundColor: T.surface }]}>
                <Text style={[styles.fieldLabel, { color: T.sub }]}>NOTE (optional)</Text>
                <TextInput value={note} onChangeText={setNote} placeholder="Add a note…"
                  placeholderTextColor={T.sub} style={[styles.fieldInput, { color: T.text }]} />
              </View>
              {err ? <Text style={styles.errText}>{err}</Text> : null}
              <View style={{ height: 20 }} />
            </ScrollView>
          </KeyboardAvoidingView>
          <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <TouchableOpacity onPress={() => handleSave(close)}
              style={[styles.saveBtn, { backgroundColor: saved ? '#4CAF50' : T.grad1 }]}>
              <Text style={styles.saveBtnText}>{saved ? '✓ Saved!' : existing ? 'Save Changes' : 'Add Expense'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SlideScreen>
  );
}

// ─── SETTINGS SCREEN ──────────────────────────────────────────────────────────
function SettingsScreen({ state, dispatch, T, animLevel }) {
  const [bi, setBi] = useState(String(state.budget));
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [bioAvail, setBioAvail] = useState(false);
  const [catBudgetInputs, setCatBudgetInputs] = useState({});
  const [catBudgetsOpen, setCatBudgetsOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(true);
  const catBudgetAnim = useRef(new Animated.Value(0)).current;
  const featuresAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(has =>
      LocalAuthentication.isEnrolledAsync().then(en => setBioAvail(has && en))
    );
    const init = {};
    CATS.forEach(c => { init[c.name] = state.catBudgets?.[c.name] ? String(state.catBudgets[c.name]) : ''; });
    setCatBudgetInputs(init);
  }, []);

  const toggleCatBudgets = () => {
    const open = !catBudgetsOpen;
    setCatBudgetsOpen(open);
    if (animLevel !== 'none') {
      Animated.timing(catBudgetAnim, { toValue: open ? 1 : 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    } else {
      catBudgetAnim.setValue(open ? 1 : 0);
    }
  };

  const toggleFeatures = () => {
    const open = !featuresOpen;
    setFeaturesOpen(open);
    if (animLevel !== 'none') {
      Animated.timing(featuresAnim, { toValue: open ? 1 : 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    } else {
      featuresAnim.setValue(open ? 1 : 0);
    }
  };

  const catH = catBudgetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, CATS.length * 58] });
  const featH = featuresAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FEATURES.length * 60] });

  const saveBudget = () => {
    const v = Number(bi); if (!v || v < 0) return;
    dispatch({ type: 'SET_BUDGET', v });
    setBudgetSaved(true); setTimeout(() => setBudgetSaved(false), 1500);
  };
  const setPin = () => {
    if (pinInput.length < 4) { Alert.alert('PIN too short', 'Please enter at least 4 digits'); return; }
    dispatch({ type: 'SET_PIN', v: pinInput }); setPinInput('');
    Alert.alert('PIN set!', 'Your PIN has been saved.');
  };
  const removePin = () => Alert.alert('Remove PIN', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => dispatch({ type: 'SET_PIN', v: null }) },
  ]);
  const clearAll = () => Alert.alert('Clear All Data', 'Delete all expenses and reset everything?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: async () => { await AsyncStorage.removeItem(STORAGE_KEY); dispatch({ type: 'LOAD', state: INIT }); } },
  ]);
  const exportAll = async () => {
    const header = 'Title,Category,Amount,Date,Payment,Note';
    const rows = state.expenses.map(e => `"${e.title}","${e.category}",${e.amount},"${e.date}","${e.payment || ''}","${e.note || ''}"`);
    try { await Share.share({ message: [header, ...rows].join('\n'), title: 'All Expenses.csv' }); } catch (e) {}
  };

  const total = state.expenses.reduce((a, e) => a + e.amount, 0);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <Text style={[styles.screenTitle, { color: T.text }]}>Settings</Text>

      {/* Profile */}
      <View style={[styles.profileCard, { backgroundColor: T.grad1 }]}>
        <View style={styles.profileAvatar}><Text style={{ fontSize: 24 }}>🌙</Text></View>
        <View>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Celestial</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{state.expenses.length} expenses · {fmt(total)}</Text>
        </View>
      </View>

      {/* Appearance */}
      <View style={styles.settingSection}>
        <Text style={[styles.settingHeader, { color: T.accent }]}>APPEARANCE</Text>
        <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
          <Text style={{ color: T.sub, fontSize: 10, marginBottom: 10 }}>THEME</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {[['default', '🌑 Default'], ['amoled', '⬛ AMOLED']].map(([key, label]) => (
              <TouchableOpacity key={key} onPress={() => dispatch({ type: 'SET_THEME', v: key })}
                style={[styles.themeBtn, { backgroundColor: state.theme === key ? T.grad1 : T.surface2 }]}>
                <Text style={{ color: state.theme === key ? '#fff' : T.sub, fontSize: 12, fontWeight: state.theme === key ? '700' : '400' }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: T.sub, fontSize: 10, marginBottom: 8 }}>ANIMATION LEVEL</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[['full', '🚀 Full'], ['reduced', '⚡ Reduced'], ['none', '🚫 None']].map(([key, label]) => (
              <TouchableOpacity key={key} onPress={() => dispatch({ type: 'SET_ANIM', v: key })}
                style={[styles.themeBtn, { backgroundColor: state.animLevel === key ? T.grad1 : T.surface2 }]}>
                <Text style={{ color: state.animLevel === key ? '#fff' : T.sub, fontSize: 11, fontWeight: state.animLevel === key ? '700' : '400' }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Monthly Budget */}
      <View style={styles.settingSection}>
        <Text style={[styles.settingHeader, { color: T.accent }]}>MONTHLY BUDGET</Text>
        <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={[styles.budgetInput, { backgroundColor: T.surface2 }]}>
              <Text style={{ color: T.accent, fontSize: 18 }}>₹</Text>
              <TextInput value={bi} onChangeText={t => setBi(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad"
                style={[styles.budgetInputText, { color: T.text }]} />
            </View>
            <TouchableOpacity onPress={saveBudget} style={[styles.saveBudgetBtn, { backgroundColor: budgetSaved ? '#4CAF50' : T.grad1 }]}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{budgetSaved ? '✓' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Category Budgets — collapsible */}
      <View style={styles.settingSection}>
        <TouchableOpacity onPress={toggleCatBudgets} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
          <Text style={[styles.settingHeader, { color: T.accent, marginBottom: 0 }]}>CATEGORY BUDGETS</Text>
          <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.accent + '55', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: T.accent, fontSize: 10, fontWeight: '700' }}>{catBudgetsOpen ? '▼ Collapse' : '▶ Expand'}</Text>
          </View>
        </TouchableOpacity>
        <Animated.View style={{ overflow: 'hidden', maxHeight: catBudgetsOpen ? catH : 0 }}>
          <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
            <Text style={{ color: T.sub, fontSize: 11, marginBottom: 12 }}>Set monthly spend limits per category</Text>
            {CATS.map((c, i) => (
              <View key={c.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottomWidth: i < CATS.length - 1 ? 1 : 0, borderBottomColor: T.border }}>
                <Text style={{ fontSize: 18 }}>{c.icon}</Text>
                <Text style={{ color: T.text, fontSize: 13, flex: 1 }}>{c.name}</Text>
                <View style={[styles.budgetInput, { backgroundColor: T.surface2, flex: 0, width: 110 }]}>
                  <Text style={{ color: T.accent, fontSize: 14 }}>₹</Text>
                  <TextInput
                    value={catBudgetInputs[c.name] ?? ''}
                    onChangeText={t => setCatBudgetInputs(prev => ({ ...prev, [c.name]: t.replace(/[^0-9]/g, '') }))}
                    onBlur={() => { const v = Number(catBudgetInputs[c.name]); if (v > 0) dispatch({ type: 'SET_CAT_BUDGET', cat: c.name, v }); }}
                    keyboardType="number-pad" placeholder="No limit" placeholderTextColor={T.sub}
                    style={[styles.budgetInputText, { color: T.text, fontSize: 13, flex: 1 }]}
                  />
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>

      {/* Features — collapsible */}
      <View style={styles.settingSection}>
        <TouchableOpacity onPress={toggleFeatures} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
          <Text style={[styles.settingHeader, { color: T.accent, marginBottom: 0 }]}>FEATURES</Text>
          <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.accent + '55', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 3 }}>
            <Text style={{ color: T.accent, fontSize: 10, fontWeight: '700' }}>{featuresOpen ? '▼ Collapse' : '▶ Expand'}</Text>
          </View>
        </TouchableOpacity>
        <Animated.View style={{ overflow: 'hidden', maxHeight: featuresOpen ? featH : 0 }}>
          <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
            <Text style={{ color: T.sub, fontSize: 11, marginBottom: 12 }}>Enabled features appear in the More tab</Text>
            {FEATURES.map((f, i) => (
              <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i < FEATURES.length - 1 ? 1 : 0, borderBottomColor: T.border }}>
                <Text style={{ fontSize: 20 }}>{f.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.text, fontSize: 13, fontWeight: '500' }}>{f.name}</Text>
                  <Text style={{ color: T.sub, fontSize: 10, marginTop: 1 }}>{f.desc}</Text>
                </View>
                <TouchableOpacity onPress={() => dispatch({ type: 'SET_FEATURE', id: f.id, v: !state.features[f.id] })}
                  style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: state.features[f.id] ? T.grad1 : T.surface2, justifyContent: 'center', paddingHorizontal: 2 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: state.features[f.id] ? 'flex-end' : 'flex-start' }} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>

      {/* Security */}
      <View style={styles.settingSection}>
        <Text style={[styles.settingHeader, { color: T.accent }]}>SECURITY</Text>
        <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: T.border, paddingBottom: 14, marginBottom: 14 }}>
            <Text style={{ color: T.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
              {state.pin ? '🔒 PIN is set' : '🔓 Set a PIN lock'}
            </Text>
            <TextInput value={pinInput} onChangeText={t => setPinInput(t.replace(/[^0-9]/g, ''))}
              placeholder="Enter new PIN (min 4 digits)" placeholderTextColor={T.sub}
              keyboardType="number-pad" secureTextEntry maxLength={8}
              style={[styles.fieldInput, { color: T.text, backgroundColor: T.surface2, borderRadius: 10, padding: 10 }]} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity onPress={setPin} style={[styles.saveBudgetBtn, { backgroundColor: T.grad1, flex: 1, alignItems: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Set PIN</Text>
              </TouchableOpacity>
              {state.pin && (
                <TouchableOpacity onPress={removePin} style={[styles.saveBudgetBtn, { backgroundColor: 'rgba(244,67,54,0.2)', flex: 1, alignItems: 'center' }]}>
                  <Text style={{ color: '#FF6B6B', fontSize: 13, fontWeight: '700' }}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {bioAvail ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.text, fontSize: 13 }}>Fingerprint / Face</Text>
                <Text style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>Use biometrics to unlock</Text>
              </View>
              <TouchableOpacity onPress={() => dispatch({ type: 'SET_BIO', v: !state.biometric })}
                style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: state.biometric ? T.grad1 : T.surface2, justifyContent: 'center', paddingHorizontal: 2 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: state.biometric ? 'flex-end' : 'flex-start' }} />
              </TouchableOpacity>
            </View>
          ) : <Text style={{ color: T.sub, fontSize: 12 }}>No biometric hardware found</Text>}
        </View>
      </View>

      {/* Data */}
      <View style={styles.settingSection}>
        <Text style={[styles.settingHeader, { color: T.accent }]}>DATA</Text>
        <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
          <TouchableOpacity onPress={exportAll} style={[styles.settingRow, { borderBottomColor: T.border }]}>
            <Text style={{ fontSize: 16 }}>📤</Text>
            <View style={{ flex: 1 }}><Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>Export CSV</Text><Text style={{ color: T.sub, fontSize: 10 }}>Share all expenses</Text></View>
            <Text style={{ color: T.accent, fontSize: 13 }}>→</Text>
          </TouchableOpacity>
          <View style={[styles.settingRow, { borderBottomColor: T.border }]}>
            <Text style={{ fontSize: 16 }}>💾</Text>
            <View style={{ flex: 1 }}><Text style={{ color: T.text, fontSize: 13 }}>Auto-Save</Text><Text style={{ color: T.sub, fontSize: 10 }}>Data saved on your device</Text></View>
            <View style={styles.onBadge}><Text style={{ color: '#4CAF50', fontSize: 10, fontWeight: '700' }}>ON</Text></View>
          </View>
          <TouchableOpacity onPress={clearAll} style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <Text style={{ fontSize: 16 }}>🗑️</Text>
            <View style={{ flex: 1 }}><Text style={{ color: '#FF6B6B', fontSize: 13, fontWeight: '600' }}>Clear All Data</Text><Text style={{ color: T.sub, fontSize: 10 }}>Resets everything to zero</Text></View>
            <Text style={{ color: 'rgba(255,107,107,0.5)', fontSize: 13 }}>→</Text>
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
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
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
      <Text style={{ color: T.sub, fontSize: 13, marginBottom: 32 }}>Enter your PIN to continue</Text>
      <Animated.View style={{ flexDirection: 'row', gap: 16, marginBottom: 24, transform: [{ translateX: shakeAnim }] }}>
        {dots.map((filled, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: filled ? T.accent : T.surface2, borderWidth: 1.5, borderColor: T.border }} />
        ))}
      </Animated.View>
      {error      && <Text style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 12 }}>Incorrect PIN</Text>}
      {cooldown > 0 && <Text style={{ color: '#FF9800', fontSize: 13, marginBottom: 12 }}>Too many attempts. Wait {cooldown}s</Text>}
      <View style={{ width: 240 }}>
        {[[1,2,3],[4,5,6],[7,8,9],['bio',0,'del']].map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            {row.map(k => {
              if (k === 'bio') return <TouchableOpacity key={k} onPress={biometric ? tryBio : undefined} style={[styles.numKey, { backgroundColor: biometric ? T.surface : 'transparent' }]}><Text style={{ fontSize: 22 }}>{biometric ? '👆' : ''}</Text></TouchableOpacity>;
              if (k === 'del') return <TouchableOpacity key={k} onPress={() => setInput(i => i.slice(0, -1))} style={[styles.numKey, { backgroundColor: T.surface }]}><Text style={{ color: T.text, fontSize: 20 }}>⌫</Text></TouchableOpacity>;
              return <TouchableOpacity key={k} onPress={() => press(String(k))} style={[styles.numKey, { backgroundColor: T.surface }]}><Text style={{ color: T.text, fontSize: 22, fontWeight: '600' }}>{k}</Text></TouchableOpacity>;
            })}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav({ tab, onChange, T, animLevel }) {
  const fabScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (animLevel === 'none') return;
    Animated.loop(Animated.sequence([
      Animated.timing(fabScale, { toValue: 1.06, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(fabScale, { toValue: 1,    duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, [animLevel]);
  return (
    <View style={[styles.nav, { backgroundColor: T.nav, borderTopColor: T.border }]}>
      {[['🏠','home'],['📊','stats'],['➕','add'],['✦','more'],['⚙️','settings']].map(([icon,t]) =>
        t === 'add' ? (
          <TouchableOpacity key={t} onPress={() => onChange('add')}>
            <Animated.View style={[styles.fab, { backgroundColor: T.grad1, transform: [{ scale: animLevel !== 'none' ? fabScale : 1 }] }]}>
              <Text style={{ fontSize: 24, color: '#fff' }}>➕</Text>
            </Animated.View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity key={t} onPress={() => onChange(t)}
            style={[styles.navItem, { backgroundColor: tab === t ? 'rgba(103,80,164,0.18)' : 'transparent' }]}>
            <Text style={{ fontSize: t === 'more' ? 16 : 20, opacity: tab === t ? 1 : 0.38, filter: undefined }}>{icon}</Text>
            <Text style={{ fontSize: 9, color: tab === t ? T.accent : T.sub, fontWeight: tab === t ? '700' : '400', textTransform: 'capitalize' }}>{t}</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [state,      dispatch    ] = useReducer(reducer, INIT);
  const [tab,        setTab      ] = useState('home');
  const [loaded,     setLoaded   ] = useState(false);
  const [locked,     setLocked   ] = useState(false);
  const [detailEx,   setDetailEx ] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [formEx,     setFormEx   ] = useState(null);
  const [showForm,   setShowForm ] = useState(false);
  const [homeCollapsed, setHomeCollapsed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(s => {
      if (s) {
        try {
          const p = JSON.parse(s);
          dispatch({ type: 'LOAD', state: { ...INIT, ...p } });
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

  const T   = THEMES[state.theme] || THEMES.default;
  const aL  = state.animLevel || 'full';

  const handleNav    = t  => { if (t === 'add') { setFormEx(null); setShowForm(true); return; } setTab(t); };
  const handleRow    = e  => { setDetailEx(e); setShowDetail(true); };
  const handleEdit   = e  => { setFormEx(e); setShowForm(true); };
  const handleDelete = id => { dispatch({ type: 'DELETE', id }); setShowDetail(false); };
  const handleSave   = p  => { if (p.id) dispatch({ type: 'EDIT', payload: p }); else dispatch({ type: 'ADD', payload: p }); };

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
      {tab === 'home'     && <HomeScreen     state={state} dispatch={dispatch} onRow={handleRow} onQuickAdd={() => { setFormEx(null); setShowForm(true); }} T={T} animLevel={aL} collapsed={homeCollapsed} setCollapsed={setHomeCollapsed} />}
      {tab === 'stats'    && <StatsScreen    expenses={state.expenses} T={T} animLevel={aL} />}
      {tab === 'history'  && <HistoryScreen  expenses={state.expenses} onRow={handleRow} T={T} animLevel={aL} />}
      {tab === 'more'     && <MoreScreen     features={state.features} T={T} animLevel={aL} />}
      {tab === 'settings' && <SettingsScreen state={state} dispatch={dispatch} T={T} animLevel={aL} />}
      <BottomNav tab={tab} onChange={handleNav} T={T} animLevel={aL} />
      {showDetail && detailEx && <DetailScreen expense={detailEx} onClose={() => setShowDetail(false)} onDelete={handleDelete} onEdit={handleEdit} T={T} animLevel={aL} />}
      {showForm && <FormScreen existing={formEx} onSave={handleSave} onClose={() => setShowForm(false)} T={T} animLevel={aL} />}
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
  cardAmt:        { color: '#fff', fontSize: 34, fontWeight: '700', letterSpacing: -1, marginBottom: 2 },
  cardRow:        { flexDirection: 'row', gap: 12, marginTop: 14 },
  cardPill:       { backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 11, padding: 10 },
  cardPillLbl:    { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
  cardPillVal:    { color: '#fff', fontSize: 13, fontWeight: '600' },
  budgetBg:       { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 99, height: 4, marginTop: 12 },
  budgetFill:     { borderRadius: 99, height: 4 },
  cardPct:        { color: 'rgba(255,255,255,0.55)', fontSize: 9, marginTop: 4 },
  alertCard:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  insightCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  section:        { marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 14 },
  secHeader:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  secTitle:       { fontSize: 13, fontWeight: '600' },
  emptyBox:       { alignItems: 'center', padding: 48 },
  emptyTitle:     { fontSize: 16, fontWeight: '600', marginTop: 12 },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 15, marginHorizontal: 16, marginBottom: 7 },
  rowIcon:        { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle:       { fontSize: 13, fontWeight: '600' },
  rowSub:         { fontSize: 11, marginTop: 2 },
  rowAmt:         { color: '#FF8A80', fontSize: 13, fontWeight: '700' },
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
  detailAmt:      { fontSize: 32, fontWeight: '800', textAlign: 'center', marginTop: 6, letterSpacing: -1 },
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
});
