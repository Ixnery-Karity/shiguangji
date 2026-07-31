// 首页
const db = require('../../utils/db');
const mock = require('../../utils/mock');
const app = getApp();

const HISTORY_KEY = 'searchHistory';
const SORTS = [
  { key: 'new', label: '最新' },
  { key: 'priceAsc', label: '价格↑' },
  { key: 'priceDesc', label: '价格↓' }
];

Page({
  data: {
    campus: 'A校区',
    categories: mock.CATEGORIES,
    category: '全部',
    conditions: mock.CONDITIONS,
    condition: '全部',
    sorts: SORTS,
    sort: 'new',
    keyword: '',
    hotWords: mock.HOT_WORDS,
    history: [],
    showSearchPanel: false,
    items: [],
    colLeft: [],
    colRight: [],
    loading: false,
    cloudReady: false
  },

  onLoad() {
    this.setData({
      cloudReady: db.hasCloud(),
      history: wx.getStorageSync(HISTORY_KEY) || []
    });
    this.load();
  },

  onShow() {
    // 从发布页返回时刷新
    if (this._needRefresh) { this._needRefresh = false; this.load(); }
    this.refreshBadge();
  },

  // 未读消息 tabBar 徽标（v0.4.0）
  async refreshBadge() {
    const openid = app.globalData.openid;
    if (!openid) return;
    const n = await db.unreadTotal(openid);
    if (n > 0) wx.setTabBarBadge({ index: 2, text: n > 99 ? '99+' : String(n), fail: () => {} });
    else wx.removeTabBarBadge({ index: 2, fail: () => {} });
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true });
    try {
      const items = await db.listItems({
        category: this.data.category, keyword: this.data.keyword,
        condition: this.data.condition, sort: this.data.sort
      });
      this.splitColumns(items);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 两列瀑布流分配
  splitColumns(items) {
    const colLeft = [], colRight = [];
    items.forEach((it, i) => (i % 2 === 0 ? colLeft : colRight).push(it));
    this.setData({ items, colLeft, colRight });
  },

  onCategory(e) {
    this.setData({ category: e.currentTarget.dataset.cat });
    this.load();
  },

  onSort(e) {
    this.setData({ sort: e.currentTarget.dataset.s });
    this.load();
  },

  onCondition(e) {
    this.setData({ condition: e.currentTarget.dataset.c });
    this.load();
  },

  // ===== 搜索：历史 + 热词（v0.4.0） =====
  onInput(e) { this.setData({ keyword: e.detail.value }); },

  onSearchFocus() { this.setData({ showSearchPanel: true }); },

  onSearch() {
    this.saveHistory(this.data.keyword.trim());
    this.setData({ showSearchPanel: false });
    this.load();
  },

  onTapWord(e) {
    const w = e.currentTarget.dataset.w;
    this.setData({ keyword: w, showSearchPanel: false });
    this.saveHistory(w);
    this.load();
  },

  onClearKeyword() {
    this.setData({ keyword: '', showSearchPanel: false });
    this.load();
  },

  saveHistory(word) {
    if (!word) return;
    let list = (wx.getStorageSync(HISTORY_KEY) || []).filter(w => w !== word);
    list.unshift(word);
    list = list.slice(0, 10);
    wx.setStorageSync(HISTORY_KEY, list);
    this.setData({ history: list });
  },

  onClearHistory() {
    wx.removeStorageSync(HISTORY_KEY);
    this.setData({ history: [] });
  },

  onClosePanel() { this.setData({ showSearchPanel: false }); }
});
