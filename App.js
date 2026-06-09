import React, {
  useState, useEffect, useReducer, useRef, useCallback
} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TouchableWithoutFeedback, TextInput,
  StyleSheet, Dimensions, Animated, StatusBar, Platform,
  Alert, KeyboardAvoidingView, BackHandler, PanResponder, AppState, Share, Clipboard,
  Easing, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';
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
  glass: {
    bg: '#0A0812', surface: 'rgba(255,255,255,0.06)', surface2: 'rgba(255,255,255,0.03)',
    text: '#E6E1E5', sub: 'rgba(230,225,229,0.45)',
    border: 'rgba(255,255,255,0.12)', accent: '#B985FA',
    grad1: '#6750A4', grad2: '#9C68E8', nav: 'rgba(10,8,18,0.88)', card: 'rgba(103,80,164,0.22)',
    glass: true,
  },
  white: {
    bg: '#ECEEF3', surface: '#E4E6ED', surface2: '#DDE0E8',
    text: '#1A1D2E', sub: 'rgba(26,29,46,0.45)',
    border: 'rgba(166,172,189,0.3)', accent: '#6B4EFF',
    grad1: '#6750A4', grad2: '#9C68E8', nav: '#ECEEF3', card: '#6750A4',
    white: true,
  },
  dark: {
    bg: '#0D0D0D', surface: '#141414', surface2: '#111111',
    text: '#E5E5E5', sub: 'rgba(229,229,229,0.3)',
    border: 'rgba(255,255,255,0.04)', accent: '#A855F7',
    grad1: '#7C3AED', grad2: '#A855F7', nav: '#0D0D0D', card: '#1E0545',
    dark: true,
  },
};

// ─── TILE STYLE HELPER — adds depth shadow for white/dark themes ─────────────
function tileStyle(T, extra = {}) {
  if (T.white) return {
    backgroundColor: '#E8EAF0',
    borderRadius: 18,
    shadowColor: '#A6ACBD',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 4, height: 6 },
    elevation: 5,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.9)',
    borderLeftColor: 'rgba(255,255,255,0.7)',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: 'rgba(166,172,189,0.4)',
    borderRightColor: 'rgba(166,172,189,0.3)',
    ...extra,
  };
  if (T.dark) return {
    backgroundColor: '#141414',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 5, height: 7 },
    elevation: 8,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderLeftColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.9)',
    borderRightColor: 'rgba(0,0,0,0.7)',
    ...extra,
  };
  return { backgroundColor: T.surface, borderRadius: 18, ...extra };
}

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
  pin: null, biometric: false, lockDelay: 'immediate', catBudgets: {},
  features: { income: false, investments: false, goals: false, emi: false, accounts: false, split: false, tax: false },
  featEntries: {},
  bills: [],
  recurring: [],
  savedInsights: [],
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
    case 'SET_LOCK_DELAY': return { ...state, lockDelay: action.v };
    case 'SET_CAT_BUDGET': return { ...state, catBudgets: { ...state.catBudgets, [action.cat]: action.v } };
    case 'SET_FEATURE':    return { ...state, features: { ...state.features, [action.id]: action.v } };
    case 'TOGGLE_RECURRING_SCREEN': return { ...state, showRecurring: action.v };
    case 'ADD_FEAT':       return { ...state, featEntries: { ...state.featEntries, [action.fid]: [...(state.featEntries[action.fid]||[]), action.entry] } };
    case 'EDIT_FEAT':      return { ...state, featEntries: { ...state.featEntries, [action.fid]: (state.featEntries[action.fid]||[]).map(e => e.id===action.entry.id ? action.entry : e) } };
    case 'DELETE_FEAT':    return { ...state, featEntries: { ...state.featEntries, [action.fid]: (state.featEntries[action.fid]||[]).filter(e => e.id!==action.id) } };
    case 'ADD_BILL':       return { ...state, bills: [...(state.bills||[]), action.bill] };
    case 'DELETE_BILL':    return { ...state, bills: (state.bills||[]).filter(b => b.id !== action.id) };
    case 'SETTLE_BILL':    return { ...state, bills: (state.bills||[]).map(b => b.id===action.billId ? { ...b, people: b.people.map(p => p.name===action.person ? { ...p, settled:true } : p), fullySettled: b.people.filter(p=>p.name!==b.payer).every(p=>p.name===action.person?true:p.settled) } : b) };
    case 'CONTRIBUTE':     return { ...state, featEntries: { ...state.featEntries, [action.fid]: (state.featEntries[action.fid]||[]).map(e => e.id===action.id ? { ...e, contributions:[...(e.contributions||[]),action.contribution] } : e) } };
    case 'DELETE_CONTRIBUTION': return { ...state, featEntries: { ...state.featEntries, [action.fid]: (state.featEntries[action.fid]||[]).map(e => e.id===action.entryId ? { ...e, contributions:(e.contributions||[]).filter(cn=>cn.id!==action.contribId) } : e) } };
    case 'ADD_RECURRING':    return { ...state, recurring: [...(state.recurring||[]), action.item] };
    case 'SAVE_INSIGHT':   return { ...state, savedInsights: [...(state.savedInsights||[]).slice(-200), action.insight] };
    case 'CLEAR_INSIGHTS': return { ...state, savedInsights: [] };
    case 'DELETE_RECURRING': return { ...state, recurring: (state.recurring||[]).filter(r => r.id !== action.id) };
    case 'EDIT_RECURRING':   return { ...state, recurring: (state.recurring||[]).map(r => r.id===action.item.id ? action.item : r) };
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

// ─── SLIDE SCREEN (with Genie open/close effect) ─────────────────────────────
function SlideScreen({ children, onClose, zIndex = 50, T, animLevel }) {
  // Genie uses three simultaneous animations:
  // translateY: screen rises from bottom
  // scaleX: widens from pinched to full as it opens (genie warp)
  // scaleY: stretches as it rises then settles
  const ty     = useRef(new Animated.Value(SH)).current;
  const scaleX = useRef(new Animated.Value(0.08)).current;
  const scaleY = useRef(new Animated.Value(0.08)).current;
  const opac   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animLevel === 'none') {
      ty.setValue(0); scaleX.setValue(1); scaleY.setValue(1); opac.setValue(1);
      return;
    }
    // Genie IN: pinched point at bottom → full screen
    Animated.parallel([
      Animated.timing(opac,   { toValue:1, duration:80, useNativeDriver:true }),
      Animated.timing(ty,     { toValue:0, duration:440, easing:Easing.out(Easing.cubic), useNativeDriver:true }),
      Animated.sequence([
        // scaleX: widen from thin to full — this creates the genie warp
        Animated.timing(scaleX, { toValue:0.3, duration:100, easing:Easing.out(Easing.quad), useNativeDriver:true }),
        Animated.timing(scaleX, { toValue:0.7, duration:120, easing:Easing.out(Easing.quad), useNativeDriver:true }),
        Animated.spring(scaleX, { toValue:1, tension:55, friction:9, useNativeDriver:true }),
      ]),
      Animated.sequence([
        // scaleY: elongate slightly during travel then snap
        Animated.timing(scaleY, { toValue:1.06, duration:260, easing:Easing.out(Easing.quad), useNativeDriver:true }),
        Animated.spring(scaleY, { toValue:1, tension:65, friction:9, useNativeDriver:true }),
      ]),
    ]).start();
  }, []);

  const genieClose = useCallback(() => {
    if (animLevel === 'none') { onClose(); return; }
    // Genie OUT: pinch back into nav point
    Animated.parallel([
      Animated.timing(ty,     { toValue:SH*0.6, duration:380, easing:Easing.in(Easing.cubic), useNativeDriver:true }),
      Animated.sequence([
        Animated.timing(scaleY, { toValue:0.6, duration:180, easing:Easing.in(Easing.quad), useNativeDriver:true }),
        Animated.timing(scaleY, { toValue:0.08, duration:200, easing:Easing.in(Easing.cubic), useNativeDriver:true }),
      ]),
      Animated.sequence([
        Animated.timing(scaleX, { toValue:0.5, duration:200, easing:Easing.in(Easing.quad), useNativeDriver:true }),
        Animated.timing(scaleX, { toValue:0.08, duration:180, easing:Easing.in(Easing.cubic), useNativeDriver:true }),
      ]),
      Animated.timing(opac, { toValue:0, duration:340, delay:40, useNativeDriver:true }),
    ]).start(onClose);
  }, [onClose, animLevel]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { genieClose(); return true; });
    return () => sub.remove();
  }, [genieClose]);

  // Swipe down to dismiss — still works, overrides genie on drag
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) {
        ty.setValue(g.dy);
        // As you drag down, pinch the scaleX too for visual feel
        scaleX.setValue(Math.max(0.08, 1 - g.dy / (SH * 1.8)));
      }
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > SH * 0.28 || g.vy > 0.8) {
        genieClose();
      } else {
        Animated.parallel([
          Animated.spring(ty,     { toValue:0, ...SPRING }),
          Animated.spring(scaleX, { toValue:1, tension:55, friction:9, useNativeDriver:true }),
        ]).start();
      }
    },
  })).current;

  return (
    <Animated.View style={[styles.slideScreen, {
      zIndex,
      backgroundColor: T.bg,
      opacity: opac,
      transform: [
        { translateY: ty },
        { scaleX },
        { scaleY },
      ],
      // Origin at bottom so genie effect anchors to nav
      transformOrigin: 'center bottom',
    }]}>
      <View {...pan.panHandlers} style={styles.dragHandleArea}>
        <View style={styles.dragHandle} />
      </View>
      {children(genieClose)}
    </Animated.View>
  );
}


// ─── SINGULARITY DELETE ANIMATION ─────────────────────────────────────────────
function SingularityDelete({ onDone }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const glow    = useRef(new Animated.Value(0)).current;
  const spin    = useRef(new Animated.Value(0)).current;
  const implode = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Phase 1: flash glow, start spinning
      Animated.parallel([
        Animated.timing(glow,    { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(spin,    { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      // Phase 2: implode to singularity point
      Animated.parallel([
        Animated.timing(implode, { toValue: 0,    duration: 350, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(scale,   { toValue: 2.5,  duration: 200, useNativeDriver: true }),
        Animated.timing(glow,    { toValue: 0.6,  duration: 200, useNativeDriver: true }),
      ]),
      // Phase 3: singularity flash + disappear
      Animated.parallel([
        Animated.timing(scale,   { toValue: 0,   duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,   duration: 200, useNativeDriver: true }),
        Animated.timing(glow,    { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]),
    ]).start(() => onDone && onDone());
  }, []);

  const rotate = spin.interpolate({ inputRange:[0,1], outputRange:['0deg','360deg'] });

  return (
    <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'center', zIndex:200 }} pointerEvents="none">
      {/* Outer glow ring */}
      <Animated.View style={{ position:'absolute', width:80, height:80, borderRadius:40, backgroundColor:'#B985FA', opacity: glow, transform:[{ scale }] }} />
      {/* Spinning ring */}
      <Animated.View style={{ position:'absolute', width:50, height:50, borderRadius:25, borderWidth:2, borderColor:'#fff', opacity: implode, transform:[{ rotate }, { scale: implode }] }} />
      {/* Inner singularity core */}
      <Animated.View style={{ width:16, height:16, borderRadius:8, backgroundColor:'#fff', opacity: implode, transform:[{ scale: Animated.multiply(implode, scale) }] }} />
      {/* Particle dots sucked in */}
      {[0,1,2,3,4,5].map(i => {
        const angle = (i / 6) * Math.PI * 2;
        const dist  = implode.interpolate({ inputRange:[0,1], outputRange:[0, 35] });
        return (
          <Animated.View key={i} style={{
            position:'absolute', width:6, height:6, borderRadius:3,
            backgroundColor: i%2===0 ? '#B985FA' : '#FF6B6B',
            opacity: implode,
            transform:[
              { translateX: Animated.multiply(dist, Math.cos(angle)) },
              { translateY: Animated.multiply(dist, Math.sin(angle)) },
              { scale: implode },
            ],
          }} />
        );
      })}
    </View>
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
      // ── Repulsion: only when fully expanded, skip during collapse/expand ────
      const minDist = bSize * 1.1;
      const margin = bSize * 0.5;
      // Only repel if most bubbles are near full scale (expanded state)
      const avgFb = bs.reduce((a, b) => a + b.fb, 0) / bs.length;
      if (avgFb > 0.85) {
        for (let i = 0; i < bs.length; i++) {
          for (let j = i + 1; j < bs.length; j++) {
            const dx = bs[j].x - bs[i].x;
            const dy = bs[j].y - bs[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
            if (dist < minDist) {
              const overlap = (minDist - dist) / minDist;
              const force = overlap * 0.9;
              const nx = dx / dist, ny = dy / dist;
              bs[i].x -= nx * force * bSize * 0.5;
              bs[i].y -= ny * force * bSize * 0.5;
              bs[j].x += nx * force * bSize * 0.5;
              bs[j].y += ny * force * bSize * 0.5;
            }
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
            {/* Glow — starts hidden, only selected bubble lights up via RAF */}
            <View ref={refs[i].glow} style={{ position: 'absolute', top: -bSize * 0.22, left: -bSize * 0.22, right: -bSize * 0.22, bottom: -bSize * 0.22, borderRadius: 999, backgroundColor: cat.color, opacity: 0 }} />
            {/* Circle */}
            <View ref={refs[i].circ}
              style={T.white ? {
                width: bSize, height: bSize, borderRadius: bSize / 2,
                backgroundColor: '#ECEEF3',
                elevation: 6,
                shadowColor: cat.color,
                shadowOpacity: 0.3,
                shadowRadius: 10,
                shadowOffset: { width: 4, height: 5 },
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              } : T.dark ? {
                width: bSize, height: bSize, borderRadius: bSize / 2,
                backgroundColor: '#111111',
                elevation: 8,
                shadowColor: cat.color,
                shadowOpacity: 0.35,
                shadowRadius: 16,
                shadowOffset: { width: 4, height: 6 },
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                borderTopWidth: 1, borderLeftWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.06)',
                borderLeftColor: 'rgba(255,255,255,0.04)',
              } : {
                width: bSize, height: bSize, borderRadius: bSize / 2,
                backgroundColor: cat.color + '28', borderWidth: 2, borderColor: cat.color + '99',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
              {/* Shine — same for all themes */}
              <View style={{ position: 'absolute', top: '10%', left: '14%', width: '28%', height: '18%', borderRadius: 99,
                backgroundColor: T.white ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.22)' }} />
              <Text style={{ fontSize: bSize * 0.36, lineHeight: bSize * 0.44 }}>{cat.icon}</Text>
              <Text ref={refs[i].lbl} style={{ fontSize: bSize * 0.13, color: cat.color + (T.white ? 'FF' : 'cc'), fontWeight: T.white ? '700' : '500', marginTop: bSize * 0.04, textAlign: 'center' }}>{cat.name}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
}


// ─── LIQUID BUDGET BAR ────────────────────────────────────────────────────────
function LiquidBudgetBar({ pct, animLevel }) {
  const fillAnim   = useRef(new Animated.Value(0)).current;
  const clampedPct = Math.min(pct, 100);
  const fillColor  = pct > 100 ? '#FF3B30' : pct > 85 ? '#FF6B6B' : pct > 60 ? '#FF9800' : '#B985FA';

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: clampedPct,
      duration: animLevel === 'none' ? 0 : 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clampedPct]);

  const fillWidth = fillAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
  <View style={{ height: 18, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden', marginTop: 12, marginBottom: 4 }}>
      {/* Coloured fill */}
      <Animated.View style={{ position:'absolute', top:0, left:0, bottom:0, width: fillWidth, backgroundColor: fillColor, borderRadius: 99, opacity: 0.9 }} />
      {/* Lottie wave overlay clipped to fill width */}
      <Animated.View style={{ position:'absolute', top:0, left:0, bottom:0, width: fillWidth, overflow:'hidden', borderRadius: 99 }}>
        <LottieView
          source={require('./lottie-waves.json')}
          autoPlay loop style={{ position:'absolute', top:-14, left:-10, width: 420, height: 46 }}
          speed={0.6}
        />
      </Animated.View>
    </View>
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
function HomeScreen({ state, dispatch, onRow, onEdit, onQuickAdd, onDelete, T, animLevel, collapsed, setCollapsed, onSaveInsights, breathAnim }) {
  const mEx   = state.expenses.filter(e => monthOf(e.date) === curMonth());
  const [insightsCollapsed, setInsightsCollapsed] = useState(false);
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

  // ── SMART INSIGHT ENGINE ──────────────────────────────────────────────────
  const insights = React.useMemo(() => {
    const result = [];
    const now    = new Date();
    const mTotal = mEx.reduce((a, e) => a + e.amount, 0);

    // Last month
    const lmDate = new Date(now); lmDate.setMonth(lmDate.getMonth() - 1);
    const lmKey  = lmDate.toISOString().slice(0, 7);
    const lmEx   = state.expenses.filter(e => monthOf(e.date) === lmKey);
    const lmTotal = lmEx.reduce((a, e) => a + e.amount, 0);

    // Day of month + projection
    const dayOfMonth   = now.getDate();
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projected    = dayOfMonth > 0 ? Math.round((mTotal / dayOfMonth) * daysInMonth) : 0;

    // Weekend vs weekday spending
    const weekend = mEx.filter(e => { const d = new Date(e.date); return d.getDay() === 0 || d.getDay() === 6; });
    const weekday = mEx.filter(e => { const d = new Date(e.date); return d.getDay() > 0 && d.getDay() < 6; });
    const wkendDays = Math.max([...new Set(weekend.map(e => e.date))].length, 1);
    const wkdayDays = Math.max([...new Set(weekday.map(e => e.date))].length, 1);
    const wkendAvg  = weekend.reduce((a, e) => a + e.amount, 0) / wkendDays;
    const wkdayAvg  = weekday.reduce((a, e) => a + e.amount, 0) / wkdayDays;

    // Category trends
    const catTotals  = {};
    const catLMTotals= {};
    mEx.forEach(e  => { catTotals[e.category]   = (catTotals[e.category]  ||0) + e.amount; });
    lmEx.forEach(e => { catLMTotals[e.category] = (catLMTotals[e.category]||0) + e.amount; });

    // Income vs spend
    const totalIncome = (state.featEntries?.income||[])
      .filter(e => monthOf(e.date) === curMonth())
      .reduce((a, e) => a + (e.amount||0), 0);
    // Include bill split share in outflow for savings rate
    const mBillShare = (state.bills||[])
      .filter(b => monthOf(b.date) === curMonth())
      .reduce((a,b) => { const my = b.people.find(p=>p.name==='Me'); return a+(my?my.share:0); }, 0);
    const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - mTotal - mBillShare) / totalIncome) * 100) : null;

    // Goal progress
    const goals = state.featEntries?.goals || [];
    const nearGoals = goals.filter(g => {
      const saved = (g.contributions||[]).reduce((a,c)=>a+c.amount,0);
      const tgt   = g.targetAmount || g.amount || 0;
      return tgt > 0 && saved/tgt >= 0.8 && saved < tgt;
    });
    const achievedGoals = goals.filter(g => {
      const saved = (g.contributions||[]).reduce((a,c)=>a+c.amount,0);
      return saved >= (g.targetAmount || g.amount || 1);
    });

    // Streak — consecutive days with expenses
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      if (state.expenses.some(e => e.date === key)) streak++;
      else break;
    }

    // ── Generate insights (priority ordered) ─────────────────────────────────

    // 1. Overspent / good savings rate
    if (totalIncome > 0 && savingsRate !== null) {
      if (savingsRate < 0)
        result.push({ icon:'⚠️', title:'Overspent', text:`You've spent ${fmt(mTotal - totalIncome)} more than your ${fmt(totalIncome)} income this month.`, color:'#FF3B30', priority:1 });
      else if (savingsRate >= 30)
        result.push({ icon:'🌟', title:'Excellent savings', text:`You're saving ${savingsRate}% of your income (${fmt(totalIncome - mTotal)}). Keep it up!`, color:'#2ECC8A', priority:1 });
      else if (savingsRate > 0)
        result.push({ icon:'💰', title:'Savings rate', text:`You're saving ${savingsRate}% of your income this month — try to get to 30%.`, color:'#B985FA', priority:2 });
    }

    // 2. Month-on-month comparison
    if (lmTotal > 0) {
      const diff = Math.round(((mTotal - lmTotal) / lmTotal) * 100);
      if (diff <= -20)
        result.push({ icon:'🎉', title:'Great progress!', text:`Spending ${Math.abs(diff)}% less than last month. You saved ${fmt(lmTotal - mTotal)} extra!`, color:'#2ECC8A', priority:1 });
      else if (diff < 0)
        result.push({ icon:'👍', title:'Spending down', text:`${Math.abs(diff)}% less than last month (${fmt(lmTotal - mTotal)} saved). On a good track.`, color:'#4CAF50', priority:2 });
      else if (diff > 30)
        result.push({ icon:'📈', title:'High spending', text:`Up ${diff}% vs last month. You've spent ${fmt(mTotal - lmTotal)} more than last ${lmDate.toLocaleString('en-IN',{month:'long'})}.`, color:'#FF9800', priority:1 });
    }

    // 3. End-of-month projection
    if (dayOfMonth >= 7 && state.budget > 0 && projected > 0) {
      if (projected > state.budget * 1.1)
        result.push({ icon:'🔮', title:'Budget forecast', text:`At this rate you'll spend ${fmt(projected)} this month — ${fmt(projected - state.budget)} over your ${fmt(state.budget)} budget.`, color:'#FF6B6B', priority:2 });
      else if (projected < state.budget * 0.85)
        result.push({ icon:'✅', title:'On track', text:`Projected spend: ${fmt(projected)}. You're ${fmt(state.budget - projected)} under budget this month.`, color:'#2ECC8A', priority:2 });
    }

    // 4. Weekend vs weekday
    if (weekend.length >= 2 && weekday.length >= 2) {
      const wkRatio = Math.round((wkendAvg / Math.max(wkdayAvg, 1) - 1) * 100);
      if (wkRatio > 50)
        result.push({ icon:'🎭', title:'Weekend splurge', text:`You spend ${wkRatio}% more per day on weekends (${fmt(Math.round(wkendAvg))}) than weekdays (${fmt(Math.round(wkdayAvg))}).`, color:'#FF9800', priority:3 });
      else if (wkRatio < -20)
        result.push({ icon:'🏠', title:'Weekday spender', text:`Weekdays cost you ${fmt(Math.round(wkdayAvg))}/day vs ${fmt(Math.round(wkendAvg))}/day on weekends.`, color:'#2196F3', priority:3 });
    }

    // 5. Category that grew most vs last month
    const catGrowth = Object.entries(catTotals)
      .map(([cat, amt]) => ({ cat, amt, lm: catLMTotals[cat]||0, grow: catLMTotals[cat] ? Math.round(((amt-(catLMTotals[cat]))/catLMTotals[cat])*100) : null }))
      .filter(x => x.grow !== null && x.grow > 40 && x.lm > 500)
      .sort((a,b) => b.grow - a.grow);
    if (catGrowth.length > 0) {
      const g = catGrowth[0];
      const cat = CM[g.cat]??CM['Other'];
      result.push({ icon: cat.icon, title:`${g.cat} up ${g.grow}%`, text:`${g.cat} spending jumped ${g.grow}% vs last month (${fmt(g.lm)} → ${fmt(g.amt)}).`, color: cat.color, priority:2 });
    }

    // 6. Biggest single expense
    if (mEx.length > 0) {
      const biggest = [...mEx].sort((a,b) => b.amount - a.amount)[0];
      if (biggest.amount > mTotal * 0.25)
        result.push({ icon:'💸', title:'Largest expense', text:`"${biggest.title}" was your biggest spend at ${fmt(biggest.amount)} — ${Math.round(biggest.amount/mTotal*100)}% of this month's total.`, color:'#9C27B0', priority:3 });
    }

    // 7. Goals nearly complete
    if (nearGoals.length > 0) {
      const g = nearGoals[0];
      const saved = (g.contributions||[]).reduce((a,c)=>a+c.amount,0);
      const tgt = g.targetAmount||g.amount||0;
      result.push({ icon:'🎯', title:'Goal almost there!', text:`"${g.title}" is ${Math.round(saved/tgt*100)}% complete. Just ${fmt(tgt-saved)} more to go!`, color:'#E91E63', priority:1 });
    }

    // 8. Logging streak
    if (streak >= 7)
      result.push({ icon:'🔥', title:`${streak}-day streak!`, text:`You've logged expenses for ${streak} days in a row. Stay consistent!`, color:'#FF9800', priority:3 });

    // 9. Top category
    if (top[0] && result.length < 3) {
      const cat = CM[top[0][0]]??CM['Other'];
      result.push({ icon: cat.icon, title:'Top category', text:`${top[0][0]} is your biggest spend this month at ${fmt(top[0][1])} (${Math.round(top[0][1]/Math.max(mTotal,1)*100)}% of total).`, color: cat.color, priority:4 });
    }

    // 10. Default if nothing generated
    if (result.length === 0)
      result.push({ icon:'💡', title:'Getting started', text:'Add a few more expenses to unlock personalised financial insights.', color:'#B985FA', priority:5 });

    // ── 11. SPENDING VELOCITY ALERT ──────────────────────────────────────────
    if (dayOfMonth >= 5 && state.budget > 0 && mTotal > 0) {
      const expectedByNow = Math.round((state.budget / daysInMonth) * dayOfMonth);
      const velocity = Math.round((mTotal / expectedByNow) * 100);
      if (velocity >= 140) {
        const runOutDay = Math.round((state.budget / (mTotal / dayOfMonth)));
        result.push({ icon:'🚨', title:'Spending too fast!', text:`You're spending at ${velocity}% of your budget rate. At this pace you'll hit your limit by the ${runOutDay}th.`, color:'#FF3B30', priority:1 });
      } else if (velocity >= 120) {
        result.push({ icon:'⚡', title:'Spending fast', text:`You're ${velocity - 100}% ahead of your ideal daily rate. Slow down a bit to stay within your ${fmt(state.budget)} budget.`, color:'#FF9800', priority:2 });
      } else if (velocity <= 70 && dayOfMonth >= 10) {
        result.push({ icon:'🐢', title:'Well under budget', text:`Only at ${velocity}% of your expected spend rate. You're ${fmt(expectedByNow - mTotal)} ahead of schedule.`, color:'#2ECC8A', priority:3 });
      }
    }

    // ── 12. CATEGORY ANOMALY DETECTION ───────────────────────────────────────
    // Compare this month's daily average per category vs 3-month average
    const m1Key = (() => { const d=new Date(now); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })();
    const m2Key = (() => { const d=new Date(now); d.setMonth(d.getMonth()-2); return d.toISOString().slice(0,7); })();
    const m3Key = (() => { const d=new Date(now); d.setMonth(d.getMonth()-3); return d.toISOString().slice(0,7); })();
    const historicEx = state.expenses.filter(e => [m1Key,m2Key,m3Key].includes(monthOf(e.date)));
    if (historicEx.length >= 10) {
      const histCatAvg = {};
      CATS.forEach(cat => {
        const catHist = historicEx.filter(e => e.category === cat.name);
        histCatAvg[cat.name] = catHist.reduce((a,e)=>a+e.amount,0) / 3; // monthly avg
      });
      const anomalies = CATS.map(cat => {
        const thisMonthAmt = mEx.filter(e=>e.category===cat.name).reduce((a,e)=>a+e.amount,0);
        const avgAmt = histCatAvg[cat.name] || 0;
        if (avgAmt < 200 || thisMonthAmt < 200) return null;
        const ratio = thisMonthAmt / avgAmt;
        if (ratio >= 1.8) return { cat, thisMonthAmt, avgAmt, ratio };
        return null;
      }).filter(Boolean).sort((a,b)=>b.ratio-a.ratio);
      if (anomalies.length > 0) {
        const a = anomalies[0];
        const catInfo = CM[a.cat.name]??CM['Other'];
        result.push({ icon: catInfo.icon, title:`Unusual ${a.cat.name} spend`, text:`${a.cat.name} is ${Math.round(a.ratio*100-100)}% above your 3-month average (${fmt(Math.round(a.avgAmt))}/mo → ${fmt(Math.round(a.thisMonthAmt))} this month). Check for errors.`, color: catInfo.color, priority:1 });
      }
    }

    // ── 13. SMART BUDGET SUGGESTION ──────────────────────────────────────────
    const threeMonthAvg = (() => {
      const totals = [m1Key,m2Key,m3Key].map(mk => state.expenses.filter(e=>monthOf(e.date)===mk).reduce((a,e)=>a+e.amount,0));
      const nonZero = totals.filter(t=>t>0);
      return nonZero.length > 0 ? Math.round(nonZero.reduce((a,t)=>a+t,0)/nonZero.length) : 0;
    })();
    if (threeMonthAvg > 0 && state.budget > 0) {
      const suggested = Math.round(threeMonthAvg * 1.05 / 500) * 500; // round to nearest 500
      const diff = Math.abs(suggested - state.budget);
      if (diff >= 1000) {
        result.push({ icon:'🧠', title:'Budget suggestion', text:`Your 3-month average spend is ${fmt(threeMonthAvg)}. A budget of ${fmt(suggested)} (5% buffer) would suit your habits better than your current ${fmt(state.budget)}.`, color:'#B985FA', priority:4 });
      }
    }

    // ── 14. BILL SPLIT REMINDER ──────────────────────────────────────────────
    const unseasonedBills = (state.bills||[]).filter(b => {
      const daysSince = (new Date(todayStr()) - new Date(b.date)) / 86400000;
      return daysSince >= 7 && !b.fullySettled && b.payer === 'Me';
    });
    if (unseasonedBills.length > 0) {
      const bill = unseasonedBills[0];
      const unsettled = bill.people.filter(p=>p.name!=='Me'&&!p.settled);
      const owedAmt   = unsettled.reduce((a,p)=>a+p.share,0);
      result.push({ icon:'💰', title:'Pending settlement', text:`${unsettled.map(p=>p.name).join(', ')} still owe you ${fmt(owedAmt)} from "${bill.title}" — ${Math.floor((new Date(todayStr())-new Date(bill.date))/86400000)} days ago.`, color:'#00BCD4', priority:2 });
    }

    // ── 15. WEEKLY DIGEST (shown on Mondays or if >7 days of data) ───────────
    const dayOfWeek = now.getDay(); // 1 = Monday
    const last7 = state.expenses.filter(e => {
      const d = new Date(e.date);
      return (new Date(todayStr()) - d) / 86400000 <= 7;
    });
    if (last7.length >= 3) {
      const last7Total = last7.reduce((a,e)=>a+e.amount,0);
      const last7Days  = [...new Set(last7.map(e=>e.date))].length;
      const prev7 = state.expenses.filter(e => {
        const days = (new Date(todayStr()) - new Date(e.date)) / 86400000;
        return days > 7 && days <= 14;
      });
      const prev7Total = prev7.reduce((a,e)=>a+e.amount,0);
      const weekChange = prev7Total > 0 ? Math.round(((last7Total-prev7Total)/prev7Total)*100) : null;
      const topCat = Object.entries(last7.reduce((a,e)=>{a[e.category]=(a[e.category]||0)+e.amount;return a;},{})).sort((a,b)=>b[1]-a[1])[0];
      result.push({
        icon:'📅',
        title:'This week',
        text:`Spent ${fmt(last7Total)} over ${last7.length} transactions in ${last7Days} days.${topCat?' Top: '+topCat[0]+' ('+fmt(topCat[1])+').':''}${weekChange!==null?' '+(weekChange>0?'↑'+weekChange+'% vs last week.':'↓'+Math.abs(weekChange)+'% vs last week.'):''}  `,
        color:'#3F51B5',
        priority:3
      });
    }

    // ── 16. MERCHANT PATTERN DETECTION ───────────────────────────────────────
    const merchantCount = {};
    mEx.forEach(e => {
      const key = e.title.toLowerCase().trim();
      merchantCount[key] = (merchantCount[key]||0) + 1;
    });
    const topMerchant = Object.entries(merchantCount).sort((a,b)=>b[1]-a[1])[0];
    if (topMerchant && topMerchant[1] >= 3) {
      const merchantAmt = mEx.filter(e=>e.title.toLowerCase().trim()===topMerchant[0]).reduce((a,e)=>a+e.amount,0);
      result.push({ icon:'🏪', title:'Frequent merchant', text:'You visited "' + topMerchant[0] + '" ' + topMerchant[1] + ' times this month, spending ' + fmt(merchantAmt) + ' total.', color:'#FF9800', priority:3 });
    }

    // ── 17. BUSIEST SPENDING DAY OF WEEK ─────────────────────────────────────
    const dayGroups = {};
    mEx.forEach(e => { dayGroups[e.date] = (dayGroups[e.date]||0) + 1; });
    const busyDays = Object.entries(dayGroups).filter(([,v])=>v>=3);
    if (busyDays.length >= 2) {
      const dayNums = busyDays.map(([d])=>new Date(d).getDay());
      const dayNames2 = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const commonDay = dayNums.reduce((a,b,i,arr)=>arr.filter(v=>v===b).length>=arr.filter(v=>v===a).length?b:a,dayNums[0]);
      result.push({ icon:'📆', title:'Busy spending day', text:'Your heaviest spending tends to happen on ' + dayNames2[commonDay] + 's. You had ' + busyDays.length + ' high-spend days this month.', color:'#9C27B0', priority:4 });
    }

    // ── 18. PAYDAY AWARENESS ─────────────────────────────────────────────────
    const incomeEntries2 = (state.featEntries?.income||[]).sort((a,b)=>a.date.localeCompare(b.date));
    if (incomeEntries2.length >= 2) {
      const lastPayday = new Date(incomeEntries2[incomeEntries2.length-1].date).getDate();
      const today2 = now.getDate();
      const daysUntilPay = lastPayday > today2 ? lastPayday - today2 : (daysInMonth - today2) + lastPayday;
      if (daysUntilPay <= 7 && daysUntilPay > 0) {
        const dailyRate = dayOfMonth > 0 ? Math.round(mTotal/dayOfMonth) : 0;
        const projRem = Math.max((state.budget||0) - mTotal, 0);
        result.push({ icon:'💳', title:'Payday in ' + daysUntilPay + ' days', text:'Spending ~' + fmt(dailyRate) + '/day. With ' + fmt(projRem) + ' remaining, you\'ll have ~' + fmt(Math.max(projRem - dailyRate*daysUntilPay,0)) + ' left by payday.', color:'#2ECC8A', priority:2 });
      }
    }

    // ── 19. MOST IMPROVED CATEGORY ───────────────────────────────────────────
    const mostImproved = Object.entries(catTotals)
      .map(([cat,amt])=>({ cat, amt, lm: catLMTotals[cat]||0 }))
      .filter(x=>x.lm>200 && x.amt < x.lm * 0.7)
      .sort((a,b)=>(a.amt/Math.max(a.lm,1))-(b.amt/Math.max(b.lm,1)))[0];
    if (mostImproved) {
      const catInfo2 = CM[mostImproved.cat]??CM['Other'];
      result.push({ icon:catInfo2.icon, title:mostImproved.cat + ' improved!', text:'You spent ' + fmt(mostImproved.lm - mostImproved.amt) + ' less on ' + mostImproved.cat + ' vs last month (' + fmt(mostImproved.lm) + ' to ' + fmt(mostImproved.amt) + '). Great discipline!', color:'#2ECC8A', priority:2 });
    }

    // ── 20. DAILY ROTATING TIP (changes every day) ───────────────────────────
    const TIPS = [
      { icon:'💡', title:'Financial tip', text:'The 50/30/20 rule: 50% needs, 30% wants, 20% savings. Track your split in the Income tab.', color:'#B985FA' },
      { icon:'📱', title:'Subscription audit', text:'The average person forgets 2-3 active subscriptions. Review yours in Settings today.', color:'#673AB7' },
      { icon:'🎯', title:'Goal strategy', text:'Automating savings on payday before spending is more effective than saving what is left over.', color:'#E91E63' },
      { icon:'🛒', title:'Smart shopping', text:'Shopping with a list reduces impulse purchases by up to 23%. Try it this weekend.', color:'#4CAF50' },
      { icon:'📊', title:'Track everything', text:'People who log every expense save 15 to 20 percent more on average than those who do not.', color:'#2196F3' },
      { icon:'💰', title:'Emergency fund', text:'Aim for 3 to 6 months of expenses as an emergency fund. Check your remaining balance today.', color:'#FF9800' },
      { icon:'🔄', title:'Weekly review', text:'A 5-minute weekly money review can save thousands annually by catching small spending leaks early.', color:'#00BCD4' },
    ];
    result.push({ ...TIPS[now.getDate() % TIPS.length], priority:5 });

    // Sort by priority and return top 8 (increased from 5)
    const sorted = result.sort((a,b) => a.priority - b.priority).slice(0,8);
    // Save snapshot (will be called by parent)
    return sorted;
  }, [state.expenses, state.budget, state.featEntries, state.bills, mEx.length]);

  useEffect(() => {
    if (insights.length > 0 && onSaveInsights) onSaveInsights(insights);
  }, [insights.length]);

  const handleBbl = i => {
    if (collapsed) { setCollapsed(false); return; }
    if (selBbl === i) { setSelBbl(-1); return; }
    setSelBbl(i);
    setSheetCat(CATS[i]);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Glass/Dark theme aurora blobs */}
      {(T.glass || T.dark) && (
        <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, overflow:'hidden' }} pointerEvents="none">
          <Animated.View style={{
            position:'absolute', width:340, height:340, borderRadius:170,
            backgroundColor: T.dark ? 'rgba(124,58,237,0.18)' : 'rgba(103,80,164,0.22)',
            top:-100, left:-80,
            transform: breathAnim ? [{ scale: breathAnim.interpolate({ inputRange:[0,1], outputRange:[1,1.12] }) }] : [],
          }} />
          <Animated.View style={{
            position:'absolute', width:260, height:260, borderRadius:130,
            backgroundColor: T.dark ? 'rgba(168,85,247,0.1)' : 'rgba(0,188,212,0.1)',
            bottom:120, right:-60,
            transform: breathAnim ? [{ scale: breathAnim.interpolate({ inputRange:[0,1], outputRange:[1,0.88] }) }] : [],
          }} />
          <Animated.View style={{
            position:'absolute', width:180, height:180, borderRadius:90,
            backgroundColor:'rgba(233,30,99,0.06)',
            top:'38%', left:'25%',
            transform: breathAnim ? [{ scale: breathAnim.interpolate({ inputRange:[0,1], outputRange:[0.9,1.1] }) }] : [],
          }} />
        </View>
      )}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View style={[styles.headerRow, aS(headerAnim)]}>
          <View>
            <Text style={[styles.greet, { color: T.sub }]}>Good morning,</Text>
            <Text style={[styles.name, { color: T.text },
              T.white && { fontStyle:'italic', fontSize:22 },
              T.dark  && { color:'#E5E5E5' },
            ]}>Celestial {T.white ? '✦' : T.dark ? '✦' : '✨'}</Text>
          </View>
          <TouchableOpacity onPress={onQuickAdd} style={[styles.avatar, { backgroundColor: T.grad1 }]}>
            <Text style={{ fontSize: 18 }}>⚡</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Card */}
        <Animated.View style={[{ marginHorizontal: 16, marginBottom: 12 }, aS(cardAnim)]}>
          {/* Glass breathing glow — Android-compatible: animates elevation + opacity of glow layer */}
          {T.glass && breathAnim && (
            <Animated.View style={{
              position:'absolute', top:-8, left:-8, right:-8, bottom:-8,
              borderRadius: 34,
              backgroundColor: '#B985FA',
              opacity: breathAnim.interpolate({ inputRange:[0,1], outputRange:[0.08, 0.28] }),
              transform: [{ scale: breathAnim.interpolate({ inputRange:[0,1], outputRange:[1, 1.025] }) }],
            }} pointerEvents="none" />
          )}
          <View style={T.glass ? {
            borderRadius: 28,
            backgroundColor: 'rgba(255,255,255,0)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.13)',
            overflow: 'hidden',
            elevation: 12,
          } : T.white ? {
            borderRadius: 28,
            backgroundColor: T.card,
            overflow: 'hidden',
            elevation: 8,
            shadowColor: '#6750A4',
            shadowOpacity: 0.45,
            shadowRadius: 20,
            shadowOffset: { width: 6, height: 10 },
          } : T.dark ? {
            borderRadius: 28,
            backgroundColor: T.card,
            overflow: 'hidden',
            elevation: 12,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderBottomWidth: 1,
            borderRightWidth: 1,
            borderTopColor: 'rgba(168,85,247,0.2)',
            borderLeftColor: 'rgba(168,85,247,0.1)',
            borderBottomColor: 'rgba(0,0,0,1)',
            borderRightColor: 'rgba(0,0,0,0.8)',
          } : styles.card}>
            {/* Glass: gradient background layers */}
            {T.glass && (
              <>
                <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:28,
                  backgroundColor: 'rgba(103,80,164,0.18)' }} />
                <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:28,
                  backgroundColor: 'rgba(255,255,255,0.04)' }} />
                {/* Top edge light refraction */}
                <View style={{ position:'absolute', top:0, left:0, right:0, height:1, borderRadius:28,
                  backgroundColor: 'rgba(255,255,255,0.35)' }} />
                {/* Shimmer sweep — static diagonal highlight */}
                <View style={{ position:'absolute', top:0, bottom:0, left:0, width:'45%',
                  backgroundColor: 'rgba(255,255,255,0.03)', borderRadius:28 }} />
              </>
            )}
            {/* Default/amoled theme: use original card bg */}
            {!T.glass && !T.white && !T.dark && <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0,
              backgroundColor: T.card, borderRadius: (styles.card||{}).borderRadius }} />}
            {/* Floating coins when income logged this month */}
            {(state.featEntries?.income || []).some(e => monthOf(e.date) === curMonth()) && (
              <View style={{ position:'absolute', top:-12, right:-8, width:80, height:80, zIndex:10 }} pointerEvents="none">
                <LottieView source={require('./lottie-coins.json')} autoPlay loop style={{ width:80, height:80 }} speed={0.7} />
              </View>
            )}
            <View style={{ position:'relative', zIndex:1, padding: (T.glass || T.white || T.dark) ? 20 : 0 }}>
              <Text style={[styles.cardLabel,
                T.glass && { color:'rgba(255,255,255,0.55)', fontSize:10, letterSpacing:0.5 },
                (T.white || T.dark) && { color:'rgba(255,255,255,0.65)', fontSize:10, letterSpacing:0.5 },
              ]}>
                Total Spent — {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
              </Text>
              <CountUp value={spent} style={[styles.cardAmt,
                T.glass && { textShadowColor:'rgba(185,133,250,0.4)', textShadowRadius:12 },
                T.dark  && { textShadowColor:'rgba(168,85,247,0.4)',  textShadowRadius:12 },
                T.white && { color:'#fff' },
              ]} />
              <View style={styles.cardRow}>
                {[['Budget', state.budget], ['Remaining', Math.max(state.budget - spent, 0)]].map(([l, v]) => (
                  <View key={l} style={[styles.cardPill,
                    T.glass && { backgroundColor:'rgba(255,255,255,0.09)', borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
                    T.white && { backgroundColor:'rgba(255,255,255,0.18)', borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
                    T.dark  && { backgroundColor:'rgba(255,255,255,0.1)',  borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
                  ]}>
                    <Text style={styles.cardPillLbl}>{l}</Text>
                    <CountUp value={v} style={styles.cardPillVal} />
                  </View>
                ))}
              </View>
              <LiquidBudgetBar pct={pct} animLevel={animLevel} />
              <Text style={[styles.cardPct, (T.white||T.dark||T.glass) && { color:'rgba(255,255,255,0.5)' }]}>
                {pct}% of monthly budget used
              </Text>
            </View>
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

        {/* Smart Insights — collapsible + horizontal swipeable cards */}
        {insights.length > 0 && (
          <View style={{ marginBottom: 4 }}>
            <TouchableOpacity
              onPress={() => setInsightsCollapsed(p => !p)}
              style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, marginBottom: insightsCollapsed ? 0 : 8 }}
              activeOpacity={0.7}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <Text style={[styles.secTitle, { color: T.text }]}>💡 Insights</Text>
                <View style={{ backgroundColor: T.accent+'28', borderRadius:99, paddingHorizontal:8, paddingVertical:2 }}>
                  <Text style={{ color:T.accent, fontSize:10, fontWeight:'700' }}>{insights.length}</Text>
                </View>
              </View>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                {!insightsCollapsed && <Text style={{ color: T.sub, fontSize: 10 }}>Swipe for more</Text>}
                <View style={{ backgroundColor:T.surface, borderRadius:99, width:26, height:26, alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ color:T.sub, fontSize:12 }}>{insightsCollapsed ? '▼' : '▲'}</Text>
                </View>
              </View>
            </TouchableOpacity>
            {!insightsCollapsed && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal:16, gap:10 }}
                decelerationRate="fast" snapToInterval={SW - 52}
                snapToAlignment="start">
                {insights.map((ins, i) => (
                  <View key={i} style={{
                    width: SW - 64, borderRadius: 18, padding: 16,
                    backgroundColor: T.white ? '#fff' : ins.color + '15',
                    borderWidth: 1.5, borderColor: ins.color + '40',
                    shadowColor: ins.color, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
                  }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:8 }}>
                      <View style={{ width:38, height:38, borderRadius:12, backgroundColor: ins.color+'28', alignItems:'center', justifyContent:'center' }}>
                        <Text style={{ fontSize:20 }}>{ins.icon}</Text>
                      </View>
                      <Text style={{ color: ins.color, fontSize:13, fontWeight:'800', flex:1 }}>{ins.title}</Text>
                      <Text style={{ color: T.sub, fontSize:10 }}>{i+1}/{insights.length}</Text>
                    </View>
                    <Text style={{ color: T.text, fontSize:12.5, lineHeight:19 }}>{ins.text}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
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
                    ? <View style={styles.emptyBox}>
      <LottieView source={require('./lottie-shapes.json')} autoPlay loop style={{ width:110, height:110 }} speed={0.7} colorFilters={[{keypath:'**',color:'#B985FA'}]} />
      <Text style={[styles.emptyTitle, { color: T.sub }]}>No expenses yet</Text>
      <Text style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>Tap ➕ to add your first</Text>
    </View>
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
                          <TouchableOpacity
                            onPress={() => onDelete ? onDelete(e.id) : dispatch({ type: 'DELETE', id: e.id })}
                            style={{ marginLeft: 4, backgroundColor: 'rgba(255,107,107,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <Text style={{ color: '#FF6B6B', fontSize: 11, fontWeight: '700' }}>Del</Text>
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
    <Modal transparent visible animationType="none" onRequestClose={() => close()}>
      {/* Dim backdrop — tap outside to close */}
      <Animated.View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.65)', opacity:opAnim }}
        pointerEvents="none" />
      <TouchableOpacity
        style={{ position:'absolute', top:0, left:0, right:0, bottom:0 }}
        onPress={() => close()} activeOpacity={1} />
      {/* Animated card wrapper — centred */}
      <Animated.View style={{
        position:'absolute', top:0, left:0, right:0, bottom:0,
        alignItems:'center', justifyContent:'center', padding:24,
        transform:[{ scale:scaleAnim },{ translateY:slideY }], opacity:opAnim,
      }}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={{ width:'100%', maxWidth:360, borderRadius:24, padding:22,
            borderWidth:1.5, borderColor:color+'55', overflow:'hidden' }}>
            {/* Glass layers */}
            <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#13111A', borderRadius:24 }} />
            <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:color, opacity:0.09, borderRadius:24 }} />
            {/* Content */}
            <TouchableOpacity onPress={() => close()} hitSlop={{ top:12, right:12, bottom:12, left:12 }}
              style={{ position:'absolute', top:14, right:14, width:36, height:36, borderRadius:18,
                backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center', zIndex:20 }}>
              <Text style={{ color:'#fff', fontSize:16, fontWeight:'700' }}>✕</Text>
            </TouchableOpacity>
            <Text style={{ color:color, fontSize:17, fontWeight:'800', marginBottom:3 }}>{entry.subType}</Text>
            <Text style={{ color:'rgba(255,255,255,0.45)', fontSize:11, marginBottom:18 }}>{dispDate(entry.date)}</Text>
            <View style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:14, padding:14, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, marginBottom:12 }}>
              <Text style={{ color:color, fontSize:22, fontWeight:'300' }}>₹</Text>
              <TextInput value={amount} onChangeText={t => setAmount(t.replace(/[^0-9.]/g,''))}
                keyboardType="decimal-pad" placeholderTextColor="rgba(255,255,255,0.25)"
                style={{ color:'#fff', fontSize:32, fontWeight:'800', letterSpacing:-1, minWidth:100, textAlign:'center' }} />
            </View>
            <TextInput value={title} onChangeText={setTitle}
              placeholderTextColor="rgba(255,255,255,0.3)" placeholder="Title"
              style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:12, padding:12, color:'#fff', fontSize:14, marginBottom:10 }} />
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:10 }}>
              {subTypes.map(s => (
                <TouchableOpacity key={s} onPress={() => setSubType(s)}
                  style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:99,
                    backgroundColor:subType===s ? color+'33' : 'rgba(255,255,255,0.07)',
                    borderWidth:1.5, borderColor:subType===s ? color : 'rgba(255,255,255,0.12)' }}>
                  <Text style={{ color:subType===s ? color : 'rgba(255,255,255,0.55)', fontSize:11, fontWeight:subType===s?'700':'400' }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput value={note} onChangeText={setNote}
              placeholderTextColor="rgba(255,255,255,0.3)" placeholder="Note (optional)"
              style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:12, padding:12, color:'#fff', fontSize:13, marginBottom:18 }} />
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
        </TouchableWithoutFeedback>
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
  const scaleAnims = useRef([]).current;
  const key = data.map(d=>d.name).join(',');

  // Ensure we always have exactly data.length Animated.Values
  while (scaleAnims.length < data.length) scaleAnims.push(new Animated.Value(0));
  while (scaleAnims.length > data.length) scaleAnims.pop();

  useEffect(() => {
    scaleAnims.forEach(a => a.setValue(0));
    Animated.stagger(90, scaleAnims.map(a =>
      Animated.spring(a, { toValue:1, tension:28, friction:12, useNativeDriver:true })
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
        const sc     = scaleAnims[i] ? scaleAnims[i].interpolate({ inputRange:[0,0.5,1], outputRange:[0, isSel?1.1:1.06, isSel?1.06:1] }) : 1;
        const op     = scaleAnims[i] ? scaleAnims[i].interpolate({ inputRange:[0,0.4,1], outputRange:[0,1, isDim?0.3:1] }) : 1;
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



// ─── GOAL ACHIEVED BADGE (animated) ──────────────────────────────────────────
function GoalAchievedBadge({ isEmi, T }) {
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;
  const sparkAnims = useRef(Array.from({ length: 8 }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    op: new Animated.Value(0),
    sc: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    // Pulse the badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();

    // Glow fade in
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    // Spark particles shoot out in 8 directions
    const ANGLES = Array.from({ length: 8 }, (_, i) => (i * Math.PI * 2) / 8);
    const DIST = 36;

    sparkAnims.forEach((spark, i) => {
      const angle = ANGLES[i];
      const tx = Math.cos(angle) * DIST;
      const ty = Math.sin(angle) * DIST;
      const delay = i * 80;

      const shoot = () => {
        spark.x.setValue(0); spark.y.setValue(0);
        spark.op.setValue(0); spark.sc.setValue(0);
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(spark.op, { toValue: 1,   duration: 200, useNativeDriver: true }),
            Animated.timing(spark.sc, { toValue: 1,   duration: 200, useNativeDriver: true }),
            Animated.timing(spark.x,  { toValue: tx,  duration: 600, useNativeDriver: true }),
            Animated.timing(spark.y,  { toValue: ty,  duration: 600, useNativeDriver: true }),
          ]),
          Animated.timing(spark.op, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setTimeout(shoot, 1400 + delay));
      };
      shoot();
    });
  }, []);

  const SPARK_COLORS = ['#FFD700','#FF6B6B','#2ECC8A','#B985FA','#00BCD4','#FF9800','#fff','#E91E63'];

  return (
    <View style={{ marginBottom: 12 }}>
      {/* Lottie trophy + confetti */}
      <View style={{ alignItems: 'center', height: 160, marginBottom: -20 }}>
        <LottieView
          source={require('./lottie-trophy.json')}
          autoPlay loop={false}
          style={{ width: 200, height: 200 }}
          speed={0.8}
        />
      </View>
      {/* Badge below */}
      <Animated.View style={{ transform:[{ scale:pulseAnim }] }}>
        <Animated.View style={{
          position:'absolute', top:-6, left:-6, right:-6, bottom:-6,
          borderRadius: 18, backgroundColor:'#2ECC8A', opacity: glowAnim,
        }} />
        <View style={{ backgroundColor:'#2ECC8A', borderRadius:14, padding:12,
          flexDirection:'row', alignItems:'center', gap:10,
          shadowColor:'#2ECC8A', shadowOpacity:0.7, shadowRadius:14, elevation:10 }}>
          <Text style={{ fontSize: 22 }}>{isEmi ? '🏦' : '🎉'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color:'#fff', fontSize:14, fontWeight:'800' }}>
              {isEmi ? 'Loan fully cleared!' : 'Goal achieved!'}
            </Text>
            <Text style={{ color:'rgba(255,255,255,0.75)', fontSize:11, marginTop:1 }}>
              {isEmi ? 'Congratulations on paying off!' : 'Amazing work! You did it!'}
            </Text>
          </View>
          <Text style={{ fontSize: 20 }}>✨</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── GOAL CARD (for Goals + EMI in StatsScreen) ───────────────────────────────
function GoalCard({ feat, entry, dispatch, T, onContribute }) {
  const color  = FEAT_COLORS[feat.id] || feat.color;
  const target = entry.targetAmount || entry.amount || 1;
  const saved  = (entry.contributions||[]).reduce((a,c) => a+c.amount, 0);
  const pct    = target > 0 ? Math.min(Math.round(saved / target * 100), 100) : 0;
  const achieved = target > 0 && saved >= target;
  const rem    = Math.max(target - saved, 0);
  const [showList, setShowList] = useState(false);

  return (
    <View style={{ backgroundColor: T.surface, borderRadius: 18, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: color }}>
      {achieved && <GoalAchievedBadge isEmi={feat.id === 'emi'} T={T} />}
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
        <Text style={{ color: T.sub }}>{feat.id === 'emi' ? 'of' : 'goal'} {fmt(target)}</Text>
      </View>
      {!achieved && (() => {
        // Smart projection: based on contribution history
        const contribList = entry.contributions || [];
        if (contribList.length >= 2) {
          const sorted = [...contribList].sort((a,b)=>a.date.localeCompare(b.date));
          const firstDate = new Date(sorted[0].date);
          const lastDate  = new Date(sorted[sorted.length-1].date);
          const daysPassed = Math.max((lastDate - firstDate) / 86400000, 1);
          const avgPerDay  = contribList.reduce((a,cn)=>a+cn.amount,0) / daysPassed;
          if (avgPerDay > 0) {
            const daysLeft = Math.ceil(rem / avgPerDay);
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + daysLeft);
            const monthsLeft = Math.round(daysLeft / 30);
            return (
              <View style={{ backgroundColor: color+'15', borderRadius:10, padding:8, marginBottom:10 }}>
                <Text style={{ color:color, fontSize:11, fontWeight:'600' }}>
                  📅 At your current pace — done in {monthsLeft < 1 ? 'less than a month' : monthsLeft === 1 ? '~1 month' : `~${monthsLeft} months`} ({targetDate.toLocaleDateString('en-IN',{month:'short',year:'numeric'})})
                </Text>
              </View>
            );
          }
        }
        return <Text style={{ color: T.sub, fontSize: 11, marginBottom: 10 }}>{fmt(rem)} {feat.id === 'emi' ? 'left to clear' : 'to go'}</Text>;
      })()}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity onPress={() => onContribute && onContribute(entry)}
          style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: color, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{feat.id === 'emi' ? '💸 Make Payment' : '💰 Add Money'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowList(p => !p)}
          style={{ padding: 12, borderRadius: 12, backgroundColor: T.surface2, alignItems: 'center', paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 16 }}>📋</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => dispatch({ type: 'DELETE_FEAT', fid: feat.id, id: entry.id })}
          style={{ padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,107,107,0.12)', alignItems: 'center', paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 13 }}>🗑️</Text>
        </TouchableOpacity>
      </View>
      {showList && (
        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8 }}>
          {(entry.contributions||[]).length === 0
            ? <Text style={{ color: T.sub, fontSize: 12, textAlign: 'center' }}>No entries yet</Text>
            : (entry.contributions||[]).slice().reverse().map(cn => (
              <View key={cn.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: T.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.sub, fontSize: 12 }}>{dispDate(cn.date)}{cn.note ? ' · '+cn.note : ''}</Text>
                </View>
                <Text style={{ fontWeight: '700', color: color, marginRight: 10 }}>+{fmt(cn.amount)}</Text>
                <TouchableOpacity onPress={() => dispatch({ type: 'DELETE_CONTRIBUTION', fid: feat.id, entryId: entry.id, contribId: cn.id })}
                  style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,107,107,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FF6B6B', fontSize: 12 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          }
        </View>
      )}

    </View>
  );
}

// ─── GOAL CONTRIBUTE SHEET ────────────────────────────────────────────────────
function GoalContributeSheet({ entry, feat, dispatch, T, onClose }) {
  const color    = FEAT_COLORS[feat.id] || feat.color;
  const contribs = (entry.contributions||[]).reduce((a,c) => a+c.amount, 0);
  const target   = entry.targetAmount || entry.amount || 0;
  const rem      = Math.max(target - contribs, 0);
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
              <Text style={{ color: color, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{target > 0 ? fmt(rem) : 'Set a target first'}</Text>
            </View>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 320 }}>
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
              <View style={{ height: 320 }} />
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


// ─── SAVED INSIGHTS VIEW (collapsible sections) ───────────────────────────────
function SavedInsightsView({ savedInsights, dispatch, T }) {
  const now = new Date();
  const wk  = now.getFullYear() + '-W' + String(Math.ceil(now.getDate()/7)).padStart(2,'0') + '-' + String(now.getMonth()+1).padStart(2,'0');
  const mk  = now.toISOString().slice(0,7);
  const qk  = now.getFullYear() + '-Q' + Math.ceil((now.getMonth()+1)/3);
  const yk  = String(now.getFullYear());

  const saved = savedInsights || [];
  const sections = [
    { key:'week',    label:'This Week',    icon:'📅', items: saved.filter(s => s.weekKey    === wk) },
    { key:'month',   label:'This Month',   icon:'📆', items: saved.filter(s => s.monthKey   === mk) },
    { key:'quarter', label:'This Quarter', icon:'🗓️', items: saved.filter(s => s.quarterKey === qk) },
    { key:'year',    label:'This Year',    icon:'📊', items: saved.filter(s => s.yearKey    === yk) },
  ];

  // Deduplicate by title+savedAt
  const dedup = arr => {
    const seen = new Set();
    return arr.filter(i => { const k = i.title + i.savedAt; if (seen.has(k)) return false; seen.add(k); return true; });
  };

  // Collapsed state per section
  const [collapsed, setCollapsed] = useState({ week:false, month:false, quarter:true, year:true });
  const toggle = key => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  if (saved.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={{ fontSize:40, marginBottom:12 }}>💡</Text>
        <Text style={[styles.emptyTitle,{color:T.text}]}>No saved insights yet</Text>
        <Text style={{color:T.sub,fontSize:12,marginTop:6,textAlign:'center'}}>Insights save automatically each day you open the app</Text>
      </View>
    );
  }

  return (
    <View>
      {sections.map(sec => {
        const items = dedup(sec.items);
        if (items.length === 0) return null;
        const isCollapsed = collapsed[sec.key];
        return (
          <View key={sec.key} style={{ marginBottom: 8 }}>
            {/* Section header — tap to collapse/expand */}
            <TouchableOpacity
              onPress={() => toggle(sec.key)}
              activeOpacity={0.7}
              style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                paddingVertical:10, paddingHorizontal:4, marginBottom: isCollapsed ? 0 : 8 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <Text style={{ fontSize:16 }}>{sec.icon}</Text>
                <Text style={[styles.secTitle,{color:T.text}]}>{sec.label}</Text>
                <View style={{ backgroundColor:'rgba(185,133,250,0.2)', borderRadius:99, paddingHorizontal:8, paddingVertical:2 }}>
                  <Text style={{ color:'#B985FA', fontSize:10, fontWeight:'700' }}>{items.length}</Text>
                </View>
              </View>
              <View style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:99, width:26, height:26, alignItems:'center', justifyContent:'center' }}>
                <Text style={{ color:'rgba(255,255,255,0.4)', fontSize:11 }}>{isCollapsed ? '▼' : '▲'}</Text>
              </View>
            </TouchableOpacity>
            {/* Cards — hidden when collapsed */}
            {!isCollapsed && items.map((ins, i) => (
              <View key={i} style={{ borderRadius:16, padding:14, marginBottom:8,
                backgroundColor: T.white ? '#fff' : ins.color + '15', borderWidth:1.5, borderColor:ins.color+'40' }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:6 }}>
                  <View style={{ width:34,height:34,borderRadius:11,backgroundColor:ins.color+'28',alignItems:'center',justifyContent:'center' }}>
                    <Text style={{ fontSize:18 }}>{ins.icon}</Text>
                  </View>
                  <Text style={{ color:ins.color, fontSize:13, fontWeight:'800', flex:1 }}>{ins.title}</Text>
                  <Text style={{ color:'rgba(255,255,255,0.35)', fontSize:10 }}>{ins.savedAt}</Text>
                </View>
                <Text style={{ color:T.text, fontSize:12, lineHeight:18 }}>{ins.text}</Text>
              </View>
            ))}
          </View>
        );
      })}
      <TouchableOpacity onPress={() => dispatch({type:'CLEAR_INSIGHTS'})}
        style={{ marginTop:8,padding:14,borderRadius:14,backgroundColor:'rgba(255,107,107,0.1)',
          alignItems:'center',borderWidth:1,borderColor:'rgba(255,107,107,0.25)' }}>
        <Text style={{color:'#FF6B6B',fontSize:13,fontWeight:'700'}}>Clear All Saved Insights</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── STATS SCREEN ─────────────────────────────────────────────────────────────
function StatsScreen({ expenses, featEntries, bills, savedInsights, dispatch, T, animLevel, selCat, setSelCat, onEditExpense }) {
  const allM = [...new Set(expenses.map(e => monthOf(e.date)))].sort().reverse();
  const [selM,        setSelM]        = useState(curMonth());
  const [view,        setView]        = useState('Monthly');
  const [trendOpen,   setTrendOpen]   = useState(false);
  const [trendMonth,  setTrendMonth]  = useState(null);
  const [pieExpanded, setPieExpanded] = useState(false);
  const [showDateRange, setShowDateRange] = useState(false);
  const [rangeStart,    setRangeStart]    = useState(null);
  const [rangeEnd,      setRangeEnd]      = useState(null);
  const [editEntry,     setEditEntry]     = useState(null);
  const [contribEntry,  setContribEntry]  = useState(null);
  const [contribFeat,   setContribFeat]   = useState(null);

  const CAT_OPTIONS = [
    { key:'expenses',    label:'Expenses',    color:'#FF6B6B', icon:'📉' },
    { key:'income',      label:'Income',      color:'#2ECC8A', icon:'💰' },
    { key:'investments', label:'Investments', color:'#2196F3', icon:'💹' },
    { key:'goals',       label:'Goals',       color:'#E91E63', icon:'🎯' },
    { key:'emi',         label:'EMI',         color:'#FF9800', icon:'🏦' },
    { key:'accounts',    label:'Accounts',    color:'#9C27B0', icon:'💳' },
    { key:'split',       label:'Bill Splits', color:'#00BCD4', icon:'🧾' },
    { key:'tax',         label:'Tax',         color:'#8BC34A', icon:'📊' },
    { key:'insights',    label:'Insights',    color:'#B985FA', icon:'💡' },
  ];
  const activeCat = CAT_OPTIONS.find(c => c.key === selCat) || CAT_OPTIONS[0];

  // Build data for selected category
  const buildData = () => {
    if (selCat === 'income') {
      // Income allocation view: show how income is split across outflows + available
      const incomeEntries = (featEntries['income'] || []).filter(e =>
        rangeStart && rangeEnd ? e.date >= rangeStart && e.date <= rangeEnd : monthOf(e.date) === selM);
      const totalIncome = incomeEntries.reduce((a,e) => a + (e.amount||0), 0);

      if (totalIncome === 0) {
        // No income logged — fall through to normal subtype breakdown
        const entries = incomeEntries;
        const tot = 1;
        return { breakdown: [], total: 0, incomeAlloc: null };
      }

      // Compute outflows for the same period
      const periodFilter = e => rangeStart && rangeEnd
        ? e.date >= rangeStart && e.date <= rangeEnd
        : monthOf(e.date) === selM;

      const totalExpenses    = expenses.filter(periodFilter).reduce((a,e) => a+e.amount, 0);
      const totalGoals       = (featEntries['goals']||[]).filter(periodFilter)
        .reduce((a,e) => a + (e.contributions||[]).reduce((s,cn) => s+cn.amount, 0), 0);
      const totalEMI         = (featEntries['emi']||[]).filter(periodFilter)
        .reduce((a,e) => a + (e.contributions||[]).reduce((s,cn) => s+cn.amount, 0), 0);
      const totalInvestments = (featEntries['investments']||[]).filter(periodFilter)
        .reduce((a,e) => a+(e.amount||0), 0);
      // Bill split — only count what YOU personally owe/paid (your share, not others')
      const totalBillSplit   = (bills||[]).filter(periodFilter)
        .reduce((a,b) => {
          const myShare = b.people.find(p => p.name === 'Me');
          // If I paid the full bill, my cost is just my own share
          // If someone else paid, my share is what I owe them
          return a + (myShare ? myShare.share : 0);
        }, 0);

      const totalOutflow = totalExpenses + totalGoals + totalEMI + totalInvestments + totalBillSplit;
      const available    = totalIncome - totalOutflow;
      const isDeficit    = available < 0;

      const slices = [
        totalExpenses    > 0 && { name:'Expenses',    amt:totalExpenses,    color:'#FF6B6B', icon:'📉' },
        totalInvestments > 0 && { name:'Investments', amt:totalInvestments, color:'#2196F3', icon:'💹' },
        totalGoals       > 0 && { name:'Goals',       amt:totalGoals,       color:'#E91E63', icon:'🎯' },
        totalEMI         > 0 && { name:'EMI',         amt:totalEMI,         color:'#FF9800', icon:'🏦' },
        totalBillSplit   > 0 && { name:'Bill Split',  amt:totalBillSplit,   color:'#00BCD4', icon:'🧾' },
      ].filter(Boolean);

      if (isDeficit) {
        slices.push({ name:'Deficit', amt:Math.abs(available), color:'#FF3B30', icon:'⚠️' });
      } else if (available > 0) {
        slices.push({ name:'Available', amt:available, color:'#2ECC8A', icon:'💚' });
      }

      const tot = isDeficit ? totalOutflow : totalIncome;
      const bd = slices.map(s => ({ ...s, pct: Math.round((s.amt / tot) * 100) }));
      return { breakdown: bd, total: totalIncome, incomeAlloc: { totalIncome, totalOutflow, available, isDeficit } };
    }
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
    const isTargetCat = selCat === 'goals' || selCat === 'emi';
    if (isTargetCat) {
      // Goal allocation view: across ALL goals, show contributed vs remaining
      const allGoals = featEntries[selCat] || [];
      const totalTarget = allGoals.reduce((a,e) => a + (e.targetAmount || e.amount || 0), 0);
      const totalSaved  = allGoals.reduce((a,e) => a + (e.contributions||[]).reduce((s,cn) => s+cn.amount, 0), 0);
      const totalRem    = Math.max(totalTarget - totalSaved, 0);
      // Per-goal breakdown (each goal is a slice)
      const GCOLORS = ['#E91E63','#2196F3','#FF9800','#B985FA','#2ECC8A','#00BCD4','#FF6B6B','#8BC34A'];
      const bd = allGoals.map((e, i) => {
        const gt = e.targetAmount || e.amount || 0;
        const gs = (e.contributions||[]).reduce((a,cn) => a+cn.amount, 0);
        return { name: e.title, amt: gs, pct: gt>0?Math.min(Math.round(gs/gt*100),100):0, color: GCOLORS[i%GCOLORS.length], icon: selCat==='emi'?'🏦':'🎯', target: gt, saved: gs, rem: Math.max(gt-gs,0) };
      }).filter(g => g.target > 0);
      // Two-slice summary pie: Contributed + Remaining
      const pieBd = totalTarget > 0 ? [
        { name: selCat==='emi'?'Paid':'Contributed', amt: totalSaved,  pct: Math.round(totalSaved/totalTarget*100),  color: selCat==='emi'?'#FF9800':'#E91E63', icon: '✅' },
        { name: 'Remaining',   amt: totalRem,   pct: Math.round(totalRem/totalTarget*100),    color: '#2B2930',                           icon: '⏳' },
      ].filter(s => s.amt > 0) : [];
      return { breakdown: pieBd, total: totalTarget, goalAlloc: { totalTarget, totalSaved, totalRem, perGoal: bd, selCat } };
    }
    const entries = (featEntries[selCat] || []).filter(e => rangeStart && rangeEnd
      ? e.date >= rangeStart && e.date <= rangeEnd
      : monthOf(e.date) === selM);
    const getAmt = e => e.amount || 0;
    const tot = entries.reduce((a,e) => a + getAmt(e), 0) || 1;
    const byType = {};
    entries.forEach(e => { byType[e.subType] = (byType[e.subType]||0) + getAmt(e); });
    const COLORS = ['#B985FA','#2ECC8A','#FF9800','#2196F3','#E91E63','#00BCD4','#FF6B6B','#8BC34A'];
    const bd = Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([name,amt],i)=>({
      name, amt, pct: Math.round((amt / tot) * 100),
      color: COLORS[i % COLORS.length], icon: '',
    }));
    return { breakdown: bd, total: entries.reduce((a,e) => a + getAmt(e), 0) };
  };

  const buildTrend = () => {
    const getVal = m => {
      if (selCat === 'expenses') return expenses.filter(e=>monthOf(e.date)===m).reduce((a,e)=>a+e.amount,0);
      if (selCat === 'split')    return (bills||[]).filter(b=>monthOf(b.date)===m).reduce((a,b)=>a+b.amount,0);
      const isTC = selCat === 'goals' || selCat === 'emi';
      return (featEntries[selCat]||[]).filter(e=>monthOf(e.date)===m).reduce((a,e)=>a+(isTC?(e.targetAmount||e.amount||0):(e.amount||0)),0);
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

  const { breakdown: catD, total: catTotal, incomeAlloc, goalAlloc } = selCat === 'insights' ? { breakdown:[], total:0 } : buildData();
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

        {selCat !== 'insights' && (
        <View style={{ flexDirection:'row', marginHorizontal:16, marginBottom:14, backgroundColor:T.surface, borderRadius:14, padding:4 }}>
          {['Monthly','Quarterly','Yearly'].map(v => (
            <TouchableOpacity key={v} onPress={() => setView(v)}
              style={{ flex:1, paddingVertical:7, borderRadius:11, backgroundColor:view===v?T.grad1:'transparent', alignItems:'center' }}>
              <Text style={{ color:view===v?'#fff':T.sub, fontSize:10, fontWeight:view===v?'700':'400' }}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
        )}

        {/* Trend bars — hidden for insights */}
        {selCat !== 'insights' && (
        <View style={[styles.section, tileStyle(T)]}>
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
        )}

        {/* Month pills — hidden for insights */}
        {selCat !== 'insights' && !rangeStart && (
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
        <View style={[styles.section, tileStyle(T)]}>
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
            {selCat==='income' && incomeAlloc
              ? 'Income allocation — tap pie to expand'
              : (selCat==='goals'||selCat==='emi') && goalAlloc
              ? `${(featEntries[selCat]||[]).length} goals · ${fmt(goalAlloc.totalSaved)} of ${fmt(goalAlloc.totalTarget)}`
              : catD.length + (selCat==='expenses'?' categories':' types')}
          </Text>

          {/* Saved Insights view */}
          {selCat === 'insights' && (
            <SavedInsightsView savedInsights={savedInsights} dispatch={dispatch} T={T} />
          )}

          {/* Income allocation summary */}
          {selCat === 'income' && incomeAlloc && (
            <View style={{ backgroundColor: incomeAlloc.isDeficit ? 'rgba(255,59,48,0.12)' : 'rgba(46,204,138,0.1)', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: incomeAlloc.isDeficit ? '#FF3B3055' : '#2ECC8A55' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View>
                  <Text style={{ color: T.sub, fontSize: 10 }}>TOTAL INCOME</Text>
                  <Text style={{ color: '#2ECC8A', fontSize: 20, fontWeight: '800' }}>{fmt(incomeAlloc.totalIncome)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: T.sub, fontSize: 10 }}>{incomeAlloc.isDeficit ? 'DEFICIT' : 'AVAILABLE'}</Text>
                  <Text style={{ color: incomeAlloc.isDeficit ? '#FF3B30' : '#2ECC8A', fontSize: 20, fontWeight: '800' }}>
                    {incomeAlloc.isDeficit ? '-' : '+'}{fmt(Math.abs(incomeAlloc.available))}
                  </Text>
                </View>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                <View style={{ height: 8, borderRadius: 99, width: `${Math.min(Math.round(incomeAlloc.totalOutflow / Math.max(incomeAlloc.totalIncome,1) * 100), 100)}%`, backgroundColor: incomeAlloc.isDeficit ? '#FF3B30' : '#B985FA' }} />
              </View>
              <Text style={{ color: T.sub, fontSize: 10, marginTop: 6 }}>
                {Math.min(Math.round(incomeAlloc.totalOutflow / Math.max(incomeAlloc.totalIncome,1) * 100), 100)}% of income allocated · {fmt(incomeAlloc.totalOutflow)} outflow
              </Text>
            </View>
          )}

          {catD.length > 0 ? (
            <>
              {/* Pie + legend — same for ALL categories */}
              <View style={{ flexDirection:'row', gap:16, alignItems:'center', marginBottom:16 }}>
                <TouchableOpacity onPress={() => setPieExpanded(true)} activeOpacity={0.85}>
                  <StatsPie
                    data={catD} total={catTotal} T={T}
                    onDoubleTap={(selCat!=='expenses' && selCat!=='split' && selCat!=='goals' && selCat!=='emi') ? (seg) => {
                      const entries = (featEntries[selCat]||[]).filter(e=>e.subType===seg.name && monthOf(e.date)===selM);
                      if (entries.length > 0) setEditEntry({ entry: entries[entries.length-1], originY: SH * 0.45 });
                    } : null}
                  />
                </TouchableOpacity>
                <View style={{ flex:1 }}>
                  {catD.slice(0,5).map((cat,i) => (
                    <View key={cat.name} style={{ flexDirection:'row', alignItems:'center', gap:7, marginBottom:7 }}>
                      <View style={{ width:9, height:9, borderRadius:3, backgroundColor:cat.color }} />
                      <Text style={{ color:T.sub, fontSize:11, flex:1 }} numberOfLines={1}>{cat.icon||''} {cat.name}</Text>
                      <Text style={{ color:T.text, fontSize:11, fontWeight:'700' }}>{cat.pct}%</Text>
                    </View>
                  ))}
                </View>
              </View>
              {/* Breakdown bars — same for ALL categories */}
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
            </>
          ) : (
            <Text style={{ color:T.sub, fontSize:13, textAlign:'center', paddingVertical:16 }}>No data this period</Text>
          )}

          {/* Deficit banner */}
          {selCat === 'income' && incomeAlloc && incomeAlloc.isDeficit && (
            <View style={{ backgroundColor:'rgba(255,59,48,0.15)', borderRadius:14, padding:14, marginBottom:12, borderWidth:1, borderColor:'#FF3B3055', flexDirection:'row', alignItems:'center', gap:10 }}>
              <Text style={{ fontSize:22 }}>⚠️</Text>
              <View style={{ flex:1 }}>
                <Text style={{ color:'#FF3B30', fontSize:13, fontWeight:'700' }}>Overspent this month</Text>
                <Text style={{ color:T.sub, fontSize:11, marginTop:2 }}>You've spent {fmt(Math.abs(incomeAlloc.available))} more than your income of {fmt(incomeAlloc.totalIncome)}</Text>
              </View>
            </View>
          )}

          {/* Goals / EMI — summary card + target cards below breakdown */}
          {(selCat==='goals'||selCat==='emi') && goalAlloc && (
            <View style={{ marginTop: 8 }}>
              {/* Summary bar */}
              <View style={{ backgroundColor: T.surface2, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: activeCat.color+'44' }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
                  <View>
                    <Text style={{ color: T.sub, fontSize: 10 }}>TOTAL TARGET</Text>
                    <Text style={{ color: activeCat.color, fontSize: 20, fontWeight: '800' }}>{fmt(goalAlloc.totalTarget)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: T.sub, fontSize: 10 }}>REMAINING</Text>
                    <Text style={{ color: T.text, fontSize: 20, fontWeight: '800' }}>{fmt(goalAlloc.totalRem)}</Text>
                  </View>
                </View>
                <View style={{ backgroundColor:'rgba(255,255,255,0.08)', borderRadius:99, height:8, overflow:'hidden' }}>
                  <View style={{ height:8, borderRadius:99, width: goalAlloc.totalTarget>0 ? `${Math.min(Math.round(goalAlloc.totalSaved/goalAlloc.totalTarget*100),100)}%` : '0%', backgroundColor: activeCat.color }} />
                </View>
                <Text style={{ color:T.sub, fontSize:10, marginTop:6 }}>
                  {goalAlloc.totalTarget>0 ? Math.min(Math.round(goalAlloc.totalSaved/goalAlloc.totalTarget*100),100) : 0}% achieved · {fmt(goalAlloc.totalSaved)} {selCat==='emi'?'paid':'saved'}
                </Text>
              </View>
              {/* Per-goal progress list */}
              {goalAlloc.perGoal.map((g,i) => (
                <View key={i} style={{ backgroundColor:T.surface, borderRadius:14, padding:14, marginBottom:8, borderLeftWidth:3, borderLeftColor:g.color }}>
                  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <Text style={{ color:T.text, fontSize:13, fontWeight:'700', flex:1 }} numberOfLines={1}>{g.name}</Text>
                    <Text style={{ color:g.pct>=100?'#2ECC8A':g.color, fontSize:13, fontWeight:'800', marginLeft:8 }}>{g.pct}%</Text>
                  </View>
                  <View style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:99, height:6, overflow:'hidden', marginBottom:6 }}>
                    <View style={{ height:6, borderRadius:99, width:`${g.pct}%`, backgroundColor:g.pct>=100?'#2ECC8A':g.color }} />
                  </View>
                  <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                    <Text style={{ color:g.color, fontSize:11, fontWeight:'600' }}>{fmt(g.saved)} {selCat==='emi'?'paid':'saved'}</Text>
                    <Text style={{ color:T.sub, fontSize:11 }}>of {fmt(g.target)}</Text>
                  </View>
                </View>
              ))}
              <Text style={[styles.secTitle, { color:T.text, marginBottom:10, marginTop:8 }]}>
                {selCat==='emi' ? 'Your Loans' : 'Your Goals'}
              </Text>
              {(featEntries[selCat]||[]).length === 0
                ? <Text style={{ color:T.sub, fontSize:13, textAlign:'center', paddingVertical:16 }}>No {selCat==='emi'?'loans':'goals'} yet. Tap a bubble in More tab to create one.</Text>
                : (featEntries[selCat]||[]).map(entry => (
                    <GoalCard key={entry.id}
                      feat={FEATURES.find(f=>f.id===selCat)||{id:selCat,icon:'🎯',color:FEAT_COLORS[selCat]||'#B985FA'}}
                      entry={entry} dispatch={dispatch} T={T}
                      onContribute={e => { setContribEntry(e); setContribFeat(FEATURES.find(f=>f.id===selCat)); }} />
                  ))
              }
            </View>
          )}

          {/* Bill Split — settle per person below breakdown */}
          {selCat==='split' && (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.secTitle, { color:T.text, marginBottom:10 }]}>Active Bills</Text>
              {(bills||[]).filter(b=>monthOf(b.date)===selM).length === 0
                ? <Text style={{ color:T.sub, fontSize:13, textAlign:'center', paddingVertical:16 }}>No bills this month.</Text>
                : (bills||[]).filter(b=>monthOf(b.date)===selM).map(bill => (
                    <View key={bill.id} style={{ backgroundColor:T.surface2, borderRadius:14, padding:14, marginBottom:10, borderLeftWidth:3, borderLeftColor:'#00BCD4' }}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }}>
                        <Text style={{ fontSize:22 }}>{(bill.category||'🧾').split(' ')[0]}</Text>
                        <View style={{ flex:1 }}>
                          <Text style={{ color:T.text, fontSize:14, fontWeight:'700' }}>{bill.title}</Text>
                          <Text style={{ color:T.sub, fontSize:11 }}>{dispDate(bill.date)} · Paid by {bill.payer} · {fmt(bill.amount)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => dispatch({ type:'DELETE_BILL', id:bill.id })}
                          style={{ padding:8, borderRadius:10, backgroundColor:'rgba(255,107,107,0.15)' }}>
                          <Text style={{ color:'#FF6B6B', fontSize:12, fontWeight:'700' }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                      {bill.people.filter(p=>p.name!==bill.payer).map(p => (
                        <View key={p.name} style={{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8, borderTopWidth:1, borderTopColor:T.border }}>
                          <View style={{ width:30, height:30, borderRadius:15, backgroundColor:'#6750A4', alignItems:'center', justifyContent:'center' }}>
                            <Text style={{ color:'#fff', fontSize:11, fontWeight:'700' }}>{p.name.slice(0,2).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex:1 }}>
                            <Text style={{ color:T.text, fontSize:13, fontWeight:'600' }}>{p.name}</Text>
                            <Text style={{ color:T.sub, fontSize:11 }}>{p.settled ? '✅ Settled' : 'Owes '+bill.payer}</Text>
                          </View>
                          <Text style={{ color:'#00BCD4', fontSize:13, fontWeight:'700', marginRight:8 }}>{fmt(p.share)}</Text>
                          {p.settled
                            ? <View style={{ paddingHorizontal:10, paddingVertical:4, borderRadius:99, backgroundColor:'rgba(46,204,138,0.15)' }}>
                                <Text style={{ color:'#2ECC8A', fontSize:11, fontWeight:'700' }}>Settled</Text>
                              </View>
                            : <TouchableOpacity onPress={() => dispatch({ type:'SETTLE_BILL', billId:bill.id, person:p.name })}
                                style={{ paddingHorizontal:10, paddingVertical:5, borderRadius:99, borderWidth:1.5, borderColor:'#2ECC8A' }}>
                                <Text style={{ color:'#2ECC8A', fontSize:11, fontWeight:'700' }}>Settle</Text>
                              </TouchableOpacity>
                          }
                        </View>
                      ))}
                    </View>
                  ))
              }
            </View>
          )}
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
            // Show details for the currently selected category
            const isExp = selCat === 'expenses';
            const isSplit = selCat === 'split';
            const isTarget = selCat === 'goals' || selCat === 'emi';
            const tEx   = isExp ? expenses.filter(e=>monthOf(e.date)===trendMonth) : [];
            const tFeat = (!isExp && !isSplit) ? (featEntries[selCat]||[]).filter(e=>monthOf(e.date)===trendMonth) : [];
            const tBills = isSplit ? (bills||[]).filter(b=>monthOf(b.date)===trendMonth) : [];
            const tTot  = isExp ? tEx.reduce((a,e)=>a+e.amount,0) : isSplit ? tBills.reduce((a,b)=>a+b.amount,0) : tFeat.reduce((a,e)=>a+(e.amount||e.targetAmount||0),0);
            const days  = Array.from({length:31},(_,i)=>{ const d=`${trendMonth}-${String(i+1).padStart(2,'0')}`; return isExp ? tEx.filter(e=>e.date===d).reduce((a,e)=>a+e.amount,0) : isSplit ? tBills.filter(b=>b.date===d).reduce((a,b)=>a+b.amount,0) : tFeat.filter(e=>e.date===d).reduce((a,e)=>a+(e.amount||0),0); });
            const maxD  = Math.max(...days,1);
            const ct={};
            if(isExp) tEx.forEach(e=>{ct[e.category]=(ct[e.category]||0)+e.amount;});
            else if(isSplit) tBills.forEach(b=>{ct[b.category||'Other']=(ct[b.category||'Other']||0)+b.amount;});
            else tFeat.forEach(e=>{ct[e.subType]=(ct[e.subType]||0)+(e.amount||e.targetAmount||0);});
            const catData=Object.entries(ct).sort((a,b)=>b[1]-a[1]);
            const acColor = activeCat.color;
            return (
              <>
                <View style={[styles.detailHero, { backgroundColor:acColor+'22' }]}>
                  <TouchableOpacity onPress={close} style={styles.backBtn}><Text style={{ color:T.text, fontSize:18 }}>←</Text></TouchableOpacity>
                  <Text style={{ fontSize: 28, marginTop: 8 }}>{activeCat.icon}</Text>
                  <Text style={[styles.detailTitle,{ color:T.text, marginTop:4 }]}>{activeCat.label} — {new Date(trendMonth+'-01').toLocaleString('en-IN',{month:'long',year:'numeric'})}</Text>
                  <Text style={[styles.detailAmt,{ color:acColor }]}>{fmt(tTot)}</Text>
                  <Text style={{ color:T.sub, fontSize:11, marginTop:4 }}>{isExp ? tEx.length+' expenses' : isSplit ? tBills.length+' bills' : tFeat.length+' entries'}</Text>
                </View>
                <ScrollView style={{ flex:1, paddingHorizontal:16 }} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.secTitle,{ color:T.text, marginTop:14, marginBottom:10 }]}>Daily Activity</Text>
                  <View style={{ flexDirection:'row', alignItems:'flex-end', height:72, gap:2, marginBottom:16 }}>
                    {days.map((v,i) => <View key={i} style={{ flex:1, alignItems:'center' }}><View style={{ height:Math.max(Math.round((v/maxD)*64),v>0?4:2), width:'100%', backgroundColor:v>0?acColor:'rgba(103,80,164,0.15)', borderRadius:3 }} /></View>)}
                  </View>
                  {catData.length > 0 && <>
                    <Text style={[styles.secTitle,{ color:T.text, marginBottom:10 }]}>Breakdown</Text>
                    {catData.map(([name,amt])=>{
                      const ca = isExp ? (CM[name]??CM['Other']) : { icon:'', color:acColor };
                      const pct=Math.round((amt/Math.max(tTot,1))*100);
                      return (
                        <View key={name} style={{ marginBottom:13 }}>
                          <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:5 }}><Text style={{ color:T.text, fontSize:13 }}>{ca.icon} {name}</Text><Text style={{ color:T.sub, fontSize:12 }}>{fmt(amt)} · {pct}%</Text></View>
                          <View style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:99, height:5 }}><View style={{ width:`${pct}%`, backgroundColor:ca.color||acColor, borderRadius:99, height:5 }} /></View>
                        </View>
                      );
                    })}
                  </>}
                  {/* Entry list with edit/delete */}
                  {(isExp ? tEx : isSplit ? tBills : tFeat).length > 0 && (
                    <>
                      <Text style={[styles.secTitle,{ color:T.text, marginBottom:10, marginTop:4 }]}>
                        {isExp ? 'Expenses' : isSplit ? 'Bills' : 'Entries'}
                      </Text>
                      {isExp && tEx.map(e => {
                        const cat = CM[e.category]??CM['Other'];
                        return (
                          <View key={e.id} style={{ flexDirection:'row', alignItems:'center', gap:10, backgroundColor:T.surface, borderRadius:13, padding:10, marginBottom:7 }}>
                            <View style={{ width:34, height:34, borderRadius:10, backgroundColor:cat.color+'22', alignItems:'center', justifyContent:'center' }}>
                              <Text style={{ fontSize:16 }}>{cat.icon}</Text>
                            </View>
                            <View style={{ flex:1 }}>
                              <Text style={{ color:T.text, fontSize:13, fontWeight:'600' }}>{e.title}</Text>
                              <Text style={{ color:T.sub, fontSize:11 }}>{dispDate(e.date)} · {e.category}</Text>
                            </View>
                            <Text style={{ color:'#FF8A80', fontSize:13, fontWeight:'700', marginRight:6 }}>−{fmt(e.amount)}</Text>
                            <TouchableOpacity onPress={() => { close(); setTimeout(() => handleEditExpense(e), 400); }}
                              style={{ backgroundColor:T.grad1+'33', borderRadius:8, paddingHorizontal:8, paddingVertical:5 }}>
                              <Text style={{ color:T.accent, fontSize:11, fontWeight:'700' }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => dispatch({ type:'DELETE', id:e.id })}
                              style={{ backgroundColor:'rgba(255,107,107,0.15)', borderRadius:8, paddingHorizontal:8, paddingVertical:5, marginLeft:4 }}>
                              <Text style={{ color:'#FF6B6B', fontSize:11, fontWeight:'700' }}>Del</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                      {isSplit && tBills.map(b => (
                        <View key={b.id} style={{ flexDirection:'row', alignItems:'center', gap:10, backgroundColor:T.surface, borderRadius:13, padding:10, marginBottom:7 }}>
                          <View style={{ width:34, height:34, borderRadius:10, backgroundColor:'rgba(0,188,212,0.18)', alignItems:'center', justifyContent:'center' }}>
                            <Text style={{ fontSize:16 }}>🧾</Text>
                          </View>
                          <View style={{ flex:1 }}>
                            <Text style={{ color:T.text, fontSize:13, fontWeight:'600' }}>{b.title}</Text>
                            <Text style={{ color:T.sub, fontSize:11 }}>{dispDate(b.date)} · {b.payer} paid</Text>
                          </View>
                          <Text style={{ color:'#00BCD4', fontSize:13, fontWeight:'700', marginRight:6 }}>{fmt(b.amount)}</Text>
                          <TouchableOpacity onPress={() => dispatch({ type:'DELETE_BILL', id:b.id })}
                            style={{ backgroundColor:'rgba(255,107,107,0.15)', borderRadius:8, paddingHorizontal:8, paddingVertical:5 }}>
                            <Text style={{ color:'#FF6B6B', fontSize:11, fontWeight:'700' }}>Del</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      {!isExp && !isSplit && tFeat.map(e => (
                        <View key={e.id} style={{ flexDirection:'row', alignItems:'center', gap:10, backgroundColor:T.surface, borderRadius:13, padding:10, marginBottom:7 }}>
                          <View style={{ width:34, height:34, borderRadius:10, backgroundColor:acColor+'22', alignItems:'center', justifyContent:'center' }}>
                            <Text style={{ fontSize:16 }}>{activeCat.icon}</Text>
                          </View>
                          <View style={{ flex:1 }}>
                            <Text style={{ color:T.text, fontSize:13, fontWeight:'600' }}>{e.title}</Text>
                            <Text style={{ color:T.sub, fontSize:11 }}>{e.subType} · {dispDate(e.date)}</Text>
                          </View>
                          <Text style={{ color:acColor, fontSize:13, fontWeight:'700', marginRight:6 }}>{fmt(e.amount||e.targetAmount||0)}</Text>
                          <TouchableOpacity onPress={() => dispatch({ type:'DELETE_FEAT', fid:selCat, id:e.id })}
                            style={{ backgroundColor:'rgba(255,107,107,0.15)', borderRadius:8, paddingHorizontal:8, paddingVertical:5 }}>
                            <Text style={{ color:'#FF6B6B', fontSize:11, fontWeight:'700' }}>Del</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  )}
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
      {contribEntry && contribFeat && (
        <GoalContributeSheet entry={contribEntry} feat={contribFeat} dispatch={dispatch} T={T}
          animLevel={animLevel} onClose={() => { setContribEntry(null); setContribFeat(null); }} />
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
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
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
                      <Text style={{ color:color, fontSize:13, fontWeight:'700', marginRight:4 }}>{isTarget ? fmt(e.targetAmount||e.amount||0) : fmt(e.amount)}</Text>
                      <TouchableOpacity onPress={() => dispatch({ type:'DELETE_FEAT', fid:feat.id, id:e.id })}
                        style={{ width:26, height:26, borderRadius:13, backgroundColor:'rgba(255,107,107,0.15)', alignItems:'center', justifyContent:'center' }}>
                        <Text style={{ color:'#FF6B6B', fontSize:12 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={{ height: 320 }} />
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
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
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

      {/* Cat animation — pinned to bottom of screen */}
      <View style={{ position:'absolute', bottom:0, left:0, right:0 }} pointerEvents="none">
        <LottieView
          source={require('./lottie-cat.json')}
          autoPlay loop
          style={{ width: SW, height: SW * 456 / 1070 }}
          speed={0.85}
        />
      </View>

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
              { text: 'Delete', style: 'destructive', onPress: () => { close(); setTimeout(() => onDelete(expense.id), 320); } },
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

// ─── CATEGORY AUTO-SUGGEST ───────────────────────────────────────────────────
const SUGGEST_KEYWORDS = {
  Food:['zomato','swiggy','food','burger','pizza','restaurant','cafe','coffee','chai','lunch','dinner','breakfast','biryani','meal','snack'],
  Transport:['ola','uber','rapido','metro','bus','auto','petrol','diesel','fuel','parking','toll','cab','train','flight'],
  Shopping:['amazon','flipkart','myntra','ajio','mall','clothes','shirt','shoes','bag','watch','dress'],
  Entertainment:['netflix','prime','hotstar','spotify','movie','film','concert','game','pub','bar','club'],
  Utilities:['electricity','water','gas','internet','wifi','recharge','mobile','phone','bill','airtel','jio'],
  Health:['doctor','hospital','medicine','pharmacy','apollo','medical','gym','yoga','fitness','dentist'],
  Education:['school','college','course','udemy','books','fees','tuition','class','coaching'],
  Travel:['hotel','flight','oyo','booking','makemytrip','trip','vacation','holiday','resort'],
  Groceries:['bigbasket','blinkit','grofers','zepto','dmart','reliance','vegetable','fruit'],
  Dining:['restaurant','cafe','dine','biryani','thali'],
  Subscriptions:['netflix','prime','spotify','hotstar','apple','microsoft','adobe','notion','canva'],
};
function suggestCategory(title) {
  const t = title.toLowerCase();
  for (const [cat, kws] of Object.entries(SUGGEST_KEYWORDS)) {
    if (kws.some(k => t.includes(k))) return cat;
  }
  return null;
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

  // Auto-suggest category from title
  const handleTitleChange = (t) => {
    setTitle(t);
    if (!existing) { // only auto-suggest for new entries
      const suggested = suggestCategory(t);
      if (suggested && suggested !== cat) setCat(suggested);
    }
  };

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
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
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
                <TextInput value={title} onChangeText={handleTitleChange} placeholder="e.g. Grocery Shopping"
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
              <View style={{ height: 320 }} />
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



// ─── SUBSCRIPTION TRACKER ─────────────────────────────────────────────────────
function SubscriptionScreen({ recurring, expenses, T }) {
  const subs = (recurring||[]).filter(r =>
    ['Subscriptions','Entertainment'].includes(r.category) ||
    ['netflix','prime','spotify','hotstar','apple','microsoft','adobe','notion','canva','figma','youtube'].some(k => r.title.toLowerCase().includes(k))
  );
  const totalMonthly = subs.filter(r=>r.freq==='monthly').reduce((a,r)=>a+r.amount,0);
  const totalAnnual  = totalMonthly * 12;

  return (
    <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator={false}>
      <Text style={[styles.screenTitle, { color:T.text }]}>Subscriptions 📱</Text>
      {/* Summary card */}
      <View style={{ marginHorizontal:16, marginBottom:16, backgroundColor:T.grad1, borderRadius:18, padding:18 }}>
        <Text style={{ color:'rgba(255,255,255,0.7)', fontSize:11 }}>MONTHLY SUBSCRIPTIONS</Text>
        <Text style={{ color:'#fff', fontSize:28, fontWeight:'800', marginTop:4 }}>{fmt(totalMonthly)}</Text>
        <Text style={{ color:'rgba(255,255,255,0.65)', fontSize:12, marginTop:4 }}>₹{Math.round(totalAnnual/1000)}k per year · {subs.length} active</Text>
      </View>
      {subs.length === 0
        ? <View style={styles.emptyBox}>
            <Text style={{ fontSize:40, marginBottom:12 }}>📱</Text>
            <Text style={[styles.emptyTitle, { color:T.text }]}>No subscriptions found</Text>
            <Text style={{ color:T.sub, fontSize:12, marginTop:6, textAlign:'center' }}>Add recurring expenses tagged as Subscriptions or Entertainment</Text>
          </View>
        : subs.map(r => {
            const cat = CM[r.category]??CM['Other'];
            return (
              <View key={r.id} style={{ marginHorizontal:16, marginBottom:10, backgroundColor:T.surface, borderRadius:16, padding:14, flexDirection:'row', alignItems:'center', gap:12 }}>
                <View style={{ width:44, height:44, borderRadius:14, backgroundColor:cat.color+'28', alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ fontSize:22 }}>{cat.icon}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ color:T.text, fontSize:14, fontWeight:'700' }}>{r.title}</Text>
                  <Text style={{ color:T.sub, fontSize:11, marginTop:2 }}>{r.freq==='monthly'?'Monthly':r.freq==='yearly'?'Yearly':'Weekly'} · {r.payment}</Text>
                </View>
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={{ color:'#FF8A80', fontSize:15, fontWeight:'800' }}>−{fmt(r.amount)}</Text>
                  <Text style={{ color:T.sub, fontSize:10, marginTop:2 }}>{r.freq==='monthly'?fmt(r.amount*12)+'/yr':''}</Text>
                </View>
              </View>
            );
          })
      }
      <View style={{ height:24 }} />
    </ScrollView>
  );
}

// ─── TAX SUMMARY ─────────────────────────────────────────────────────────────
function TaxSummaryScreen({ featEntries, T }) {
  const taxEntries = featEntries?.tax || [];
  const SECTIONS = [
    { key:'80C Investment', label:'80C Investments', limit:150000, icon:'💹', color:'#2196F3' },
    { key:'HRA',            label:'HRA',             limit:0,      icon:'🏠', color:'#9C27B0' },
    { key:'Medical Insurance', label:'80D Medical',  limit:25000,  icon:'💊', color:'#00BCD4' },
    { key:'Education Loan', label:'Education Loan Interest', limit:0, icon:'📚', color:'#FF9800' },
    { key:'Home Loan',      label:'Home Loan Interest',      limit:200000, icon:'🏡', color:'#E91E63' },
    { key:'80D',            label:'80D Other',       limit:25000,  icon:'🏥', color:'#4CAF50' },
    { key:'Other',          label:'Other Deductions', limit:0,     icon:'📊', color:'#8BC34A' },
  ];
  const totals = {};
  taxEntries.forEach(e => { totals[e.subType] = (totals[e.subType]||0) + (e.amount||0); });
  const grandTotal = Object.values(totals).reduce((a,v)=>a+v,0);
  const estSaving  = Math.round(grandTotal * 0.3); // rough 30% tax bracket estimate

  return (
    <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator={false}>
      <Text style={[styles.screenTitle, { color:T.text }]}>Tax Summary 📊</Text>
      {/* Summary */}
      <View style={{ marginHorizontal:16, marginBottom:16, backgroundColor:T.grad1, borderRadius:18, padding:18 }}>
        <Text style={{ color:'rgba(255,255,255,0.7)', fontSize:11 }}>TOTAL DEDUCTIONS LOGGED</Text>
        <Text style={{ color:'#fff', fontSize:28, fontWeight:'800', marginTop:4 }}>{fmt(grandTotal)}</Text>
        <Text style={{ color:'rgba(255,255,255,0.65)', fontSize:12, marginTop:4 }}>Estimated tax saving: ~{fmt(estSaving)} (at 30% bracket)</Text>
      </View>
      {taxEntries.length === 0
        ? <View style={styles.emptyBox}>
            <Text style={{ fontSize:40, marginBottom:12 }}>📊</Text>
            <Text style={[styles.emptyTitle, { color:T.text }]}>No tax entries yet</Text>
            <Text style={{ color:T.sub, fontSize:12, marginTop:6, textAlign:'center' }}>Log 80C, HRA, and medical expenses in the Tax feature</Text>
          </View>
        : SECTIONS.map(s => {
            const amt = totals[s.key] || 0;
            if (amt === 0) return null;
            const pct = s.limit > 0 ? Math.min(Math.round(amt/s.limit*100),100) : null;
            return (
              <View key={s.key} style={{ marginHorizontal:16, marginBottom:10, backgroundColor:T.surface, borderRadius:16, padding:14 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom: pct!==null?10:0 }}>
                  <View style={{ width:40, height:40, borderRadius:13, backgroundColor:s.color+'28', alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ fontSize:20 }}>{s.icon}</Text>
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:T.text, fontSize:13, fontWeight:'700' }}>{s.label}</Text>
                    {s.limit > 0 && <Text style={{ color:T.sub, fontSize:11, marginTop:1 }}>Limit: {fmt(s.limit)}</Text>}
                  </View>
                  <View style={{ alignItems:'flex-end' }}>
                    <Text style={{ color:s.color, fontSize:15, fontWeight:'800' }}>{fmt(amt)}</Text>
                    {pct !== null && <Text style={{ color: pct>=100?'#2ECC8A':T.sub, fontSize:10, marginTop:1 }}>{pct}% used</Text>}
                  </View>
                </View>
                {pct !== null && (
                  <View style={{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:99, height:5, overflow:'hidden' }}>
                    <View style={{ height:5, borderRadius:99, width:pct+'%', backgroundColor:pct>=100?'#2ECC8A':s.color }} />
                  </View>
                )}
              </View>
            );
          }).filter(Boolean)
      }
      {/* Note */}
      {taxEntries.length > 0 && (
        <View style={{ marginHorizontal:16, marginBottom:24, backgroundColor:'rgba(185,133,250,0.1)', borderRadius:14, padding:12, borderWidth:1, borderColor:'rgba(185,133,250,0.25)' }}>
          <Text style={{ color:T.sub, fontSize:11, lineHeight:17 }}>⚠️ This is an estimate based on logged entries. Consult a CA for accurate tax computation. The 30% tax bracket estimate may not apply to your situation.</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── RECURRING SCREEN ─────────────────────────────────────────────────────────
function RecurringScreen({ recurring, dispatch, T, animLevel }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: T.sub, fontSize: 12 }}>Auto-logged expenses</Text>
          <Text style={{ fontSize: 21, fontWeight: '800', color: T.text }}>Recurring 🔁</Text>
        </View>
        <TouchableOpacity onPress={() => { setEditItem(null); setShowAdd(true); }}
          style={{ backgroundColor: T.grad1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 9 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {(!recurring || recurring.length === 0)
        ? <View style={styles.emptyBox}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>🔁</Text>
            <Text style={[styles.emptyTitle, { color: T.text }]}>No recurring expenses</Text>
            <Text style={{ color: T.sub, fontSize: 12, marginTop: 6, textAlign: 'center' }}>Add rent, subscriptions, EMIs that repeat automatically</Text>
          </View>
        : <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {recurring.map(r => {
              const cat = CM[r.category] ?? CM['Other'];
              const freqLabel = r.freq === 'daily' ? 'Daily' : r.freq === 'weekly' ? 'Weekly' : 'Monthly';
              return (
                <View key={r.id} style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: T.surface, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: cat.color + '28', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{r.title}</Text>
                    <Text style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>{freqLabel} · {r.category} · {r.payment || 'UPI'}</Text>
                    {r.lastApplied && <Text style={{ color: '#2ECC8A', fontSize: 10, marginTop: 2 }}>Last applied: {dispDate(r.lastApplied)}</Text>}
                  </View>
                  <Text style={{ color: '#FF8A80', fontSize: 15, fontWeight: '800', marginRight: 4 }}>−{fmt(r.amount)}</Text>
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity onPress={() => { setEditItem(r); setShowAdd(true); }}
                      style={{ backgroundColor: T.grad1 + '33', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: T.accent, fontSize: 11, fontWeight: '700' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => dispatch({ type: 'DELETE_RECURRING', id: r.id })}
                      style={{ backgroundColor: 'rgba(255,107,107,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: '#FF6B6B', fontSize: 11, fontWeight: '700' }}>Del</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
      }

      {showAdd && (
        <RecurringFormSheet
          existing={editItem} dispatch={dispatch} T={T} animLevel={animLevel}
          onClose={() => { setShowAdd(false); setEditItem(null); }}
        />
      )}
    </View>
  );
}

// ─── RECURRING FORM SHEET ─────────────────────────────────────────────────────
function RecurringFormSheet({ existing, dispatch, onClose, T, animLevel }) {
  const [title,    setTitle]    = useState(existing?.title    || '');
  const [amount,   setAmount]   = useState(existing ? String(existing.amount) : '');
  const [cat,      setCat]      = useState(existing?.category  || 'Food');
  const [freq,     setFreq]     = useState(existing?.freq      || 'monthly');
  const [payment,  setPayment]  = useState(existing?.payment   || 'UPI');
  const [saved,    setSaved]    = useState(false);

  const handleSave = (close) => {
    if (!title.trim() || !amount || Number(amount) <= 0) return;
    setSaved(true);
    setTimeout(() => {
      const item = { id: existing?.id || Date.now(), title: title.trim(), amount: Number(amount), category: cat, freq, payment, lastApplied: existing?.lastApplied || '' };
      if (existing) dispatch({ type: 'EDIT_RECURRING', item });
      else dispatch({ type: 'ADD_RECURRING', item });
      close();
    }, 600);
  };

  const FREQS = [['daily','Daily'],['weekly','Weekly'],['monthly','Monthly']];
  const PAYMENTS = ['UPI','Cash','Credit Card','Debit Card','Net Banking'];

  return (
    <SlideScreen onClose={onClose} zIndex={60} T={T} animLevel={animLevel}>
      {close => (
        <>
          <View style={[styles.detailHero, { backgroundColor: T.grad1 + '22' }]}>
            <TouchableOpacity onPress={close} style={styles.backBtn}>
              <Text style={{ color: T.text, fontSize: 18 }}>←</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🔁</Text>
            <Text style={[styles.detailTitle, { color: T.text }]}>{existing ? 'Edit Recurring' : 'New Recurring'}</Text>
            <Text style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>Auto-logged on schedule</Text>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 320 }}>
              <View style={[styles.amountBox, { backgroundColor: T.surface }]}>
                <Text style={{ color: T.accent, fontSize: 26, fontWeight: '300' }}>₹</Text>
                <TextInput value={amount} onChangeText={t => setAmount(t.replace(/[^0-9.]/g,''))}
                  placeholder="0" placeholderTextColor={T.sub} keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: T.text }]} />
              </View>
              <View style={[styles.formField, { backgroundColor: T.surface }]}>
                <Text style={[styles.fieldLabel, { color: T.sub }]}>TITLE</Text>
                <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Netflix, Rent"
                  placeholderTextColor={T.sub} style={[styles.fieldInput, { color: T.text }]} />
              </View>
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>FREQUENCY</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {FREQS.map(([k,l]) => (
                    <TouchableOpacity key={k} onPress={() => setFreq(k)}
                      style={[styles.filterPill, { flex: 1, alignItems: 'center', backgroundColor: freq===k ? T.grad1 : T.surface }]}>
                      <Text style={{ color: freq===k?'#fff':T.sub, fontSize: 12, fontWeight: freq===k?'700':'400' }}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>CATEGORY</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {CATS.map(ct => (
                    <TouchableOpacity key={ct.name} onPress={() => setCat(ct.name)}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99,
                        backgroundColor: cat===ct.name ? ct.color+'28' : T.surface,
                        borderWidth: 1.5, borderColor: cat===ct.name ? ct.color : 'transparent' }}>
                      <Text style={{ color: cat===ct.name ? ct.color : T.sub, fontSize: 12 }}>{ct.icon} {ct.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: T.sub, marginBottom: 8 }]}>PAYMENT METHOD</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {PAYMENTS.map(p => (
                    <TouchableOpacity key={p} onPress={() => setPayment(p)}
                      style={[styles.filterPill, { backgroundColor: payment===p ? T.grad1 : T.surface }]}>
                      <Text style={{ color: payment===p?'#fff':T.sub, fontSize: 11 }}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
          <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <TouchableOpacity onPress={() => handleSave(close)}
              style={[styles.saveBtn, { backgroundColor: saved ? '#4CAF50' : T.grad1 }]}>
              <Text style={styles.saveBtnText}>{saved ? '✓ Saved!' : existing ? 'Save Changes' : 'Create Recurring'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SlideScreen>
  );
}


// ─── BACKUP & RESTORE ────────────────────────────────────────────────────────
function BackupScreen({ state, dispatch, T, animLevel, onClose }) {
  const [status,    setStatus]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [saved,     setSaved]     = useState(false);

  // ── EXPORT ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      setLoading(true);
      const backup = {
        version: 'celestial_backup_v1',
        exportedAt: new Date().toISOString(),
        data: {
          expenses:      state.expenses,
          budget:        state.budget,
          theme:         state.theme,
          animLevel:     state.animLevel,
          catBudgets:    state.catBudgets,
          features:      state.features,
          featEntries:   state.featEntries,
          bills:         state.bills,
          recurring:     state.recurring,
          savedInsights: state.savedInsights,
          pin:           state.pin,
          biometric:     state.biometric,
          lockDelay:     state.lockDelay,
        }
      };
      const json = JSON.stringify(backup, null, 2);
      // Write to a temp file then share it
      const FileSystem = require('expo-file-system');
      const fileName = 'celestial-backup-' + new Date().toISOString().slice(0,10) + '.json';
      const fileUri  = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
      await Share.share({ title: 'Celestial Backup', url: fileUri, message: 'My Celestial Expense Tracker backup — ' + new Date().toLocaleDateString('en-IN') });
      setStatus('success:Backup file shared! Save it to Google Drive, WhatsApp, or any cloud storage.');
    } catch (e) {
      // Fallback: share as text if file system fails
      try {
        const backup = { version:'celestial_backup_v1', exportedAt:new Date().toISOString(), data:{ expenses:state.expenses, budget:state.budget, theme:state.theme, animLevel:state.animLevel, catBudgets:state.catBudgets, features:state.features, featEntries:state.featEntries, bills:state.bills, recurring:state.recurring, savedInsights:state.savedInsights, pin:state.pin, biometric:state.biometric, lockDelay:state.lockDelay } };
        await Share.share({ title:'Celestial Backup', message:JSON.stringify(backup,null,2) });
        setStatus('success:Backup shared as text. Copy and save it.');
      } catch (e2) {
        setStatus('error:Export failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── IMPORT — pick file directly ───────────────────────────────────────────
  const handlePickFile = async () => {
    try {
      setLoading(true);
      setStatus('');
      const DocumentPicker = require('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) { setLoading(false); return; }
      const asset = result.assets[0];
      const FileSystem = require('expo-file-system');
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      processRestore(content);
    } catch (e) {
      setStatus('error:Could not read the file. Make sure it is a valid .json backup file.');
    } finally {
      setLoading(false);
    }
  };

  // ── RESTORE logic (shared by file pick and paste) ─────────────────────────
  const processRestore = (content) => {
    try {
      const parsed = JSON.parse(content.trim());
      if (parsed.version !== 'celestial_backup_v1' || !parsed.data) {
        setStatus('error:Invalid backup file. Make sure you selected the correct file.');
        return;
      }
      const d = parsed.data;
      const expCount = (d.expenses||[]).length;
      Alert.alert(
        'Restore Backup',
        'Found ' + expCount + ' expenses from ' + (parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString('en-IN') : 'unknown date') + '.\n\nThis will replace ALL your current data. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restore', style: 'destructive', onPress: () => {
            dispatch({ type: 'LOAD', state: {
              expenses:      d.expenses      || [],
              budget:        d.budget        || 15000,
              theme:         d.theme         || 'default',
              animLevel:     d.animLevel     || 'full',
              catBudgets:    d.catBudgets    || {},
              features:      d.features      || {},
              featEntries:   d.featEntries   || {},
              bills:         d.bills         || [],
              recurring:     d.recurring     || [],
              savedInsights: d.savedInsights || [],
              pin:           d.pin           || null,
              biometric:     d.biometric     || false,
              lockDelay:     d.lockDelay     || 'immediate',
            }});
            setSaved(true);
            setStatus('success:' + expCount + ' expenses restored successfully! All your data is back.');
            setTimeout(() => onClose(), 2000);
          }},
        ]
      );
    } catch (e) {
      setStatus('error:Could not read backup. The file may be corrupted or incomplete.');
    }
  };

  const isSuccess = status.startsWith('success:');
  const statusMsg = status.replace(/^(success|error):/, '');

  return (
    <SlideScreen onClose={onClose} zIndex={90} T={T} animLevel={animLevel}>
      {close => (
        <>
          <View style={[styles.detailHero, { backgroundColor: T.grad1 + '22' }]}>
            <TouchableOpacity onPress={close} style={styles.backBtn}>
              <Text style={{ color: T.text, fontSize: 18 }}>←</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>☁️</Text>
            <Text style={[styles.detailTitle, { color: T.text }]}>Backup & Restore</Text>
            <Text style={{ color: T.sub, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
              Keep your data safe across devices
            </Text>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

            {/* EXPORT */}
            <View style={{ backgroundColor: T.surface, borderRadius: 18, padding: 16, marginBottom: 14 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:10 }}>
                <View style={{ width:44, height:44, borderRadius:14, backgroundColor:'#2ECC8A22', alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ fontSize:22 }}>📤</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ color:T.text, fontSize:14, fontWeight:'700' }}>Export Backup</Text>
                  <Text style={{ color:T.sub, fontSize:11, marginTop:2 }}>
                    {state.expenses.length} expenses · {(state.recurring||[]).length} recurring · {(state.bills||[]).length} bills
                  </Text>
                </View>
              </View>
              <Text style={{ color:T.sub, fontSize:12, lineHeight:18, marginBottom:12 }}>
                Saves all your data as a .json file. Share to Google Drive, WhatsApp, Gmail — anywhere you like.
              </Text>
              <TouchableOpacity onPress={handleExport} disabled={loading}
                style={{ backgroundColor:'#2ECC8A', borderRadius:13, padding:14, alignItems:'center', opacity: loading ? 0.7 : 1 }}>
                <Text style={{ color:'#fff', fontSize:14, fontWeight:'700' }}>
                  {loading ? 'Preparing...' : '📤 Share Backup File'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* IMPORT */}
            <View style={{ backgroundColor: T.surface, borderRadius: 18, padding: 16, marginBottom: 14 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:10 }}>
                <View style={{ width:44, height:44, borderRadius:14, backgroundColor: T.grad1+'22', alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ fontSize:22 }}>📥</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ color:T.text, fontSize:14, fontWeight:'700' }}>Restore from File</Text>
                  <Text style={{ color:T.sub, fontSize:11, marginTop:2 }}>Pick your backup .json file</Text>
                </View>
              </View>
              <Text style={{ color:T.sub, fontSize:12, lineHeight:18, marginBottom:12 }}>
                Opens your file manager so you can select your backup file directly. No copying or pasting needed.
              </Text>
              <TouchableOpacity onPress={handlePickFile} disabled={loading || saved}
                style={{ backgroundColor: saved ? '#4CAF50' : T.grad1, borderRadius:13, padding:14, alignItems:'center', opacity: loading ? 0.7 : 1 }}>
                <Text style={{ color:'#fff', fontSize:14, fontWeight:'700' }}>
                  {saved ? '✓ Restored!' : loading ? 'Reading file...' : '📂 Pick Backup File'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Status message */}
            {statusMsg ? (
              <View style={{ backgroundColor: isSuccess ? '#2ECC8A22' : '#FF6B6B22',
                borderRadius:13, padding:12, marginBottom:14, borderWidth:1,
                borderColor: isSuccess ? '#2ECC8A44' : '#FF6B6B44' }}>
                <Text style={{ color: isSuccess ? '#2ECC8A' : '#FF6B6B', fontSize:13, textAlign:'center', lineHeight:18 }}>
                  {isSuccess ? '✅ ' : '❌ '}{statusMsg}
                </Text>
              </View>
            ) : null}

            {/* How to */}
            <View style={{ backgroundColor: T.surface, borderRadius:18, padding:16 }}>
              <Text style={{ color:T.text, fontSize:13, fontWeight:'700', marginBottom:10 }}>
                How to transfer to a new device
              </Text>
              {[
                'On your old device tap "Share Backup File"',
                'Save the .json file to Google Drive, WhatsApp yourself, or email it',
                'On your new device install the app and open Backup & Restore',
                'Tap "Pick Backup File" and select the file you saved',
                'Confirm restore — all your data will be back instantly',
              ].map((step, i) => (
                <View key={i} style={{ flexDirection:'row', gap:10, marginBottom:8, alignItems:'flex-start' }}>
                  <View style={{ width:22, height:22, borderRadius:11, backgroundColor: T.grad1+'28', alignItems:'center', justifyContent:'center', marginTop:1 }}>
                    <Text style={{ color:T.accent, fontSize:11, fontWeight:'700' }}>{i+1}</Text>
                  </View>
                  <Text style={{ color:T.sub, fontSize:12, flex:1, lineHeight:18 }}>{step}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}
    </SlideScreen>
  );
}

// ─── SETTINGS SCREEN ──────────────────────────────────────────────────────────
function SettingsScreen({ state, dispatch, T, animLevel, onRecurring, onSubscriptions, onTaxSummary, onBackup }) {
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

      {/* Smart Tools */}
      <TouchableOpacity onPress={onBackup}
        style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: T.surface, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#2ECC8A33' }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#2ECC8A22', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>☁️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>Backup & Restore</Text>
          <Text style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>Save or transfer your data</Text>
        </View>
        <Text style={{ color: T.sub, fontSize: 20 }}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onRecurring}
        style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: T.surface, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: T.accent + '33' }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.grad1 + '28', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>🔁</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>Recurring Expenses</Text>
          <Text style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>Rent, subscriptions, EMIs — auto-logged</Text>
        </View>
        <Text style={{ color: T.sub, fontSize: 20 }}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onSubscriptions}
        style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: T.surface, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: T.accent + '33' }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#9C27B0' + '28', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>📱</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>Subscriptions</Text>
          <Text style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>Track your monthly subscriptions</Text>
        </View>
        <Text style={{ color: T.sub, fontSize: 20 }}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onTaxSummary}
        style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: T.surface, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: T.accent + '33' }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#8BC34A' + '28', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>📊</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>Tax Summary</Text>
          <Text style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>80C, HRA & deduction tracker</Text>
        </View>
        <Text style={{ color: T.sub, fontSize: 20 }}>›</Text>
      </TouchableOpacity>

      {/* Appearance */}
      <View style={styles.settingSection}>
        <Text style={[styles.settingHeader, { color: T.accent }]}>APPEARANCE</Text>
        <View style={[styles.settingCard, { backgroundColor: T.surface }]}>
          <Text style={{ color: T.sub, fontSize: 10, marginBottom: 10 }}>THEME</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {[['default', '🌑 Default'], ['amoled', '⬛ AMOLED'], ['glass', '🪟 Glass'], ['white', '🤍 White Magic'], ['dark', '🖤 AMOLED Magic']].map(([key, label]) => (
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
          {state.pin && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: T.sub, fontSize: 12, marginBottom: 8 }}>Lock after minimising</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[['immediate','Immediately'],['2min','2 Minutes'],['5min','5 Minutes'],['never','Never']].map(([k,l]) => (
                  <TouchableOpacity key={k} onPress={() => dispatch({ type:'SET_LOCK_DELAY', v:k })}
                    style={{ paddingHorizontal:14, paddingVertical:8, borderRadius:99, backgroundColor: (state.lockDelay||'immediate')===k ? T.grad1 : T.surface2 }}>
                    <Text style={{ color: (state.lockDelay||'immediate')===k ? '#fff' : T.sub, fontSize:12, fontWeight:(state.lockDelay||'immediate')===k?'700':'400' }}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
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
      {/* Lock animation */}
      <LottieView
        source={require('./lottie-lock.json')}
        autoPlay loop
        style={{ width: 200, height: 150, marginBottom: 8 }}
        speed={0.9}
      />
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
// ─── PARTICLE BURST (Lottie — fires when expense is added) ──────────────────
function ParticleBurst({ onDone }) {
  return (
    <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'center', zIndex:999 }} pointerEvents="none">
      <LottieView
        source={require('./lottie-shapes.json')}
        autoPlay loop={false}
        style={{ width: 320, height: 320 }}
        speed={1.4}
        colorFilters={[{keypath:'**',color:'#B985FA'}]}
        onAnimationFinish={onDone}
      />
    </View>
  );
}


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
  const [burst,         setBurst]         = useState(null);
  const [singularity,   setSingularity]   = useState(false);
  const breathAnim = useRef(new Animated.Value(0)).current; // {color} when a new expense is added
  const [showRecurring,     setShowRecurring]     = useState(false);
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const [showTaxSummary,    setShowTaxSummary]    = useState(false);
  const [showBackup,        setShowBackup]        = useState(false);

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

  // ── Auto-apply recurring expenses on load ────────────────────────────────
  useEffect(() => {
    const today = todayStr();
    (state.recurring || []).forEach(r => {
      const lastApplied = r.lastApplied || '';
      let isDue = false;
      if (r.freq === 'daily')        isDue = lastApplied !== today;
      else if (r.freq === 'weekly')  isDue = !lastApplied || (new Date(today) - new Date(lastApplied)) / 86400000 >= 7;
      else if (r.freq === 'monthly') isDue = !lastApplied || lastApplied.slice(0,7) !== today.slice(0,7);
      if (isDue) {
        dispatch({ type: 'ADD', payload: { id: Date.now() + Math.random(), title: r.title, amount: r.amount, category: r.category, date: today, note: '🔁 Recurring', payment: r.payment || 'UPI' } });
        dispatch({ type: 'EDIT_RECURRING', item: { ...r, lastApplied: today } });
      }
    });
  }, []);

  // ── Breathing animation for glass theme ──────────────────────────────────
  useEffect(() => {
    if (state.theme !== 'glass' || state.animLevel === 'none') {
      breathAnim.setValue(0);
      return;
    }
    const pct   = (() => {
      const mEx = state.expenses.filter(e => monthOf(e.date) === curMonth());
      const sp  = mEx.reduce((a,e) => a+e.amount, 0);
      return state.budget > 0 ? sp / state.budget : 0;
    })();
    // Period: calm=4s, warn=2s, danger=0.9s based on budget usage
    const period = pct > 0.9 ? 900 : pct > 0.75 ? 2000 : 4000;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue:1, duration:period/2, easing:Easing.inOut(Easing.sin), useNativeDriver:true }),
        Animated.timing(breathAnim, { toValue:0, duration:period/2, easing:Easing.inOut(Easing.sin), useNativeDriver:true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state.theme, state.animLevel, state.expenses.length, state.budget]);

  // ── Lock on minimize ──────────────────────────────────────────────────────
  const bgTime = useRef(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (!state.pin) return;
      if (nextState === 'background' || nextState === 'inactive') {
        bgTime.current = Date.now();
      } else if (nextState === 'active' && bgTime.current) {
        const elapsed = (Date.now() - bgTime.current) / 1000; // seconds
        const delay = state.lockDelay || 'immediate';
        let threshold = 0;
        if (delay === '2min')  threshold = 120;
        if (delay === '5min')  threshold = 300;
        if (delay === 'never') threshold = Infinity;
        if (elapsed >= threshold) setLocked(true);
        bgTime.current = null;
      }
    });
    return () => sub.remove();
  }, [state.pin, state.lockDelay]);

  const handleNav    = t  => { if (t === 'add') { setFormEx(null); setShowForm(true); return; } setTab(t); };
  const handleRow    = e  => { setDetailEx(e); setShowDetail(true); };
  const handleEdit   = e  => { setFormEx(e); setShowForm(true); };
  const handleDelete = id => {
    setSingularity(true);
    setTimeout(() => {
      dispatch({ type: 'DELETE', id });
      setShowDetail(false);
      setSingularity(false);
    }, 850);
  };
  const handleSave   = p  => {
    if (p.id) {
      dispatch({ type: 'EDIT', payload: p });
    } else {
      dispatch({ type: 'ADD', payload: p });
      // Fire particle burst in the category colour
      setBurst({ id: Date.now() });
    }
  };

  const handleSaveInsights = insightsBatch => {
    const now = new Date();
    const wk = now.getFullYear() + '-W' + String(Math.ceil(now.getDate()/7)).padStart(2,'0') + '-' + String(now.getMonth()+1).padStart(2,'0');
    const mk = now.toISOString().slice(0,7);
    const qk = now.getFullYear() + '-Q' + Math.ceil((now.getMonth()+1)/3);
    const yk = String(now.getFullYear());
    const already = (state.savedInsights||[]).some(s => s.weekKey === wk && s.savedAt === todayStr());
    if (!already) insightsBatch.forEach(ins => dispatch({ type:'SAVE_INSIGHT', insight:{ ...ins, weekKey:wk, monthKey:mk, quarterKey:qk, yearKey:yk, savedAt:todayStr() } }));
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
      {tab === 'home' && <HomeScreen state={state} dispatch={dispatch} onRow={handleRow} onEdit={handleEdit} onDelete={handleDelete} onQuickAdd={() => { setFormEx(null); setShowForm(true); }} T={T} animLevel={aL} collapsed={homeCollapsed} setCollapsed={setHomeCollapsed} onSaveInsights={handleSaveInsights} breathAnim={breathAnim} />}
      {burst && <ParticleBurst key={burst.id} onDone={() => setBurst(null)} />}
      {singularity && <SingularityDelete key={Date.now()} onDone={() => setSingularity(false)} />}
      {tab === 'stats'    && <StatsScreen    expenses={state.expenses} featEntries={state.featEntries} bills={state.bills||[]} savedInsights={state.savedInsights||[]} dispatch={dispatch} T={T} animLevel={aL} selCat={statsCat} setSelCat={setStatsCat} onEditExpense={e => { setFormEx(e); setShowForm(true); }} />}
      {tab === 'history'  && <HistoryScreen  expenses={state.expenses} onRow={handleRow} T={T} animLevel={aL} />}
      {tab === 'more'     && <MoreScreen     features={state.features} featEntries={state.featEntries} dispatch={dispatch} expenses={state.expenses} T={T} animLevel={aL} collapsed={moreCollapsed} setCollapsed={setMoreCollapsed} />}
      {tab === 'settings' && <SettingsScreen state={state} dispatch={dispatch} T={T} animLevel={aL} onRecurring={() => setShowRecurring(true)} onSubscriptions={() => setShowSubscriptions(true)} onTaxSummary={() => setShowTaxSummary(true)} onBackup={() => setShowBackup(true)} />}
      {showSubscriptions && (
        <SlideScreen onClose={() => setShowSubscriptions(false)} zIndex={85} T={T} animLevel={aL}>
          {_close => (<>
          <SubscriptionScreen recurring={state.recurring||[]} expenses={state.expenses} T={T} />
          </>)}
        </SlideScreen>
      )}
      {showTaxSummary && (
        <SlideScreen onClose={() => setShowTaxSummary(false)} zIndex={85} T={T} animLevel={aL}>
          {_close => (<>
          <TaxSummaryScreen featEntries={state.featEntries} T={T} />
          </>)}
        </SlideScreen>
      )}
      {showBackup && <BackupScreen state={state} dispatch={dispatch} T={T} animLevel={aL} onClose={() => setShowBackup(false)} />}
      {showRecurring && (
        <SlideScreen onClose={() => setShowRecurring(false)} zIndex={85} T={T} animLevel={aL}>
          {_close => (<>
          <RecurringScreen recurring={state.recurring||[]} dispatch={dispatch} T={T} animLevel={aL} />
          </>)}
        </SlideScreen>
      )}
      <BottomNav tab={tab} onChange={handleNav} T={T} animLevel={aL} />
      {showDetail && detailEx && <DetailScreen expense={detailEx} onClose={() => setShowDetail(false)} onDelete={handleDelete} onEdit={handleEdit} T={T} animLevel={aL} />}
      {showForm && <FormScreen existing={formEx} onSave={handleSave} onClose={() => setShowForm(false)} T={T} animLevel={aL} />}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:           { flex: 1, overflow: 'hidden' },
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
