<template>
  <div :class="['billboard-page', { tv: isTV }]" id="billboard-root">
    <div class="topbar" v-if="!isTV">
      <h1>Billboard</h1>
      <div class="controls">
        <button @click="popOut">Pop Out</button>
        <label>Refresh:
          <input type="number" v-model.number="refreshSec" min="5" style="width:72px" />
        </label>
      </div>
    </div>

    <BillboardTicker :items="tickerItems" />

    <div class="cards-and-meter">
      <BillboardCards :data="summary" />
      <WeekCompareMeter :percent="summary?.weekCompare?.percent" />
    </div>

    <div class="last-updated">Last updated: {{ summary?.lastUpdated || '—' }}</div>
  </div>
</template>

<script>
import BillboardTicker from '../components/BillboardTicker.vue';
import BillboardCards from '../components/BillboardCards.vue';
import WeekCompareMeter from '../components/WeekCompareMeter.vue';

const DEFAULT_REFRESH = Number(process.env.BILLBOARD_REFRESH_SEC) || 30;
const TARGET_W = 1920;
const TARGET_H = 1080;

export default {
  name: 'BillboardPage',
  components: { BillboardTicker, BillboardCards, WeekCompareMeter },
  data() {
    return {
      summary: null,
      timer: null,
      refreshSec: DEFAULT_REFRESH,
      isTV: false
    };
  },
  computed: {
    tickerItems() {
      if (!this.summary) return [];
      const s = this.summary.serviceTracking || {};
      const d = this.summary.deliveryTickets || {};
      const w = this.summary.weekCompare || {};
      return [
        `COMPLETED: ${s.completed ?? '—'}`,
        `SCHEDULED: ${s.scheduled ?? '—'}`,
        `IN PROGRESS: ${s.inProgress ?? '—'}`,
        `CANCELED: ${s.canceled ?? '—'}`,
        `TICKETS: ${d.tickets ?? '—'}`,
        `GALLONS: ${d.gallons !== null && d.gallons !== undefined ? d.gallons.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1}) : '—'}`,
        `REV: $${d.revenue !== null && d.revenue !== undefined ? d.revenue.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) : '—'}`,
        `TW vs LW: ${w.percent !== undefined && w.percent !== null ? w.percent.toFixed(1) + '%' : '—'}`
      ];
    }
  },
  created() {
    const urlParams = new URLSearchParams(window.location.search);
    const tv = urlParams.get('tv');
    if (tv === '1') {
      this.isTV = true;
      // attempt fullscreen after load (may be blocked by browser)
      window.addEventListener('load', () => {
        this.applyScale(); // initial scale
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(()=>{/* ignore */});
        }
      });
      window.addEventListener('resize', this.applyScale);
    }
    const refreshParam = urlParams.get('refresh');
    if (refreshParam) this.refreshSec = Number(refreshParam) || this.refreshSec;
    this.load();
    this.startPolling();
  },
  beforeUnmount() {
    this.stopPolling();
    window.removeEventListener('resize', this.applyScale);
  },
  methods: {
    async load() {
      try {
        const r = await fetch('/api/billboard-summary');
        if (!r.ok) throw new Error('fetch failed');
        this.summary = await r.json();
      } catch (e) {
        console.error('Billboard fetch error', e);
      }
    },
    startPolling() {
      this.stopPolling();
      this.timer = setInterval(() => this.load(), (this.refreshSec || DEFAULT_REFRESH) * 1000);
    },
    stopPolling() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },
    popOut() {
      // Choose window size not larger than the available screen.
      const availW = window.screen && window.screen.availWidth ? window.screen.availWidth : window.innerWidth;
      const availH = window.screen && window.screen.availHeight ? window.screen.availHeight : window.innerHeight;

      const w = Math.min(TARGET_W, availW);
      const h = Math.min(TARGET_H, availH);

      // center window
      const left = Math.max(0, Math.floor((availW - w) / 2));
      const top = Math.max(0, Math.floor((availH - h) / 2));

      const features = `width=${w},height=${h},left=${left},top=${top},toolbar=0,location=0,menubar=0,scrollbars=0,resizable=1`;
      const win = window.open('/billboard?tv=1', 'BillboardTV', features);

      // If popup succeeded, try to transfer size info & request focus
      if (win) {
        try {
          win.focus();
          // set a small flag; the opened page computes scale itself
          win.billboardOpener = true;
        } catch (e) {
          // ignore cross-origin or focus failures
        }
      } else {
        alert('Pop-out blocked by browser. Allow pop-ups for this site or open /billboard?tv=1 manually.');
      }
    },
    applyScale() {
      // Only run in TV mode
      if (!this.isTV) return;
      const winW = window.innerWidth || screen.width || TARGET_W;
      const winH = window.innerHeight || screen.height || TARGET_H;
      const scale = Math.min(1, winW / TARGET_W, winH / TARGET_H);
      // set CSS variable used by stylesheet
      document.documentElement.style.setProperty('--bb-scale', String(scale));
    }
  },
  watch: {
    refreshSec() {
      this.startPolling();
    }
  }
};
</script>

<style src="../styles/billboard.css"></style>