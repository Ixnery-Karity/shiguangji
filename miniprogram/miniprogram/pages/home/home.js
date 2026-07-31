// 首页
const db = require('../../utils/db');
const mock = require('../../utils/mock');

Page({
  data: {
    campus: 'A校区',
    categories: mock.CATEGORIES,
    category: '全部',
    keyword: '',
    items: [],
    colLeft: [],
    colRight: [],
    loading: false,
    cloudReady: false
  },

  onLoad() {
    this.setData({ cloudReady: db.hasCloud() });
    this.load();
  },

  onShow() {
    // 从发布页返回时刷新
    if (this._needRefresh) { this._needRefresh = false; this.load(); }
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true });
    try {
      const items = await db.listItems({
        category: this.data.category, keyword: this.data.keyword
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
  onInput(e) { this.setData({ keyword: e.detail.value }); },
  onSearch() { this.load(); }
});
