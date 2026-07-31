// 商品详情
const db = require('../../utils/db');
const { toast } = require('../../utils/util');

Page({
  data: {
    item: null, sellerInitial: '', faved: false,
    sellerItems: [],   // 卖家其他在售（v0.4.0）
    related: []        // 同分类推荐（v0.4.0）
  },

  onLoad(q) {
    this.itemId = q.id;
    this.load();
  },

  async load() {
    const item = await db.getItem(this.itemId);
    if (item) {
      // 兼容无 images 的情况
      if (!item.images || !item.images.length) item.images = [item.cover || '📦'];
      db.incView(this.itemId); // 浏览量 +1，异步不阻塞
    }
    this.setData({
      item,
      sellerInitial: item ? (item.sellerName || '匿').charAt(0) : ''
    });
    if (!item) return;

    // 收藏状态恢复 + 卖家在售 + 相关推荐，并行加载
    const [faved, sellerItems, related] = await Promise.all([
      db.isFaved(this.itemId),
      db.listSellerItems({ sellerId: item._openid || '', sellerName: item.sellerName || '', excludeId: this.itemId }),
      db.listRelated({ category: item.category || '', excludeId: this.itemId })
    ]);
    this.setData({ faved, sellerItems, related });
  },

  async onFav() {
    if (!this.data.item) return;
    const faved = await db.toggleFav(this.data.item);
    this.setData({ faved });
    toast(faved ? '已收藏' : '已取消收藏', 'success');
  },

  onReport() {
    wx.showActionSheet({
      itemList: ['虚假信息', '违禁品', '疑似诈骗', '其他'],
      success: () => toast('举报已提交，感谢反馈', 'success')
    });
  },

  // 跳转其他商品详情
  openItem(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },

  // 聊一聊 / 我想要 都进入聊天会话
  onChat() { this.goChat(); },
  onWant() { this.goChat(); },

  goChat() {
    const it = this.data.item;
    if (!it) return;
    let url = `/pages/chatRoom/chatRoom?itemId=${it._id}` +
              `&title=${encodeURIComponent(it.title)}` +
              `&price=${it.price}&seller=${encodeURIComponent(it.sellerName || '')}`;
    if (it._openid) url += `&sellerId=${it._openid}`; // 云端商品带卖家 openid，用于真实会话
    wx.navigateTo({ url });
  }
});
