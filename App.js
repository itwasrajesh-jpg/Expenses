import React, {
  useState, useEffect, useReducer, useRef, useCallback
} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Dimensions, Animated, StatusBar, Platform,
  Alert, KeyboardAvoidingView, BackHandler, PanResponder,
  Easing, Share, Modal
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

// ─── FEATURE SUB-TYPES ───────────────────────────────────────────────────────
const FEAT_SUB = {
  income:      ['Salary','Freelance','Business','Rental','Interest','Dividends','Gift','Other'],
  investments: ['Stocks','Mutual Fund','Fixed Deposit','Gold','Crypto','PPF','NPS','Other'],
  goals:       ['Travel','Emergency Fund','Education','Home','Gadget','Wedding','Retirement','Other'],
  emi:         ['Home Loan','Car Loan','Personal Loan','Education Loan','Credit Card','Other'],
  accounts:    ['Cash','Savings Account','UPI','Credit Card','Wallet','Other'],
  split:       ['Dinner','Trip','Groceries','Rent','Utilities','Party','Other'],
  tax:         ['80C Investment','HRA','Medical Insurance','Education Loan','Home Loan','80D','Other'],
};

const FEAT_COLORS = {
  income:'#2ECC8A', investments:'#2196F3', goals:'#E91E63',
  emi:'#FF9800', accounts:'#9C27B0', split:'#00BCD4', tax:'#8BC34A',
};

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
  featEntries: {},
  bills: [],
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
    case 'ADD_FEAT':       return { ...state, featEntries: { ...state.featEntries, [action.fid]: [...(state.featEntries[action.fid]||[]), action.entry] } };
    case 'EDIT_FEAT':      return { ...state, featEntries: { ...state.featEntries, [action.fid]: (state.featEntries[action.fid]||[]).map(e => e.id===action.entry.id ? action.entry : e) } };
    case 'DELETE_FEAT':    return { ...state, featEntries: { ...state.featEntries, [action.fid]: (state.featEntries[action.fid]||[]).filter(e => e.id!==action.id) } };
    case 'ADD_BILL':       return { ...state, bills: [...(state.bills||[]), action.bill] };
    case 'SETTLE_BILL':    return { ...state, bills: (state.bills||[]).map(b => b.id===action.billId ? { ...b, people: b.people.map(p => p.name===action.person ? { ...p, settled:true } : p), fullySettled: b.people.filter(p=>p.name!==b.payer).every(p=>p.name===action.person?true:p.settled) } : b) };
    case 'CONTRIBUTE':     return { ...state, featEntries: { ...state.featEntries, [action.fid]: (state.featEntries[action.fid]||[]).map(e => e.id===action.id ? { ...e, contributions:[...(e.contributions||[]),action.contribution] } : e) } };
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

  // Fly in from random off-screen positions on mount
  // If already collapsed (returning to tab), respect that state immediately
  useEffect(() => {
    if (animLevel === 'none') {
      if (collapsed) {
        bs.forEach(b => { b.x = CX; b.y = CY; b.sc = 0.10; b.op = 0; });
      } else {
        bs.forEach((b, i) => { b.x = b.homeX; b.y = b.homeY; b.sc = 1; b.op = 1; });
      }
      return;
    }
    if (collapsed) {
      // Already collapsed — snap to center silently, fully hidden (hub renders instead)
      bs.forEach(b => { b.x = CX; b.y = CY; b.tx = CX; b.ty = CY; b.sc = 0.10; b.tsc = 0.10; b.op = 0; b.top = 0; });
      return;
    }
    // Fly in from random off-screen positions
    bs.forEach((b, i) => {
      const angle = Math.random() * Math.PI * 2;
      const launch = Math.max(SW, SH) * 0.85;
      b.x = CX + Math.cos(angle) * launch;
      b.y = CY + Math.sin(angle) * launch;
      b.sc = 0.1; b.op = 0; b.fb = 0;
    });
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
      const margin = bSize * 0.5;
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          const dx = bs[j].x - bs[i].x;
          const dy = bs[j].y - bs[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (dist < minDist) {
            const overlap = (minDist - dist) / minDist;
            const force = overlap * 0.45;
            const nx = dx / dist, ny = dy / dist;
            bs[i].x -= nx * force * bSize * 0.5;
            bs[i].y -= ny * force * bSize * 0.5;
            bs[j].x += nx * force * bSize * 0.5;
            bs[j].y += ny * force * bSize * 0.5;
          }
        }
      }
      // Clamp all bubbles within visible field bounds
      bs.forEach(b => {
        b.x = Math.max(margin, Math.min(b.x, SW - margin));
        b.y = Math.max(margin, Math.min(b.y, fieldH - margin));
      });
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
      setTimeout(() => { bs[i].tx = CX; bs[i].ty = CY; bs[i].tsc = 0.10; bs[i].top = 0; }, rank * 55);
    });
  }, []);
  const expandAll = useCallback((fromCollapsed = true) => {
    if (fromCollapsed) {
      // Only reset positions when expanding from collapsed state
      bs.forEach(b => { b.x = CX; b.y = CY; b.sc = 0.12; b.op = 0.5; b.fb = 0; });
    }
    const withDist = HOME.map((p, i) => ({ i, d: Math.hypot(p.x - CX, p.y - CY) })).sort((a, b) => b.d - a.d);
    withDist.forEach(({ i }, rank) => {
      setTimeout(() => { bs[i].tx = HOME[i].x; bs[i].ty = HOME[i].y; bs[i].tsc = 1; bs[i].top = 1; }, rank * 36);
    });
  }, []);

  // Only run collapse/expand on actual changes, not on initial mount
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    if (collapsed) collapseAll(); else expandAll(true);
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
function HomeScreen({ state, dispatch, onRow, onEdit, onQuickAdd, T, animLevel, collapsed, setCollapsed }) {
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

        <View style={{ position: 'relative', height: FIELD_H }}>
          <BubbleField
            cats={CATS} onSelect={handleBbl} selected={selBbl} T={T}
            animLevel={animLevel} fieldH={FIELD_H} bSize={BSIZE}
            collapsed={collapsed} onCollapseChange={setCollapsed}
          />
          {/* Hub shown when collapsed */}
          {collapsed && (
            <TouchableOpacity
              onPress={() => setCollapsed(false)}
              style={{
                position: 'absolute',
                left: SW / 2 - 38, top: FIELD_H / 2 - 38,
                width: 76, height: 76, borderRadius: 38,
                backgroundColor: T.grad1,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: T.grad1, shadowOpacity: 0.6, shadowRadius: 16, elevation: 10,
                zIndex: 30,
              }}>
              <Text style={{ fontSize: 28 }}>💸</Text>
            </TouchableOpacity>
          )}
        </View>

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
                    : catEx.slice(0, 15).map((e, idx) => (
                      <View key={e.id} style={{ marginHorizontal: 16, marginBottom: 7 }}>
                        <View style={[styles.row, { backgroundColor: T.surface2, marginHorizontal: 0, marginBottom: 0 }]}>
                          <View style={[styles.rowIcon, { backgroundColor: cat.color + '28' }]}>
                            <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.rowTitle, { color: T.text }]}>{e.title}</Text>
                            <Text style={[styles.rowSub, { color: T.sub }]}>{dispDate(e.date)}</Text>
                          </View>
                          <Text style={styles.rowAmt}>−{fmt(e.amount)}</Text>
                          <TouchableOpacity
                            onPress={() => { close(); setTimeout(() => { setSelBbl(-1); setSheetCat(null); onEdit(e); }, 460); }}
                            style={{ marginLeft: 8, backgroundColor: T.grad1 + '33', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <Text style={{ color: T.accent, fontSize: 11, fontWeight: '700' }}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
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


// ─── PIE CHART ────────────────────────────────────────────────────────────────
function PieChart({ data, total, size, T, onSelect, selected }) {
  const key = data.map(d => d.name).join(',');
  const animMap = useRef({}).current;
  data.forEach(d => { if (!animMap[d.name]) animMap[d.name] = new Animated.Value(0); });
  const flyAnims = data.map(d => animMap[d.name]);

  useEffect(() => {
    flyAnims.forEach(a => a.setValue(0));
    Animated.stagger(65, flyAnims.map((a, i) =>
      Animated.spring(a, { toValue: 1, tension: 55, friction: 10, delay: i * 65, useNativeDriver: true })
    )).start();
  }, [key]);

  const R = size / 2;
  const innerR = R * 0.50;
  const THICK = R - innerR - 2;
  const CR = innerR + THICK / 2;

  let cumAngle = -Math.PI / 2;
  const segments = data.map((c) => {
    const frac = c.amt / total;
    const sweep = frac * 2 * Math.PI;
    const mid = cumAngle + sweep / 2;
    const sa = cumAngle;
    cumAngle += sweep;
    return { ...c, frac, pct: Math.round(frac * 100), sweep, mid, sa };
  });

  return (
    <View style={{ width: size, height: size }}>
      {segments.map((seg, i) => {
        const slices = Math.max(Math.ceil((seg.sweep * 180 / Math.PI) / 4), 1);
        const sliceA = seg.sweep / slices;
        const isSelected = selected === i;
        const isDimmed = selected !== -1 && !isSelected;
        return (
          <TouchableOpacity
            key={seg.name}
            onPress={() => onSelect?.(i)}
            activeOpacity={1}
            style={{ position: 'absolute', width: size, height: size }}>
            <Animated.View style={{
              position: 'absolute', width: size, height: size,
              transform: [
                { translateX: flyAnims[i].interpolate({ inputRange: [0,1], outputRange: [Math.cos(seg.mid)*220, 0] }) },
                { translateY: flyAnims[i].interpolate({ inputRange: [0,1], outputRange: [Math.sin(seg.mid)*220, 0] }) },
                { scale: flyAnims[i].interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.1, isSelected?1.1:1.05, isSelected?1.06:1] }) },
              ],
              opacity: flyAnims[i].interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, isDimmed?0.35:1] }),
            }}>
              {Array.from({ length: slices }, (_, s) => {
                const angle = seg.sa + s * sliceA + sliceA / 2;
                const x = R + Math.cos(angle) * CR - (THICK + 1) / 2;
                const y = R + Math.sin(angle) * CR - (THICK + 1) / 2;
                return (
                  <View key={s} style={{
                    position: 'absolute',
                    width: THICK + 1, height: THICK + 1,
                    borderRadius: (THICK + 1) / 2,
                    backgroundColor: seg.color,
                    left: x, top: y,
                  }} />
                );
              })}
            </Animated.View>
          </TouchableOpacity>
        );
      })}
      {/* Center hole — always on top */}
      <View style={{
        position: 'absolute',
        left: R - innerR, top: R - innerR,
        width: innerR * 2, height: innerR * 2,
        borderRadius: innerR,
        backgroundColor: T?.surface ?? '#2B2930',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 20,
      }} pointerEvents="none">
        <Text style={{ fontSize: 16 }}>
          {selected >= 0 && segments[selected] ? segments[selected].icon : '💸'}
        </Text>
        <Text style={{ fontSize: 9, fontWeight: '700', marginTop: 1,
          color: selected >= 0 && segments[selected] ? segments[selected].color : (T?.accent ?? '#B985FA') }}>
          {selected >= 0 && segments[selected] ? segments[selected].pct + '%' : 'total'}
        </Text>
      </View>
    </View>
  );
}

// ─── PIE EXPANDED OVERLAY ─────────────────────────────────────────────────────
function PieExpanded({ data, total, T, onClose }) {
  const SIZE = Math.min(SW * 0.82, 320);
  const R = SIZE / 2, innerR = R * 0.36, THICK = R - innerR - 4, CR = innerR + THICK / 2;

  // Overlay anims — native driver OK (opacity/scale only)
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.2)).current;
  const opAnim    = useRef(new Animated.Value(0)).current;

  // Per-segment anims — opacity + scale only, native driver safe
  const segAnims = useRef(data.map(() => new Animated.Value(0))).current;

  const [selIdx,   setSelIdx]   = useState(-1);
  const [countVal, setCountVal] = useState(0);

  let cumAngle = -Math.PI / 2;
  const segments = data.map(c => {
    const frac = c.amt / total, sweep = frac * 2 * Math.PI, mid = cumAngle + sweep / 2, sa = cumAngle;
    cumAngle += sweep;
    return { ...c, frac, pct: Math.round(frac * 100), sweep, mid, sa };
  });

  useEffect(() => {
    // Reset
    segAnims.forEach(a => a.setValue(0));
    // Entrance: bg + scale + opacity
    Animated.parallel([
      Animated.timing(bgAnim,    { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
      Animated.timing(opAnim,    { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start(() => {
      // Segments pop in with stagger after overlay appears
      Animated.stagger(60, segAnims.map(a =>
        Animated.spring(a, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true })
      )).start();
    });
    // Count up total
    const end = total, t0 = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - t0) / 900, 1), e = 1 - Math.pow(1 - p, 3);
      setCountVal(Math.round(end * e));
      if (p < 1) requestAnimationFrame(tick);
    };
    setTimeout(() => requestAnimationFrame(tick), 320);
  }, []);

  const close = () => {
    Animated.parallel([
      Animated.timing(bgAnim,  { toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opAnim,  { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 0.2, tension: 80, friction: 12, useNativeDriver: true }),
    ]).start(onClose);
  };

  const panY = useRef(new Animated.Value(0)).current;
  const pan  = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove:    (_, g) => { if (g.dy > 0) panY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > SH * 0.18 || g.vy > 0.6) close();
      else Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => sub.remove();
  }, []);

  return (
    <Modal transparent visible animationType="none">
      {/* Frosted dark background */}
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,6,18,0.9)', opacity: bgAnim }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={close} activeOpacity={1} />
      </Animated.View>

      {/* Main content */}
      <Animated.View {...pan.panHandlers}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
          opacity: opAnim, transform: [{ scale: scaleAnim }, { translateY: panY }] }}>

        {/* Pie */}
        <View style={{ width: SIZE, height: SIZE }}>
          {segments.map((seg, i) => {
            const slices = Math.max(Math.ceil((seg.sweep * 180 / Math.PI) / 3), 1);
            const sliceA = seg.sweep / slices;
            const isSel  = selIdx === i;
            const isDim  = selIdx !== -1 && !isSel;
            // Scale + opacity only — safe for native driver
            const segScale = segAnims[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.12, isSel ? 1.08 : 1] });
            const segOp    = segAnims[i].interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, isDim ? 0.32 : 1] });
            return (
              <TouchableOpacity key={seg.name} onPress={() => setSelIdx(selIdx === i ? -1 : i)}
                activeOpacity={1} style={{ position: 'absolute', width: SIZE, height: SIZE }}>
                <Animated.View style={{ position: 'absolute', width: SIZE, height: SIZE,
                  transform: [{ scale: segScale }], opacity: segOp }}>
                  {Array.from({ length: slices }, (_, s) => {
                    const angle = seg.sa + s * sliceA + sliceA / 2;
                    const x = R + Math.cos(angle) * CR - (THICK + 1) / 2;
                    const y = R + Math.sin(angle) * CR - (THICK + 1) / 2;
                    return <View key={s} style={{ position: 'absolute', width: THICK + 1, height: THICK + 1,
                      borderRadius: (THICK + 1) / 2, backgroundColor: seg.color,
                      left: x, top: y, elevation: isSel ? 6 : 2 }} />;
                  })}
                </Animated.View>
              </TouchableOpacity>
            );
          })}

          {/* Label pills around the outside */}
          {segments.map((seg, i) => {
            const lr = R * 1.35, lx = R + Math.cos(seg.mid) * lr, ly = R + Math.sin(seg.mid) * lr;
            const isDim = selIdx !== -1 && selIdx !== i;
            return (
              <Animated.View key={seg.name + 'l'} pointerEvents="none"
                style={{ position: 'absolute', left: lx - 26, top: ly - 11,
                  opacity: segAnims[i].interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, isDim ? 0.2 : 1] }) }}>
                <View style={{ backgroundColor: 'rgba(20,16,32,0.95)', borderRadius: 99,
                  paddingHorizontal: 6, paddingVertical: 3,
                  borderWidth: 1, borderColor: seg.color + '66', alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: seg.color }}>{seg.icon} {seg.pct}%</Text>
                </View>
              </Animated.View>
            );
          })}

          {/* Center hole */}
          <View pointerEvents="none" style={{ position: 'absolute', left: R - innerR, top: R - innerR,
            width: innerR * 2, height: innerR * 2, borderRadius: innerR,
            backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center', zIndex: 30,
            elevation: 8 }}>
            {selIdx >= 0 && segments[selIdx] ? (
              <>
                <Text style={{ fontSize: 22 }}>{segments[selIdx].icon}</Text>
                <Text style={{ color: segments[selIdx].color, fontSize: 12, fontWeight: '800', marginTop: 2 }}>{fmt(segments[selIdx].amt)}</Text>
                <Text style={{ color: T.sub, fontSize: 9, marginTop: 1 }}>{segments[selIdx].pct}%</Text>
              </>
            ) : (
              <>
                <Text style={{ color: T.accent, fontSize: 14, fontWeight: '800' }}>{'₹' + countVal.toLocaleString('en-IN')}</Text>
                <Text style={{ color: T.sub, fontSize: 9, marginTop: 2 }}>total</Text>
              </>
            )}
          </View>
        </View>

        {/* Selected category detail card */}
        {selIdx >= 0 && segments[selIdx] && (
          <View style={{ position: 'absolute', bottom: 100, left: 28, right: 28,
            backgroundColor: T.surface, borderRadius: 20, padding: 16,
            borderWidth: 1.5, borderColor: segments[selIdx].color + '66', elevation: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: segments[selIdx].color + '28', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 26 }}>{segments[selIdx].icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.text, fontSize: 17, fontWeight: '800' }}>{segments[selIdx].name}</Text>
                <Text style={{ color: segments[selIdx].color, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{fmt(segments[selIdx].amt)}</Text>
              </View>
              <Text style={{ color: segments[selIdx].color, fontSize: 28, fontWeight: '900' }}>{segments[selIdx].pct}%</Text>
            </View>
          </View>
        )}

        {/* Drag hint */}
        <View style={{ position: 'absolute', bottom: 48, alignItems: 'center' }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 8 }} />
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Swipe down or tap outside to close</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}



// ─── DATE RANGE PICKER ────────────────────────────────────────────────────────
function DateRangePicker({ startDate, endDate, onApply, onClose, T }) {
  const [mode,  setMode]  = useState('start');
  const [start, setStart] = useState(startDate || curMonth() + '-01');
  const [end,   setEnd]   = useState(endDate   || todayStr());
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const close = cb => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(cb);
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const years  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 4 + i);

  const DateWheel = ({ value, onChange }) => {
    const dv = new Date(value + 'T00:00:00');
    const [yr, setYr] = useState(dv.getFullYear());
    const [mo, setMo] = useState(dv.getMonth());
    const [dy, setDy] = useState(dv.getDate());
    const update = (y, m, d) => onChange(`${y}-${String(m + 1).padStart(2, '0')}-${String(Math.min(d, new Date(y, m + 1, 0).getDate())).padStart(2, '0')}`);
    const W2 = ({ items, sel, onSel, width }) => (
      <ScrollView style={{ height: 160, width }} showsVerticalScrollIndicator={false} snapToInterval={40} decelerationRate="fast">
        <View style={{ paddingVertical: 60 }}>
          {items.map(item => {
            const v = typeof item === 'object' ? item.value : item;
            const l = typeof item === 'object' ? item.label : String(item);
            const isS = v === sel;
            return (
              <TouchableOpacity key={v} onPress={() => onSel(v)} style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: isS ? T.accent : T.sub, fontSize: isS ? 17 : 13, fontWeight: isS ? '700' : '400' }}>{l}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
    return (
      <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: T.sub, fontSize: 9, marginBottom: 4 }}>DAY</Text>
          <W2 items={Array.from({ length: new Date(yr, mo + 1, 0).getDate() }, (_, i) => i + 1)} sel={dy} onSel={v => { setDy(v); update(yr, mo, v); }} width={55} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: T.sub, fontSize: 9, marginBottom: 4 }}>MONTH</Text>
          <W2 items={MONTHS.map((m, i) => ({ label: m, value: i }))} sel={mo} onSel={v => { setMo(v); update(yr, v, dy); }} width={70} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: T.sub, fontSize: 9, marginBottom: 4 }}>YEAR</Text>
          <W2 items={years} sel={yr} onSel={v => { setYr(v); update(v, mo, dy); }} width={68} />
        </View>
      </View>
    );
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => close(onClose)}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end', opacity: fadeAnim }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => close(onClose)} activeOpacity={1} />
        <Animated.View style={{ backgroundColor: T.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, transform: [{ translateY: slideAnim }] }}>
          <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 14, textAlign: 'center' }}>Custom Date Range</Text>
          <View style={{ flexDirection: 'row', backgroundColor: T.surface2, borderRadius: 12, padding: 3, marginBottom: 14 }}>
            {[['start', 'From'], ['end', 'To']].map(([m, l]) => (
              <TouchableOpacity key={m} onPress={() => setMode(m)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: mode === m ? T.grad1 : 'transparent', alignItems: 'center' }}>
                <Text style={{ color: mode === m ? '#fff' : T.sub, fontSize: 11, fontWeight: mode === m ? '700' : '400' }}>
                  {l}: {m === 'start' ? dispDate(start) : dispDate(end)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {mode === 'start' ? <DateWheel value={start} onChange={setStart} /> : <DateWheel value={end} onChange={setEnd} />}
          <View pointerEvents="none" style={{ position: 'absolute', top: 153, left: 20, right: 20, height: 40, backgroundColor: T.accent + '18', borderRadius: 10, borderWidth: 1, borderColor: T.accent + '33' }} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity onPress={() => close(onClose)} style={{ flex: 1, backgroundColor: T.surface2, borderRadius: 14, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: T.sub, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => close(() => onApply(start, end))} style={{ flex: 2, backgroundColor: T.grad1, borderRadius: 14, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Apply Range</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}


// ─── FEATURE ENTRY EDIT MODAL ────────────────────────────────────────────────
function FeatEditModal({ entry, fid, dispatch, onClose, T, originY }) {
  const color    = FEAT_COLORS[fid] || '#B985FA';
  const subTypes = FEAT_SUB[fid] || ['Other'];
  const startY    = (originY != null ? originY : SH * 0.45) - SH / 2;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opAnim    = useRef(new Animated.Value(0)).current;
  const slideY    = useRef(new Animated.Value(startY)).current;
  const [amount,  setAmount]  = useState(String(entry.amount));
  const [title,   setTitle]   = useState(entry.title);
  const [subType, setSubType] = useState(entry.subType);
  const [note,    setNote]    = useState(entry.note || '');

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(slideY,    { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.timing(opAnim,    { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  }, []);

  const close = (cb) => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0,     tension: 90, friction: 9, useNativeDriver: true }),
      Animated.spring(slideY,    { toValue: startY, tension: 90, friction: 9, useNativeDriver: true }),
      Animated.timing(opAnim,    { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { onClose(); if (cb) cb(); });
  };

  const handleSave = () => {
    const amt = Number(amount);
    if (!title.trim() || !amt || amt <= 0) return;
    dispatch({ type: 'EDIT_FEAT', fid, entry: { ...entry, amount: amt, title: title.trim(), subType, note: note.trim() } });
    close();
  };

  const handleDelete = () => {
    dispatch({ type: 'DELETE_FEAT', fid, id: entry.id });
    close();
  };

  return (
    <Modal transparent visible animationType="none">
      <Animated.View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.65)', opacity:opAnim }}>
        <TouchableOpacity style={{ position:'absolute', top:0, left:0, right:0, bottom:0 }} onPress={() => close()} activeOpacity={1} />
        <Animated.View style={{
          width: '100%', maxWidth: 360, borderRadius: 24, padding: 22,
          backgroundColor: color + '18',
          borderWidth: 1.5, borderColor: color + '55',
          transform: [{ scale: scaleAnim }, { translateY: slideY }],
          overflow: 'hidden',
        }}>
          <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor: '#1C1B1F', opacity: 0.88, borderRadius: 24 }} />
          <View style={{ position:'relative' }}>
            <TouchableOpacity onPress={() => close()} style={{ position:'absolute', top:-6, right:-6, width:32, height:32, borderRadius:16, backgroundColor:'rgba(255,255,255,0.1)', alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color:'#fff', fontSize:14 }}>✕</Text>
            </TouchableOpacity>
            <Text style={{ color: color, fontSize: 17, fontWeight: '800', marginBottom: 3 }}>{entry.subType}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 18 }}>{dispDate(entry.date)}</Text>

            {/* Amount */}
            <View style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:14, padding:14, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, marginBottom:12 }}>
              <Text style={{ color:color, fontSize:22, fontWeight:'300' }}>₹</Text>
              <TextInput value={amount} onChangeText={t => setAmount(t.replace(/[^0-9.]/g,''))}
                keyboardType="decimal-pad" placeholderTextColor="rgba(255,255,255,0.25)"
                style={{ color:'#fff', fontSize:32, fontWeight:'800', letterSpacing:-1, minWidth:100, textAlign:'center' }} />
            </View>
            {/* Title */}
            <TextInput value={title} onChangeText={setTitle}
              placeholderTextColor="rgba(255,255,255,0.3)" placeholder="Title"
              style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:12, padding:12, color:'#fff', fontSize:14, marginBottom:10 }} />
            {/* Sub-type pills */}
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:10 }}>
              {subTypes.map(s => (
                <TouchableOpacity key={s} onPress={() => setSubType(s)}
                  style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:99,
                    backgroundColor: subType===s ? color+'33' : 'rgba(255,255,255,0.07)',
                    borderWidth:1.5, borderColor: subType===s ? color : 'rgba(255,255,255,0.12)' }}>
                  <Text style={{ color: subType===s ? color : 'rgba(255,255,255,0.55)', fontSize:11, fontWeight: subType===s?'700':'400' }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Note */}
            <TextInput value={note} onChangeText={setNote}
              placeholderTextColor="rgba(255,255,255,0.3)" placeholder="Note (optional)"
              style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:12, padding:12, color:'#fff', fontSize:13, marginBottom:18 }} />
            {/* Actions */}
            <View style={{ flexDirection:'row', gap:10 }}>
              <TouchableOpacity onPress={handleDelete}
                style={{ flex:1, padding:13, borderRadius:14, backgroundColor:'rgba(255,107,107,0.15)', borderWidth:1, borderColor:'rgba(255,107,107,0.3)', alignItems:'center' }}>
                <Text style={{ color:'#FF6B6B', fontSize:13, fontWeight:'700' }}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave}
                style={{ flex:2, padding:13, borderRadius:14, backgroundColor:color, alignItems:'center' }}>
                <Text style={{ color:'#fff', fontSize:13, fontWeight:'700' }}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── STATS PIE CHART (canvas-based via SVG shapes in RN) ─────────────────────
function StatsPie({ data, total, T, onDoubleTap }) {
  const SIZE     = Math.min(SW * 0.38, 140);
  const R        = SIZE / 2;
  const innerR   = R * 0.38;
  const [selIdx, setSelIdx] = useState(-1);
  const lastTap  = useRef({ t: 0, i: -1 });
  const scaleAnims = useRef(data.map(() => new Animated.Value(0))).current;
  const key = data.map(d=>d.name).join(',');

  useEffect(() => {
    scaleAnims.forEach(a => a.setValue(0));
    Animated.stagger(55, scaleAnims.map(a =>
      Animated.spring(a, { toValue:1, tension:65, friction:9, useNativeDriver:true })
    )).start();
    setSelIdx(-1);
  }, [key]);

  let cumAngle = -Math.PI / 2;
  const segs = data.map((d, i) => {
    const sweep = (d.amt / total) * 2 * Math.PI;
    const mid   = cumAngle + sweep / 2;
    const sa    = cumAngle;
    cumAngle   += sweep;
    return { ...d, sweep, mid, sa, i };
  });

  const handlePress = (i) => {
    const now = Date.now();
    if (i === lastTap.current.i && now - lastTap.current.t < 400) {
      lastTap.current = { t: 0, i: -1 };
      if (onDoubleTap) onDoubleTap(segs[i]);
      return;
    }
    lastTap.current = { t: now, i };
    setSelIdx(prev => prev === i ? -1 : i);
  };

  return (
    <View style={{ width: SIZE, height: SIZE, position: 'relative' }}>
      {segs.map((seg, i) => {
        const isSel = selIdx === i;
        const isDim = selIdx !== -1 && !isSel;
        const slices = Math.max(Math.ceil((seg.sweep * 180 / Math.PI) / 4), 1);
        const sliceA = seg.sweep / slices;
        const THICK  = R - innerR - 3;
        const CR     = innerR + THICK / 2;
        const sc     = scaleAnims[i].interpolate({ inputRange:[0,0.5,1], outputRange:[0, isSel?1.1:1.06, isSel?1.06:1] });
        const op     = scaleAnims[i].interpolate({ inputRange:[0,0.4,1], outputRange:[0,1, isDim?0.3:1] });
        return (
          <TouchableOpacity key={seg.name} onPress={() => handlePress(i)}
            activeOpacity={1} style={{ position:'absolute', width:SIZE, height:SIZE }}>
            <Animated.View style={{ position:'absolute', width:SIZE, height:SIZE, transform:[{scale:sc}], opacity:op }}>
              {Array.from({ length:slices }, (_, s) => {
                const angle = seg.sa + s * sliceA + sliceA / 2;
                const x = R + Math.cos(angle) * CR - (THICK+1)/2;
                const y = R + Math.sin(angle) * CR - (THICK+1)/2;
                return <View key={s} style={{ position:'absolute', width:THICK+1, height:THICK+1, borderRadius:(THICK+1)/2, backgroundColor:seg.color, left:x, top:y, elevation:isSel?4:1 }} />;
              })}
            </Animated.View>
          </TouchableOpacity>
        );
      })}
      {/* Center hole */}
      <View pointerEvents="none" style={{ position:'absolute', left:R-innerR, top:R-innerR, width:innerR*2, height:innerR*2, borderRadius:innerR, backgroundColor:T.surface, alignItems:'center', justifyContent:'center', zIndex:10, elevation:6 }}>
        {selIdx >= 0 ? (
          <>
            <Text style={{ fontSize:16 }}>{segs[selIdx]?.icon||''}</Text>
            <Text style={{ color:segs[selIdx]?.color, fontSize:10, fontWeight:'800', marginTop:1 }}>{segs[selIdx]?.pct}%</Text>
          </>
        ) : (
          <Text style={{ color:T.accent, fontSize:9, fontWeight:'700', textAlign:'center', paddingHorizontal:4 }}>
            {fmt(total).replace('₹','')}
          </Text>
        )}
      </View>
    </View>
  );
}


// ─── GOAL CARD (for Goals + EMI in StatsScreen) ───────────────────────────────
function GoalCard({ feat, entry, dispatch, T }) {
  const color = FEAT_COLORS[feat.id] || feat.color;
  const saved = (entry.contributions||[]).reduce((a,c) => a+c.amount, 0);
  const pct   = Math.min(Math.round(saved / entry.targetAmount * 100), 100);
  const achieved = saved >= entry.targetAmount;
  const rem   = Math.max(entry.targetAmount - saved, 0);
  const [showList, setShowList] = useState(false);
  const [showContrib, setShowContrib] = useState(false);

  return (
    <View style={{ backgroundColor: T.surface, borderRadius: 18, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: color }}>
      {achieved && (
        <View style={{ backgroundColor: '#2ECC8A', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Text style={{ fontSize: 18 }}>{feat.id === 'emi' ? '🏦' : '🎯'}</Text>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{feat.id === 'emi' ? 'Loan fully paid off!' : 'Goal achieved!'}</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: color+'22', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>{feat.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{entry.title}</Text>
          <Text style={{ color: T.sub, fontSize: 11, marginTop: 1 }}>{entry.subType}</Text>
        </View>
        <Text style={{ color: achieved ? '#2ECC8A' : color, fontSize: 22, fontWeight: '800' }}>{pct}%</Text>
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 10, overflow: 'hidden', marginBottom: 8 }}>
        <View style={{ height: 10, borderRadius: 99, width: pct+'%', backgroundColor: achieved ? '#2ECC8A' : color }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: achieved ? 8 : 12 }}>
        <Text style={{ fontWeight: '700', color: color }}>{fmt(saved)} {feat.id === 'emi' ? 'paid' : 'saved'}</Text>
        <Text style={{ color: T.sub }}>{feat.id === 'emi' ? 'of' : 'goal'} {fmt(entry.targetAmount)}</Text>
      </View>
      {!achieved && <Text style={{ color: T.sub, fontSize: 11, marginBottom: 10 }}>{fmt(rem)} {feat.id === 'emi' ? 'left to clear' : 'to go'}</Text>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity onPress={() => setShowContrib(true)}
          style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: color, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{feat.id === 'emi' ? '💸 Make Payment' : '💰 Add Money'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowList(p => !p)}
          style={{ padding: 12, borderRadius: 12, backgroundColor: T.surface2, alignItems: 'center', paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 16 }}>📋</Text>
        </TouchableOpacity>
      </View>
      {showList && (
        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8 }}>
          {(entry.contributions||[]).length === 0
            ? <Text style={{ color: T.sub, fontSize: 12, textAlign: 'center' }}>No entries yet</Text>
            : (entry.contributions||[]).slice().reverse().map(cn => (
              <View key={cn.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: T.border }}>
                <Text style={{ color: T.sub, fontSize: 12 }}>{dispDate(cn.date)}{cn.note ? ' · '+cn.note : ''}</Text>
                <Text style={{ fontWeight: '700', color: color }}>+{fmt(cn.amount)}</Text>
              </View>
            ))
          }
        </View>
      )}
      {showContrib && (
        <GoalContributeSheet entry={entry} feat={feat} dispatch={dispatch} T={T} onClose={() => setShowContrib(false)} />
      )}
    </View>
  );
}

// ─── GOAL CONTRIBUTE SHEET ────────────────────────────────────────────────────
function GoalContributeSheet({ entry, feat, dispatch, T, onClose }) {
  const color = FEAT_COLORS[feat.id] || feat.color;
  const saved = (entry.contributions||[]).reduce((a,c) => a+c.amount, 0);
  const rem   = Math.max(entry.targetAmount - saved, 0);
  const [amount, setAmount] = useState('');
  const [note,   setNote]   = useState('');
  const [saved2, setSaved2] = useState(false);

  const handleSave = (close) => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    setSaved2(true);
    const contribution = { id: Date.now(), amount: amt, date: todayStr(), note: note.trim() };
    setTimeout(() => {
      dispatch({ type: 'CONTRIBUTE', fid: feat.id, id: entry.id, contribution });
      close();
      const after = saved + amt;
      if (saved < entry.targetAmount && after >= entry.targetAmount) {
        // Achievement handled by parent re-render
      }
    }, 600);
  };

  return (
    <SlideScreen onClose={onClose} zIndex={70} T={T} animLevel="full">
      {close => (
        <>
          <View style={[styles.detailHero, { backgroundColor: color + '20' }]}>
            <TouchableOpacity onPress={close} style={styles.backBtn}>
              <Text style={{ color: T.text, fontSize: 18 }}>←</Text>
            </TouchableOpacity>
            <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: color+'28', alignItems:'center', justifyContent:'center', marginBottom: 8, borderWidth: 2, borderColor: color+'55' }}>
              <Text style={{ fontSize: 26 }}>{feat.icon}</Text>
            </View>
            <Text style={[styles.detailTitle, { color: T.text }]}>{feat.id === 'emi' ? 'Make Payment' : 'Add Contribution'}</Text>
            <Text style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>{entry.title}</Text>
            <View style={{ marginTop: 10, backgroundColor: color+'18', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8 }}>
              <Text style={{ color: T.sub, fontSize: 10, textAlign: 'center' }}>REMAINING</Text>
              <Text style={{ color: color, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{fmt(rem)}</Text>
            </View>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={[styles.amountBox, { backgroundColor: T.surface }]}>
                <Text style={{ color: color, fontSize: 26, fontWeight: '300' }}>₹</Text>
                <TextInput value={amount} onChangeText={t => setAmount(t.replace(/[^0-9.]/g,''))}
                  placeholder="0" placeholderTextColor={T.sub} keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: T.text }]} />
              </View>
              <View style={[styles.formField, { backgroundColor: T.surface }]}>
                <Text style={[styles.fieldLabel, { color: T.sub }]}>NOTE (optional)</Text>
                <TextInput value={note} onChangeText={setNote}
                  placeholder={feat.id === 'emi' ? 'e.g. June EMI' : 'e.g. Monthly saving'}
                  placeholderTextColor={T.sub} style={[styles.fieldInput, { color: T.text }]} />
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
          </KeyboardAvoidingView>
          <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <TouchableOpacity onPress={() => handleSave(close)}
              style={[styles.saveBtn, { backgroundColor: saved2 ? '#4CAF50' : color }]}>
              <Text style={styles.saveBtnText}>{saved2 ? '✓ Saved!' : feat.id === 'emi' ? 'Add Payment' : 'Add Contribution'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SlideScreen>
  );
}

// ─── STATS SCREEN ─────────────────────────────────────────────────────────────
function StatsScreen({ expenses, featEntries, bills, dispatch, T, animLevel, selCat, setSelCat }) {
  const allM = [...new Set(expenses.map(e => monthOf(e.date)))].sort().reverse();
  const [selM,        setSelM]        = useState(curMonth());
  const [view,        setView]        = useState('Monthly');
  const [trendOpen,   setTrendOpen]   = useState(false);
  const [trendMonth,  setTrendMonth]  = useState(null);
  const [pieExpanded, setPieExpanded] = useState(false);
  const [showDateRange, setShowDateRange] = useState(false);
  const [rangeStart,  setRangeStart]  = useState(null);
  const [rangeEnd,    setRangeEnd]    = useState(null);
  const [editEntry,   setEditEntry]   = useState(null);

  const CAT_OPTIONS = [
    { key:'expenses',    label:'Expenses',    color:'#FF6B6B', icon:'📉' },
    { key:'income',      label:'Income',      color:'#2ECC8A', icon:'💰' },
    { key:'investments', label:'Investments', color:'#2196F3', icon:'💹' },
    { key:'goals',       label:'Goals',       color:'#E91E63', icon:'🎯' },
    { key:'emi',         label:'EMI',         color:'#FF9800', icon:'🏦' },
    { key:'accounts',    label:'Accounts',    color:'#9C27B0', icon:'💳' },
    { key:'split',       label:'Bill Splits', color:'#00BCD4', icon:'🧾' },
    { key:'tax',         label:'Tax',         color:'#8BC34A', icon:'📊' },
  ];
  const activeCat = CAT_OPTIONS.find(c => c.key === selCat) || CAT_OPTIONS[0];

  // Build data for selected category
  const buildData = () => {
    if (selCat === 'expenses') {
      const filtered = expenses.filter(e => rangeStart && rangeEnd
        ? e.date >= rangeStart && e.date <= rangeEnd
        : monthOf(e.date) === selM);
      const tot = filtered.reduce((a,e) => a+e.amount, 0) || 1;
      const bd  = CATS.map(cat => {
        const amt = filtered.filter(e => e.category===cat.name).reduce((a,e) => a+e.amount, 0);
        return { name:cat.name, icon:cat.icon, color:cat.color, amt, pct:Math.round((amt/tot)*100) };
      }).filter(c => c.amt > 0).sort((a,b) => b.amt-a.amt);
      return { breakdown: bd, total: filtered.reduce((a,e)=>a+e.amount,0) };
    }
    if (selCat === 'split') {
      const bFiltered = (bills||[]).filter(b => rangeStart && rangeEnd
        ? b.date >= rangeStart && b.date <= rangeEnd
        : monthOf(b.date) === selM);
      const bTot = bFiltered.reduce((a,b) => a+b.amount, 0) || 1;
      const BCOLORS = ['#B985FA','#2ECC8A','#FF9800','#2196F3','#E91E63','#00BCD4','#FF6B6B','#8BC34A'];
      const byCat = {};
      bFiltered.forEach(b => { byCat[b.category||'Other'] = (byCat[b.category||'Other']||0) + b.amount; });
      const bbd = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([name,amt],i)=>({
        name, amt, pct:Math.round((amt/bTot)*100), color:BCOLORS[i%BCOLORS.length], icon:'🧾',
      }));
      return { breakdown: bbd, total: bFiltered.reduce((a,b)=>a+b.amount,0) };
    }
    const entries = (featEntries[selCat] || []).filter(e => rangeStart && rangeEnd
      ? e.date >= rangeStart && e.date <= rangeEnd
      : monthOf(e.date) === selM);
    const tot = entries.reduce((a,e) => a+e.amount, 0) || 1;
    const byType = {};
    entries.forEach(e => { byType[e.subType] = (byType[e.subType]||0) + e.amount; });
    const COLORS = ['#B985FA','#2ECC8A','#FF9800','#2196F3','#E91E63','#00BCD4','#FF6B6B','#8BC34A'];
    const bd = Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([name,amt],i)=>({
      name, amt, pct:Math.round((amt/tot)*100),
      color: COLORS[i % COLORS.length], icon: '',
    }));
    return { breakdown: bd, total: entries.reduce((a,e)=>a+e.amount,0) };
  };

  const buildTrend = () => {
    const getVal = m => {
      if (selCat === 'expenses') return expenses.filter(e=>monthOf(e.date)===m).reduce((a,e)=>a+e.amount,0);
      if (selCat === 'split')    return (bills||[]).filter(b=>monthOf(b.date)===m).reduce((a,b)=>a+b.amount,0);
      return (featEntries[selCat]||[]).filter(e=>monthOf(e.date)===m).reduce((a,e)=>a+e.amount,0);
    };
    if (view === 'Monthly') return Array.from({length:6},(_,i)=>{
      const d=new Date(); d.setMonth(d.getMonth()-5+i);
      const m=d.toISOString().slice(0,7);
      return { label:new Date(m+'-01').toLocaleString('en-IN',{month:'short'}), value:getVal(m), key:m };
    });
    if (view === 'Quarterly') return [1,2,3,4].map(q=>({
      label:`Q${q}`,
      value:[1,2,3].reduce((a,i)=>{ const m=`2026-${String((q-1)*3+i).padStart(2,'0')}`; return a+getVal(m); },0),
      key:null,
    }));
    if (view === 'Yearly') return Array.from({length:3},(_,i)=>{
      const yr=new Date().getFullYear()-2+i;
      const months=Array.from({length:12},(_,m)=>`${yr}-${String(m+1).padStart(2,'0')}`);
      return { label:String(yr), value:months.reduce((a,m)=>a+getVal(m),0), key:null };
    });
    return [];
  };

  const { breakdown: catD, total: catTotal } = buildData();
  const trend = buildTrend();
  const tmx   = Math.max(...trend.map(t=>t.value), 1);

  const exportCSV = async () => {
    const header = 'Title,Category,Amount,Date,Payment,Note';
    const rows = expenses.map(e => `"${e.title}","${e.category}",${e.amount},"${e.date}","${e.payment||''}","${e.note||''}"`);
    try { await Share.share({ message:[header,...rows].join('\n'), title:'Expenses.csv' }); } catch(e) {}
  };

  return (
    <View style={{ flex:1 }}>
      <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingTop:16, paddingBottom:8 }}>
          <Text style={[styles.screenTitle, { color:T.text, paddingHorizontal:0, paddingTop:0 }]}>Analytics</Text>
          <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
            <TouchableOpacity onPress={() => setShowDateRange(true)} style={[styles.filterPill, { backgroundColor: rangeStart ? T.grad1 : T.surface }]}>
              <Text style={{ color: rangeStart?'#fff':T.accent, fontSize:11 }}>📅</Text>
            </TouchableOpacity>
            {rangeStart && (
              <TouchableOpacity onPress={() => { setRangeStart(null); setRangeEnd(null); }} style={[styles.filterPill, { backgroundColor:T.surface }]}>
                <Text style={{ color:T.sub, fontSize:12 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category horizontal pill strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }} contentContainerStyle={{ paddingHorizontal:12, gap:8 }}>
          {CAT_OPTIONS.map(opt => {
            const active = selCat === opt.key;
            return (
              <TouchableOpacity key={opt.key} onPress={() => setSelCat(opt.key)}
                style={{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:14, paddingVertical:8, borderRadius:99,
                  backgroundColor: active ? opt.color+'22' : T.surface,
                  borderWidth:1.5, borderColor: active ? opt.color : 'transparent' }}>
                <Text style={{ fontSize:13 }}>{opt.icon}</Text>
                <Text style={{ color: active ? opt.color : T.sub, fontSize:12, fontWeight: active?'700':'500' }}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* View toggle */}
        <View style={{ flexDirection:'row', marginHorizontal:16, marginBottom:14, backgroundColor:T.surface, borderRadius:14, padding:4 }}>
          {['Monthly','Quarterly','Yearly'].map(v => (
            <TouchableOpacity key={v} onPress={() => setView(v)}
              style={{ flex:1, paddingVertical:7, borderRadius:11, backgroundColor:view===v?T.grad1:'transparent', alignItems:'center' }}>
              <Text style={{ color:view===v?'#fff':T.sub, fontSize:10, fontWeight:view===v?'700':'400' }}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Trend bars */}
        <View style={[styles.section, { backgroundColor:T.surface }]}>
          <Text style={[styles.secTitle, { color:T.text, marginBottom:4 }]}>{view} Trend — {activeCat.label}</Text>
          <Text style={{ color:T.sub, fontSize:11, marginBottom:14 }}>Tap any bar to view that month</Text>
          <View style={{ flexDirection:'row', alignItems:'flex-end', height:90, gap:6 }}>
            {trend.map((t,i) => {
              const h = Math.max(Math.round((t.value/tmx)*80), t.value>0?5:2);
              const isCur = t.key===selM || (t.key===null && i===trend.length-1);
              return (
                <TouchableOpacity key={i} onPress={() => { if(t.key){ setSelM(t.key); if(view==='Monthly'){setTrendMonth(t.key);} }}}
                  style={{ flex:1, alignItems:'center', gap:4 }}>
                  <Text style={{ color:T.sub, fontSize:8 }}>{t.value>0 ? (t.value>=1000?Math.round(t.value/1000)+'k':t.value) : ''}</Text>
                  <View style={{ height:h, width:'100%', backgroundColor:isCur?activeCat.color:activeCat.color+'66', borderRadius:6 }} />
                  <Text style={{ color:isCur?activeCat.color:T.sub, fontSize:9, fontWeight:isCur?'700':'400' }}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Month pills */}
        {!rangeStart && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal:16, marginBottom:12 }}>
            {(selCat==='expenses' ? allM : selCat==='split' ? [...new Set((bills||[]).map(b=>monthOf(b.date)))].sort().reverse() : [...new Set((featEntries[selCat]||[]).map(e=>monthOf(e.date)))].sort().reverse()).slice(0,6).map(m => (
              <TouchableOpacity key={m} onPress={() => setSelM(m)}
                style={[styles.monthPill, { backgroundColor: selM===m ? activeCat.color : T.surface }]}>
                <Text style={{ color:selM===m?'#fff':T.sub, fontSize:12, fontWeight:selM===m?'700':'400' }}>
                  {new Date(m+'-01').toLocaleString('en-IN',{month:'short',year:'2-digit'})}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Pie + breakdown */}
        <View style={[styles.section, { backgroundColor:T.surface }]}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <Text style={[styles.secTitle, { color:T.text }]}>
              {rangeStart ? dispDate(rangeStart)+' – '+dispDate(rangeEnd) : new Date(selM+'-01').toLocaleString('en-IN',{month:'long',year:'numeric'})}
            </Text>
            <TouchableOpacity onPress={() => { setTrendMonth(selM); setTrendOpen(true); }}>
              <Text style={{ color:T.accent, fontSize:11 }}>Details →</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color:activeCat.color, fontSize:24, fontWeight:'800', marginBottom:2 }}>{fmt(catTotal)}</Text>
          <Text style={{ color:T.sub, fontSize:11, marginBottom:14 }}>
            {catD.length} {selCat==='expenses'?'categories':'types'}
            {selCat!=='expenses' && '  ·  Double-tap pie to edit entry'}
          </Text>

          {(selCat==='goals'||selCat==='emi') ? (
            // Goals / EMI — show target cards
            <View style={{ marginTop: 4 }}>
              {(featEntries[selCat]||[]).map(entry => (
                <GoalCard key={entry.id} feat={FEATURES.find(f=>f.id===selCat)||{id:selCat,icon:'🎯',color:FEAT_COLORS[selCat]||'#B985FA'}} entry={entry} dispatch={dispatch} T={T} />
              ))}
              {(featEntries[selCat]||[]).length === 0 && <Text style={{ color:T.sub, fontSize:13, textAlign:'center', paddingVertical:16 }}>No {selCat==='emi'?'loans':'goals'} yet. Tap a bubble in More tab to create one.</Text>}
            </View>
          ) : selCat==='split' ? (
            // Bill Split — show bills with per-person settle
            <View style={{ marginTop: 4 }}>
              {(bills||[]).filter(b=>monthOf(b.date)===selM).length === 0
                ? <Text style={{ color:T.sub, fontSize:13, textAlign:'center', paddingVertical:16 }}>No bills this month. Tap a bubble in More tab to split a bill.</Text>
                : (bills||[]).filter(b=>monthOf(b.date)===selM).map(bill => (
                  <View key={bill.id} style={{ backgroundColor:T.surface2, borderRadius:14, padding:14, marginBottom:10, borderLeftWidth:3, borderLeftColor:'#00BCD4' }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }}>
                      <Text style={{ fontSize:22 }}>{(bill.category||'🧾').split(' ')[0]}</Text>
                      <View style={{ flex:1 }}><Text style={{ color:T.text, fontSize:14, fontWeight:'700' }}>{bill.title}</Text><Text style={{ color:T.sub, fontSize:11 }}>{dispDate(bill.date)} · Paid by {bill.payer} · {fmt(bill.amount)}</Text></View>
                    </View>
                    {bill.people.filter(p=>p.name!==bill.payer).map(p => (
                      <View key={p.name} style={{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8, borderTopWidth:1, borderTopColor:T.border }}>
                        <View style={{ width:30, height:30, borderRadius:15, backgroundColor:'#6750A4', alignItems:'center', justifyContent:'center' }}><Text style={{ color:'#fff', fontSize:11, fontWeight:'700' }}>{p.name.slice(0,2).toUpperCase()}</Text></View>
                        <View style={{ flex:1 }}><Text style={{ color:T.text, fontSize:13, fontWeight:'600' }}>{p.name}</Text><Text style={{ color:T.sub, fontSize:11 }}>{p.settled ? '✅ Settled' : 'Owes '+bill.payer}</Text></View>
                        <Text style={{ color:'#00BCD4', fontSize:13, fontWeight:'700', marginRight:8 }}>{fmt(p.share)}</Text>
                        {p.settled
                          ? <View style={{ paddingHorizontal:10, paddingVertical:4, borderRadius:99, backgroundColor:'rgba(46,204,138,0.15)' }}><Text style={{ color:'#2ECC8A', fontSize:11, fontWeight:'700' }}>Settled</Text></View>
                          : <TouchableOpacity onPress={() => dispatch({ type:'SETTLE_BILL', billId:bill.id, person:p.name })} style={{ paddingHorizontal:10, paddingVertical:5, borderRadius:99, borderWidth:1.5, borderColor:'#2ECC8A' }}><Text style={{ color:'#2ECC8A', fontSize:11, fontWeight:'700' }}>Settle</Text></TouchableOpacity>
                        }
                      </View>
                    ))}
                  </View>
                ))
              }
            </View>
          ) : catD.length > 0 ? (
            <View style={{ flexDirection:'row', gap:16, alignItems:'center', marginBottom:16 }}>
              <TouchableOpacity onPress={() => setPieExpanded(true)} activeOpacity={0.85}>
                <StatsPie
                  data={catD} total={catTotal} T={T}
                  onDoubleTap={selCat!=='expenses' ? (seg) => {
                    const entries = (featEntries[selCat]||[]).filter(e=>e.subType===seg.name && monthOf(e.date)===selM);
                    if (entries.length > 0) setEditEntry({ entry: entries[entries.length-1], originY: SH * 0.45 });
                  } : null}
                />
              </TouchableOpacity>
              <View style={{ flex:1 }}>
                {catD.slice(0,5).map((cat,i) => (
                  <View key={cat.name} style={{ flexDirection:'row', alignItems:'center', gap:7, marginBottom:7 }}>
                    <View style={{ width:9, height:9, borderRadius:3, backgroundColor:cat.color }} />
                    <Text style={{ color:T.sub, fontSize:11, flex:1 }} numberOfLines={1}>{cat.icon} {cat.name}</Text>
                    <Text style={{ color:T.text, fontSize:11, fontWeight:'700' }}>{cat.pct}%</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={{ color:T.sub, fontSize:13, textAlign:'center', paddingVertical:16 }}>No data this period</Text>
          )
          )}

          {catD.map((cat,i) => (
            <View key={cat.name} style={{ marginBottom:13 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:5 }}>
                <Text style={{ color:T.text, fontSize:13 }}>{cat.icon||''} {cat.name}</Text>
                <Text style={{ color:T.sub, fontSize:12 }}>{fmt(cat.amt)} · {cat.pct}%</Text>
              </View>
              <View style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:99, height:5 }}>
                <View style={{ width:`${cat.pct}%`, backgroundColor:cat.color, borderRadius:99, height:5 }} />
              </View>
            </View>
          ))}
        </View>

        <View style={{ height:24 }} />
      </ScrollView>

      {pieExpanded && catD.length > 0 && (
        <PieExpanded data={catD} total={catTotal} T={T} onClose={() => setPieExpanded(false)} />
      )}
      {showDateRange && (
        <DateRangePicker startDate={rangeStart||curMonth()+'-01'} endDate={rangeEnd||todayStr()} T={T}
          onApply={(s,e) => { setRangeStart(s); setRangeEnd(e); setShowDateRange(false); }}
          onClose={() => setShowDateRange(false)} />
      )}
      {trendOpen && trendMonth && (
        <SlideScreen onClose={() => setTrendOpen(false)} zIndex={60} T={T} animLevel={animLevel}>
          {close => {
            const tEx  = expenses.filter(e=>monthOf(e.date)===trendMonth);
            const tTot = tEx.reduce((a,e)=>a+e.amount,0);
            const days = Array.from({length:31},(_,i)=>{ const d=`${trendMonth}-${String(i+1).padStart(2,'0')}`; return tEx.filter(e=>e.date===d).reduce((a,e)=>a+e.amount,0); });
            const maxD = Math.max(...days,1);
            const ct={}; tEx.forEach(e=>{ct[e.category]=(ct[e.category]||0)+e.amount;});
            const catData=Object.entries(ct).sort((a,b)=>b[1]-a[1]);
            return (
              <>
                <View style={[styles.detailHero, { backgroundColor:T.grad1+'22' }]}>
                  <TouchableOpacity onPress={close} style={styles.backBtn}><Text style={{ color:T.text, fontSize:18 }}>←</Text></TouchableOpacity>
                  <Text style={[styles.detailTitle,{ color:T.text, marginTop:8 }]}>{new Date(trendMonth+'-01').toLocaleString('en-IN',{month:'long',year:'numeric'})}</Text>
                  <Text style={[styles.detailAmt,{ color:T.accent }]}>{fmt(tTot)}</Text>
                  <Text style={{ color:T.sub, fontSize:11, marginTop:4 }}>{tEx.length} expenses</Text>
                </View>
                <ScrollView style={{ flex:1, paddingHorizontal:16 }} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.secTitle,{ color:T.text, marginTop:14, marginBottom:10 }]}>Daily Spending</Text>
                  <View style={{ flexDirection:'row', alignItems:'flex-end', height:72, gap:2, marginBottom:16 }}>
                    {days.map((v,i) => <View key={i} style={{ flex:1, alignItems:'center' }}><View style={{ height:Math.max(Math.round((v/maxD)*64),v>0?4:2), width:'100%', backgroundColor:v>0?T.accent:'rgba(103,80,164,0.15)', borderRadius:3 }} /></View>)}
                  </View>
                  <Text style={[styles.secTitle,{ color:T.text, marginBottom:10 }]}>By Category</Text>
                  {catData.map(([name,amt])=>{ const ca=CM[name]??CM['Other']; const pct=Math.round((amt/tTot)*100); return (
                    <View key={name} style={{ marginBottom:13 }}>
                      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:5 }}><Text style={{ color:T.text, fontSize:13 }}>{ca.icon} {name}</Text><Text style={{ color:T.sub, fontSize:12 }}>{fmt(amt)} · {pct}%</Text></View>
                      <View style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:99, height:5 }}><View style={{ width:`${pct}%`, backgroundColor:ca.color, borderRadius:99, height:5 }} /></View>
                    </View>
                  );})}
                  <View style={{ height:24 }} />
                </ScrollView>
              </>
            );
          }}
        </SlideScreen>
      )}
      {editEntry && (
        <FeatEditModal entry={editEntry.entry||editEntry} fid={selCat} dispatch={dispatch} T={T}
          originY={editEntry.originY} onClose={() => setEditEntry(null)} />
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

// ─── FEATURE ENTRY FORM (slide sheet inside More) ────────────────────────────
function FeatureSheet({ feat, featEntries, dispatch, onClose, T, animLevel }) {
  const entries = (featEntries[feat.id] || []).slice().reverse().slice(0, 5);
  const [amount,  setAmount]  = useState('');
  const [title,   setTitle]   = useState('');
  const [subType, setSubType] = useState(FEAT_SUB[feat.id]?.[0] || 'Other');
  const [note,    setNote]    = useState('');
  const [dateMode,setDateMode]= useState('today');
  const [saved,   setSaved]   = useState(false);
  const [err,     setErr]     = useState('');
  const color = FEAT_COLORS[feat.id] || feat.color;
  const subTypes = FEAT_SUB[feat.id] || ['Other'];

  const getDate = () => {
    if (dateMode === 'today')     return todayStr();
    if (dateMode === 'yesterday') return new Date(Date.now()-86400000).toISOString().slice(0,10);
    return curMonth() + '-01';
  };

  const isTarget = feat.id === 'goals' || feat.id === 'emi';
  const isSplit  = feat.id === 'split';

  const handleSave = (close) => {
    if (!title.trim())    { setErr('Enter a title'); return; }
    if (!amount || Number(amount) <= 0) { setErr('Enter a valid amount'); return; }
    setSaved(true);
    setTimeout(() => {
      if (isTarget) {
        dispatch({ type: 'ADD_FEAT', fid: feat.id, entry: {
          id: Date.now(), targetAmount: Number(amount), title: title.trim(),
          subType, date: getDate(), note: note.trim(), contributions: [],
        }});
      } else {
        dispatch({ type: 'ADD_FEAT', fid: feat.id, entry: {
          id: Date.now(), amount: Number(amount), title: title.trim(),
          subType, date: getDate(), note: note.trim(),
        }});
      }
      close();
    }, 600);
  };

  return (
    <SlideScreen onClose={onClose} zIndex={60} T={T} animLevel={animLevel}>
      {close => (
        <>
          <View style={[styles.detailHero, { backgroundColor: color + '20' }]}>
            <TouchableOpacity onPress={close} style={styles.backBtn}>
              <Text style={{ color: T.text, fontSize: 18 }}>←</Text>
            </TouchableOpacity>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: color+'28', alignItems:'center', justifyContent:'center', marginBottom: 10, borderWidth: 2, borderColor: color+'55' }}>
              <Text style={{ fontSize: 30 }}>{feat.icon}</Text>
            </View>
            <Text style={[styles.detailTitle, { color: T.text }]}>{feat.name}</Text>
            <Text style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>{feat.desc}</Text>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Amount — label changes for target features */}
              <View style={[styles.amountBox, { backgroundColor: T.surface }]}>
                <Text style={{ color: color, fontSize: 26, fontWeight: '300' }}>₹</Text>
                <TextInput value={amount} onChangeText={t => setAmount(t.replace(/[^0-9.]/g,''))}
                  placeholder={isTarget ? (feat.id==='emi' ? 'Total loan amount' : 'Target amount') : '0'}
                  placeholderTextColor={T.sub} keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: T.text }]} />
              </View>
              {isTarget && <Text style={{ color: T.sub, fontSize: 11, textAlign: 'center', marginBottom: 8 }}>{feat.id==='emi' ? 'Set the total loan amount' : 'Set your target amount'}</Text>}
              {/* Title */}
              <View style={[styles.formField, { backgroundColor: T.surface }]}>
                <Text style={[styles.fieldLabel, { color: T.sub }]}>{isTarget ? (feat.id==='emi' ? 'LOAN NAME' : 'GOAL NAME') : 'TITLE'}</Text>
                <TextInput value={title} onChangeText={setTitle}
                  placeholder={isTarget ? (feat.id==='emi' ? 'e.g. Car Loan' : 'e.g. Buy a Laptop') : 'e.g. Monthly Salary'}
                  placeholderTextColor={T.sub}
                  style={[styles.fieldInput, { color: T.text }]} />
              </View>
              {/* Sub-type */}
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>TYPE</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {subTypes.map(s => (
                    <TouchableOpacity key={s} onPress={() => setSubType(s)}
                      style={[styles.catPill, { backgroundColor: subType===s ? color+'22' : T.surface, borderColor: subType===s ? color : 'transparent' }]}>
                      <Text style={{ color: subType===s ? color : T.sub, fontSize: 11, fontWeight: subType===s ? '700' : '400' }}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* Date */}
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>DATE</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[['today','Today'],['yesterday','Yesterday'],['month','1st of Month']].map(([k,l]) => (
                    <TouchableOpacity key={k} onPress={() => setDateMode(k)}
                      style={[styles.filterPill, { backgroundColor: dateMode===k ? color : T.surface, flex: 1, alignItems:'center' }]}>
                      <Text style={{ color: dateMode===k ? '#fff' : T.sub, fontSize: 11, fontWeight: dateMode===k?'700':'400' }}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* Note */}
              <View style={[styles.formField, { backgroundColor: T.surface }]}>
                <Text style={[styles.fieldLabel, { color: T.sub }]}>NOTE (optional)</Text>
                <TextInput value={note} onChangeText={setNote}
                  placeholder="Add a note…" placeholderTextColor={T.sub}
                  style={[styles.fieldInput, { color: T.text }]} />
              </View>
              {err ? <Text style={styles.errText}>{err}</Text> : null}
              {/* Recent entries */}
              {entries.length > 0 && (
                <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                  <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>RECENT ENTRIES</Text>
                  {entries.map(e => (
                    <View key={e.id} style={{ flexDirection:'row', alignItems:'center', gap:10, padding:10, backgroundColor:T.surface, borderRadius:13, marginBottom:6 }}>
                      <View style={{ width:36, height:36, borderRadius:11, backgroundColor:color+'22', alignItems:'center', justifyContent:'center' }}>
                        <Text style={{ fontSize:16 }}>{feat.icon}</Text>
                      </View>
                      <View style={{ flex:1 }}>
                        <Text style={{ color:T.text, fontSize:13, fontWeight:'600' }}>{e.title}</Text>
                        <Text style={{ color:T.sub, fontSize:11 }}>{e.subType} · {dispDate(e.date)}</Text>
                      </View>
                      <Text style={{ color:color, fontSize:13, fontWeight:'700' }}>{fmt(e.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </KeyboardAvoidingView>
          <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <TouchableOpacity onPress={() => handleSave(close)}
              style={[styles.saveBtn, { backgroundColor: saved ? '#4CAF50' : color }]}>
              <Text style={styles.saveBtnText}>{saved ? '✓ Saved!' : `Add ${feat.name} Entry`}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SlideScreen>
  );
}


// ─── BILL SPLIT SHEET ─────────────────────────────────────────────────────────
function BillSplitSheet({ dispatch, onClose, T, animLevel }) {
  const color = '#00BCD4';
  const BCATS = ['🍽️ Dinner','✌🏼 Trip','🛒 Groceries','🏠 Rent','⚡ Utilities','🎉 Party','🎬 Movie','Other'];
  const [step,      setStep]      = useState(0);
  const [billTitle, setBillTitle] = useState('');
  const [amount,    setAmount]    = useState('');
  const [category,  setCategory]  = useState(BCATS[0]);
  const [people,    setPeople]    = useState([{ name: 'Me' }]);
  const [newPerson, setNewPerson] = useState('');
  const [payer,     setPayer]     = useState('Me');
  const [splitType, setSplitType] = useState('equal');
  const [custom,    setCustom]    = useState({});
  const [saved,     setSaved]     = useState(false);

  const addPerson = () => {
    const n = newPerson.trim();
    if (!n || people.find(p => p.name.toLowerCase() === n.toLowerCase())) return;
    setPeople(prev => [...prev, { name: n }]);
    setNewPerson('');
  };

  const removePerson = (name) => {
    setPeople(prev => prev.filter(p => p.name !== name));
    if (payer === name) setPayer('Me');
  };

  const perPerson = () => Math.floor(Number(amount) / people.length * 100) / 100;

  const createBill = (close) => {
    const amt = Number(amount);
    if (!amt || !billTitle.trim()) return;
    if (splitType === 'custom') {
      const tot = Object.values(custom).reduce((a, v) => a + (Number(v)||0), 0);
      if (Math.abs(tot - amt) > 1) return;
    }
    const pp = perPerson();
    const finalPeople = people.map(p => ({
      name: p.name,
      share: splitType === 'equal' ? pp : (Number(custom[p.name])||0),
      settled: p.name === payer,
    }));
    setSaved(true);
    setTimeout(() => {
      dispatch({ type: 'ADD_BILL', bill: {
        id: Date.now(), title: billTitle.trim(), amount: amt,
        category, date: todayStr(), people: finalPeople, payer, splitType, fullySettled: false,
      }});
      close();
    }, 600);
  };

  const STEPS = ['Bill Details', 'Add People', 'Who Paid?', 'Split Amounts'];

  return (
    <SlideScreen onClose={onClose} zIndex={60} T={T} animLevel={animLevel}>
      {close => (
        <>
          <View style={[styles.detailHero, { backgroundColor: color + '20' }]}>
            <TouchableOpacity onPress={close} style={styles.backBtn}>
              <Text style={{ color: T.text, fontSize: 18 }}>←</Text>
            </TouchableOpacity>
            <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: color+'28', alignItems:'center', justifyContent:'center', marginBottom: 8, borderWidth: 2, borderColor: color+'55' }}>
              <Text style={{ fontSize: 26 }}>🧾</Text>
            </View>
            <Text style={[styles.detailTitle, { color: T.text }]}>{STEPS[step]}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
              {STEPS.map((_, i) => <View key={i} style={{ height: 3, width: 40, borderRadius: 2, backgroundColor: i <= step ? color : T.surface2 }} />)}
            </View>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {step === 0 && (
                <>
                  <View style={[styles.amountBox, { backgroundColor: T.surface }]}>
                    <Text style={{ color: color, fontSize: 26, fontWeight: '300' }}>₹</Text>
                    <TextInput value={amount} onChangeText={t => setAmount(t.replace(/[^0-9.]/g,''))}
                      placeholder="0" placeholderTextColor={T.sub} keyboardType="decimal-pad"
                      style={[styles.amountInput, { color: T.text }]} />
                  </View>
                  <View style={[styles.formField, { backgroundColor: T.surface }]}>
                    <Text style={[styles.fieldLabel, { color: T.sub }]}>BILL NAME</Text>
                    <TextInput value={billTitle} onChangeText={setBillTitle}
                      placeholder="e.g. Dinner at Toit" placeholderTextColor={T.sub}
                      style={[styles.fieldInput, { color: T.text }]} />
                  </View>
                  <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>CATEGORY</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {BCATS.map(cat => (
                        <TouchableOpacity key={cat} onPress={() => setCategory(cat)}
                          style={[styles.filterPill, { backgroundColor: category===cat ? color : T.surface }]}>
                          <Text style={{ color: category===cat ? '#fff' : T.sub, fontSize: 11, fontWeight: category===cat?'700':'400' }}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={{ height: 20 }} />
                </>
              )}
              {step === 1 && (
                <>
                  <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>ADD PEOPLE</Text>
                    <Text style={{ color: T.sub, fontSize: 11, marginBottom: 12 }}>You are always included.</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      <TextInput value={newPerson} onChangeText={setNewPerson}
                        placeholder="Friend's name…" placeholderTextColor={T.sub}
                        style={[styles.fieldInput, { color: T.text, flex: 1, backgroundColor: T.surface, borderRadius: 13, padding: 13 }]}
                        onSubmitEditing={addPerson} returnKeyType="done" />
                      <TouchableOpacity onPress={addPerson}
                        style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300' }}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {people.map(p => (
                      <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.surface, borderRadius: 13, padding: 12, marginBottom: 8 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color+'33', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: color, fontSize: 12, fontWeight: '700' }}>{p.name.slice(0,2).toUpperCase()}</Text>
                        </View>
                        <Text style={{ color: T.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{p.name === 'Me' ? '👤 You' : p.name}</Text>
                        {p.name === 'Me'
                          ? <Text style={{ color: T.sub, fontSize: 11 }}>always in</Text>
                          : <TouchableOpacity onPress={() => removePerson(p.name)}
                              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,107,107,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ color: '#FF6B6B', fontSize: 14 }}>✕</Text>
                            </TouchableOpacity>
                        }
                      </View>
                    ))}
                  </View>
                  <View style={{ height: 20 }} />
                </>
              )}
              {step === 2 && (
                <>
                  <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: color+'18', borderRadius: 16, padding: 14, alignItems: 'center' }}>
                    <Text style={{ color: T.sub, fontSize: 10, marginBottom: 4 }}>BILL TOTAL</Text>
                    <Text style={{ color: color, fontSize: 28, fontWeight: '800' }}>{fmt(Number(amount))}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>WHO PAID THE BILL?</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {people.map(p => (
                        <TouchableOpacity key={p.name} onPress={() => setPayer(p.name)}
                          style={[styles.filterPill, { backgroundColor: payer===p.name ? color : T.surface }]}>
                          <Text style={{ color: payer===p.name ? '#fff' : T.sub, fontSize: 11, fontWeight: payer===p.name?'700':'400' }}>{p.name === 'Me' ? 'Me (You)' : p.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={{ height: 20 }} />
                </>
              )}
              {step === 3 && (
                <>
                  <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>SPLIT TYPE</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: T.surface, borderRadius: 12, padding: 3, marginBottom: 14 }}>
                      {[['equal','Equal'],['custom','Custom']].map(([k,l]) => (
                        <TouchableOpacity key={k} onPress={() => setSplitType(k)}
                          style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: splitType===k ? color : 'transparent', alignItems: 'center' }}>
                          <Text style={{ color: splitType===k ? '#fff' : T.sub, fontSize: 12, fontWeight: splitType===k?'700':'400' }}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {splitType === 'equal'
                      ? people.map(p => (
                          <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color+'33', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ color: color, fontSize: 12, fontWeight: '700' }}>{p.name.slice(0,2).toUpperCase()}</Text>
                            </View>
                            <Text style={{ color: T.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{p.name === 'Me' ? 'You' : p.name}{p.name === payer ? ' 💳' : ''}</Text>
                            <Text style={{ color: color, fontSize: 15, fontWeight: '800' }}>{fmt(perPerson())}</Text>
                          </View>
                        ))
                      : <>
                          {people.map(p => (
                            <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color+'33', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: color, fontSize: 12, fontWeight: '700' }}>{p.name.slice(0,2).toUpperCase()}</Text>
                              </View>
                              <Text style={{ color: T.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{p.name === 'Me' ? 'You' : p.name}{p.name === payer ? ' 💳' : ''}</Text>
                              <TextInput
                                value={custom[p.name] ? String(custom[p.name]) : ''}
                                onChangeText={v => setCustom(prev => ({ ...prev, [p.name]: v }))}
                                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={T.sub}
                                style={{ width: 90, backgroundColor: T.surface2, borderRadius: 10, padding: 10, color: T.text, fontSize: 14, fontWeight: '700', textAlign: 'right' }}
                              />
                            </View>
                          ))}
                          {(() => {
                            const tot = Object.values(custom).reduce((a,v)=>a+(Number(v)||0),0);
                            const rem = Number(amount) - tot;
                            const ok = Math.abs(rem) < 0.5;
                            return <View style={{ padding: 10, borderRadius: 12, backgroundColor: ok ? 'rgba(46,204,138,0.1)' : 'rgba(255,107,107,0.1)', alignItems: 'center' }}>
                              <Text style={{ color: ok ? '#2ECC8A' : '#FF6B6B', fontSize: 12, fontWeight: '600' }}>
                                {ok ? '✓ Amounts add up to ' + fmt(Number(amount)) : fmt(Math.abs(rem)) + (rem > 0 ? ' remaining' : ' over budget')}
                              </Text>
                            </View>;
                          })()}
                        </>
                    }
                  </View>
                  <View style={{ height: 20 }} />
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
          <View style={{ paddingHorizontal: 16, paddingBottom: 32, flexDirection: 'row', gap: 10 }}>
            {step > 0 && (
              <TouchableOpacity onPress={() => setStep(s => s-1)}
                style={[styles.saveBtn, { flex: 1, backgroundColor: T.surface }]}>
                <Text style={[styles.saveBtnText, { color: T.sub }]}>← Back</Text>
              </TouchableOpacity>
            )}
            {step < 3
              ? <TouchableOpacity onPress={() => {
                    if (step === 0 && (!Number(amount) || !billTitle.trim())) return;
                    if (step === 1 && people.length < 2) return;
                    setStep(s => s+1);
                  }}
                  style={[styles.saveBtn, { flex: 2, backgroundColor: color }]}>
                  <Text style={styles.saveBtnText}>Next →</Text>
                </TouchableOpacity>
              : <TouchableOpacity onPress={() => createBill(close)}
                  style={[styles.saveBtn, { flex: 2, backgroundColor: saved ? '#4CAF50' : color }]}>
                  <Text style={styles.saveBtnText}>{saved ? '✓ Bill Created!' : 'Create Bill ✓'}</Text>
                </TouchableOpacity>
            }
          </View>
        </>
      )}
    </SlideScreen>
  );
}

// ─── MORE SCREEN ──────────────────────────────────────────────────────────────
function MoreScreen({ features, featEntries, dispatch, expenses, T, animLevel, collapsed, setCollapsed }) {
  const enabledFeats = React.useMemo(
    () => FEATURES.filter(f => features[f.id]),
    [Object.values(features).join(',')]
  );
  const [showFeat,      setShowFeat]      = useState(null);
  const [showBillSplit, setShowBillSplit] = useState(false);
  const [selBbl,        setSelBbl]        = useState(-1);
  const BSIZE = Math.min(SW * 0.185, 78);
  const n     = enabledFeats.length;
  const cols  = n <= 2 ? n : n <= 4 ? 2 : 3;
  const rows  = n > 0 ? Math.ceil(n / cols) : 0;
  const FIELD_H = n > 0 ? (rows - 1) * BSIZE * 1.16 + BSIZE + 40 : 200;

  const handleBbl = i => {
    if (collapsed) { setCollapsed(false); return; }
    const feat = enabledFeats[i];
    setSelBbl(i);
    if (feat.id === 'split') {
      setShowBillSplit(true);
    } else {
      setShowFeat(feat);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: T.sub, fontSize: 12 }}>Your Features</Text>
          <Text style={[styles.screenTitle, { color: T.text, paddingHorizontal: 0, paddingTop: 0 }]}>More ✦</Text>
        </View>
        {enabledFeats.length > 0 && (
          <TouchableOpacity onPress={() => { setCollapsed(p => !p); setSelBbl(-1); }}
            style={{ backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.accent+'55', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12 }}>{collapsed ? '✨' : '🔵'}</Text>
            <Text style={{ color: T.accent, fontSize: 11, fontWeight: '700' }}>{collapsed ? 'Expand' : 'Collapse'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {enabledFeats.length === 0 ? (
        <View style={[styles.emptyBox, { flex: 1 }]}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>✦</Text>
          <Text style={[styles.emptyTitle, { color: T.text }]}>No features enabled</Text>
          <Text style={{ color: T.sub, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
            {'Go to Settings → Features\nto enable Income, EMI and more'}
          </Text>
        </View>
      ) : (
        <BubbleField
          cats={enabledFeats} onSelect={handleBbl} selected={selBbl} T={T}
          animLevel={animLevel} fieldH={FIELD_H} bSize={BSIZE}
          collapsed={collapsed} onCollapseChange={setCollapsed}
        />
      )}

      {showFeat && (
        <FeatureSheet
          feat={showFeat} featEntries={featEntries} dispatch={dispatch}
          onClose={() => { setShowFeat(null); setSelBbl(-1); }}
          T={T} animLevel={animLevel}
        />
      )}
      {showBillSplit && (
        <BillSplitSheet dispatch={dispatch} onClose={() => { setShowBillSplit(false); setSelBbl(-1); }} T={T} animLevel={animLevel} />
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


// ─── DATE PICKER MODAL ────────────────────────────────────────────────────────
function DatePickerModal({ currentDate, onSelect, onClose, T }) {
  const d = new Date(currentDate);
  const [year,  setYear ] = useState(d.getFullYear());
  const [month, setMonth] = useState(d.getMonth());
  const [day,   setDay  ] = useState(d.getDate());
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const close = cb => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 300, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 220, useNativeDriver: true }),
    ]).start(cb);
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days   = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const months = MONTHS.map((m, i) => ({ label: m, value: i }));
  const years  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 4 + i);

  const confirm = () => {
    const safeDay = Math.min(day, daysInMonth);
    const result = `${year}-${String(month+1).padStart(2,'0')}-${String(safeDay).padStart(2,'0')}`;
    close(() => onSelect(result));
  };

  const Wheel = ({ items, selected, onSelect: onSel, width }) => (
    <ScrollView style={{ height: 180, width }} showsVerticalScrollIndicator={false} snapToInterval={44} decelerationRate="fast">
      <View style={{ paddingVertical: 68 }}>
        {items.map(item => {
          const val   = typeof item === 'object' ? item.value : item;
          const label = typeof item === 'object' ? item.label : String(item);
          const isSelected = val === selected;
          return (
            <TouchableOpacity key={val} onPress={() => onSel(val)}
              style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: isSelected ? T.accent : T.sub, fontSize: isSelected ? 18 : 14, fontWeight: isSelected ? '700' : '400' }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => close(onClose)}>
    <Animated.View style={{ flex: 1, justifyContent: 'flex-end', opacity: fadeAnim }}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => close(onClose)} activeOpacity={1} />
      <Animated.View style={{ backgroundColor: T.surface, borderRadius: 24, margin: 16, padding: 20, transform: [{ translateY: slideAnim }] }}>
        <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' }}>Select Date</Text>
        {/* Selected indicator line */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: T.sub, fontSize: 10, marginBottom: 4 }}>DAY</Text>
            <Wheel items={days} selected={day} onSelect={setDay} width={70} />
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: T.sub, fontSize: 10, marginBottom: 4 }}>MONTH</Text>
            <Wheel items={months} selected={month} onSelect={setMonth} width={80} />
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: T.sub, fontSize: 10, marginBottom: 4 }}>YEAR</Text>
            <Wheel items={years} selected={year} onSelect={setYear} width={80} />
          </View>
        </View>
        {/* Highlight bar */}
        <View pointerEvents='none' style={{ position: 'absolute', top: 108, left: 20, right: 20, height: 44, backgroundColor: T.accent+'18', borderRadius: 12, borderWidth: 1, borderColor: T.accent+'33' }} />
        <TouchableOpacity onPress={confirm} style={{ backgroundColor: T.grad1, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Confirm</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
    </Modal>
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
  const [saved,          setSaved         ] = useState(false);
  const [err,            setErr           ] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
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
              {/* Date picker */}
              <TouchableOpacity onPress={() => setShowDatePicker(true)}
                style={[styles.formField, { backgroundColor: T.surface }]}>
                <Text style={[styles.fieldLabel, { color: T.sub }]}>DATE</Text>
                <Text style={[styles.fieldInput, { color: T.text }]}>{dispDate(date)} · {date}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DatePickerModal
                  currentDate={date}
                  onSelect={d => { setDate(d); setShowDatePicker(false); }}
                  onClose={() => setShowDatePicker(false)}
                  T={T}
                />
              )}
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
  const [moreCollapsed, setMoreCollapsed] = useState(false);
  const [statsCat,      setStatsCat]      = useState('expenses');

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
      {tab === 'home'     && <HomeScreen     state={state} dispatch={dispatch} onRow={handleRow} onEdit={handleEdit} onQuickAdd={() => { setFormEx(null); setShowForm(true); }} T={T} animLevel={aL} collapsed={homeCollapsed} setCollapsed={setHomeCollapsed} />}
      {tab === 'stats'    && <StatsScreen    expenses={state.expenses} featEntries={state.featEntries} bills={state.bills||[]} dispatch={dispatch} T={T} animLevel={aL} selCat={statsCat} setSelCat={setStatsCat} />}
      {tab === 'history'  && <HistoryScreen  expenses={state.expenses} onRow={handleRow} T={T} animLevel={aL} />}
      {tab === 'more'     && <MoreScreen     features={state.features} featEntries={state.featEntries} dispatch={dispatch} expenses={state.expenses} T={T} animLevel={aL} collapsed={moreCollapsed} setCollapsed={setMoreCollapsed} />}
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
