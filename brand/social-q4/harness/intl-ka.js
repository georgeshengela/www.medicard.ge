// Chromium ships no Georgian ICU data: Intl for 'ka' falls back to the root locale ("2026 M09 19", "Sat", "1,240").
// The phone (JSC/Hermes on iOS, full ICU) prints Georgian. This init script gives 'ka*' locales CLDR-like
// Georgian dates and numbers so web screenshots read like the device. Other locales are untouched.
(() => {
  const OrigDTF = Intl.DateTimeFormat;
  const OrigNF = Intl.NumberFormat;
  const MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  const MONTHS_SHORT = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  const DAYS = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
  const DAYS_SHORT = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
  const DAYS_NARROW = ['კ', 'ო', 'ს', 'ო', 'ხ', 'პ', 'შ'];
  const first = (l) => (Array.isArray(l) ? l[0] : l);
  const isKa = (locales) => {
    const l = first(locales);
    const tag = l == null ? navigator.language || '' : String(l);
    return /^ka(\b|-|_|$)/i.test(tag);
  };
  const pad = (n) => String(n).padStart(2, '0');
  const fields = ['weekday', 'era', 'year', 'month', 'day', 'hour', 'minute', 'second', 'dayPeriod', 'fractionalSecondDigits', 'timeZoneName'];

  function KaDTF(locales, options = {}) {
    const o = { ...(options || {}) };
    const tz = o.timeZone;
    const probe = new OrigDTF('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
    const ds = o.dateStyle, ts = o.timeStyle;
    let want = { ...o };
    if (ds || ts) {
      want = {};
      if (ds === 'full') Object.assign(want, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (ds === 'long') Object.assign(want, { day: 'numeric', month: 'long', year: 'numeric' });
      if (ds === 'medium') Object.assign(want, { day: 'numeric', month: 'short', year: 'numeric' });
      if (ds === 'short') Object.assign(want, { day: '2-digit', month: '2-digit', year: '2-digit' });
      if (ts) Object.assign(want, { hour: '2-digit', minute: '2-digit' }, ts === 'medium' || ts === 'long' || ts === 'full' ? { second: '2-digit' } : {});
    }
    this._want = want;
    this._probe = probe;
    this._opts = o;
  }
  KaDTF.prototype._values = function (date) {
    const d = date === undefined ? new Date() : new Date(date);
    const parts = this._probe.formatToParts(d);
    const g = (t) => parts.find((p) => p.type === t)?.value;
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
    return { year: Number(g('year')), month: Number(g('month')) - 1, day: Number(g('day')), weekday: wd, hour: Number(g('hour')) % 24, minute: Number(g('minute')), second: Number(g('second')) };
  };
  KaDTF.prototype.formatToParts = function (date) {
    const w = this._want, v = this._values(date), out = [];
    const lit = (value) => out.push({ type: 'literal', value });
    const has = (k) => w[k] !== undefined;
    const anyDate = has('year') || has('month') || has('day') || has('weekday');
    const anyTime = has('hour') || has('minute') || has('second');
    const useDefault = !anyDate && !anyTime;
    const W = useDefault ? { year: 'numeric', month: 'numeric', day: 'numeric' } : w;
    const wk = W.weekday ? (W.weekday === 'long' ? DAYS : W.weekday === 'short' ? DAYS_SHORT : DAYS_NARROW)[v.weekday] : null;
    const textMonth = W.month === 'long' || W.month === 'short' || W.month === 'narrow';
    if (W.year || W.month || W.day || W.weekday) {
      if (textMonth) {
        if (wk) { out.push({ type: 'weekday', value: wk }); if (W.day || W.month) lit(', '); }
        if (W.day) { out.push({ type: 'day', value: W.day === '2-digit' ? pad(v.day) : String(v.day) }); lit(' '); }
        out.push({ type: 'month', value: W.month === 'long' ? MONTHS[v.month] : W.month === 'narrow' ? MONTHS[v.month][0] : `${MONTHS_SHORT[v.month]}${W.day || W.year ? '.' : ''}` });
        if (W.year) { lit(W.month === 'long' ? ', ' : ' '); out.push({ type: 'year', value: W.year === '2-digit' ? pad(v.year % 100) : String(v.year) }); }
      } else if (W.month || W.day || W.year) {
        if (wk) { out.push({ type: 'weekday', value: wk }); lit(', '); }
        const seq = [];
        if (W.day) seq.push({ type: 'day', value: W.day === 'numeric' && !W.month ? String(v.day) : pad(v.day) });
        if (W.month) seq.push({ type: 'month', value: pad(v.month + 1) });
        if (W.year) seq.push({ type: 'year', value: W.year === '2-digit' ? pad(v.year % 100) : String(v.year) });
        seq.forEach((p, i) => { if (i) lit('.'); out.push(p); });
      } else if (wk) out.push({ type: 'weekday', value: wk });
    }
    if (W.hour || W.minute || W.second) {
      if (out.length) lit(', ');
      const t = [];
      if (W.hour) t.push({ type: 'hour', value: pad(v.hour) });
      if (W.minute) t.push({ type: 'minute', value: pad(v.minute) });
      if (W.second) t.push({ type: 'second', value: pad(v.second) });
      t.forEach((p, i) => { if (i) lit(':'); out.push(p); });
    }
    return out;
  };
  KaDTF.prototype.format = function (date) { return this.formatToParts(date).map((p) => p.value).join(''); };
  KaDTF.prototype.formatRange = function (a, b) { return `${this.format(a)} – ${this.format(b)}`; };
  KaDTF.prototype.resolvedOptions = function () {
    const r = this._probe.resolvedOptions();
    const o = { locale: 'ka-GE', calendar: 'gregory', numberingSystem: 'latn', timeZone: r.timeZone, hourCycle: 'h23', hour12: false };
    for (const k of fields) if (this._want[k] !== undefined) o[k] = this._want[k];
    return o;
  };

  function DTF(locales, options) {
    if (isKa(locales)) return new KaDTF(locales, options);
    return new OrigDTF(locales, options);
  }
  DTF.prototype = OrigDTF.prototype;
  DTF.supportedLocalesOf = OrigDTF.supportedLocalesOf;
  Intl.DateTimeFormat = DTF;

  const dateDefaults = (o, kind) => {
    const opts = { ...(o || {}) };
    const hasDate = ['weekday', 'year', 'month', 'day', 'dateStyle'].some((k) => opts[k] !== undefined);
    const hasTime = ['hour', 'minute', 'second', 'timeStyle'].some((k) => opts[k] !== undefined);
    if (!hasDate && !hasTime) {
      if (kind !== 'time') Object.assign(opts, { year: 'numeric', month: 'numeric', day: 'numeric' });
      if (kind !== 'date') Object.assign(opts, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return opts;
  };
  const dp = Date.prototype;
  const origDate = dp.toLocaleDateString, origTime = dp.toLocaleTimeString, origStr = dp.toLocaleString;
  dp.toLocaleDateString = function (l, o) { return isKa(l) ? new KaDTF(l, dateDefaults(o, 'date')).format(this) : origDate.call(this, l, o); };
  dp.toLocaleTimeString = function (l, o) { return isKa(l) ? new KaDTF(l, dateDefaults(o, 'time')).format(this) : origTime.call(this, l, o); };
  dp.toLocaleString = function (l, o) { return isKa(l) ? new KaDTF(l, dateDefaults(o, 'both')).format(this) : origStr.call(this, l, o); };

  // Numbers: Georgian groups with a no-break space and uses a decimal comma.
  function KaNF(locales, options) { this._inner = new OrigNF('en-US', options); }
  KaNF.prototype.formatToParts = function (n) {
    return this._inner.formatToParts(n).map((p) => (p.type === 'group' ? { ...p, value: ' ' } : p.type === 'decimal' ? { ...p, value: ',' } : p));
  };
  KaNF.prototype.format = function (n) { return this.formatToParts(n).map((p) => p.value).join(''); };
  KaNF.prototype.resolvedOptions = function () { return { ...this._inner.resolvedOptions(), locale: 'ka-GE' }; };
  function NF(locales, options) {
    if (isKa(locales)) return new KaNF(locales, options);
    return new OrigNF(locales, options);
  }
  NF.prototype = OrigNF.prototype;
  NF.supportedLocalesOf = OrigNF.supportedLocalesOf;
  Intl.NumberFormat = NF;
  const origNum = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function (l, o) { return isKa(l) ? new KaNF(l, o).format(Number(this)) : origNum.call(this, l, o); };
})();
