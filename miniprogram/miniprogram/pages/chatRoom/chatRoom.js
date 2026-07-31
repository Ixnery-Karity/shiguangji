// 聊天会话 + 撮合交易闭环
// v0.3.0：接入云端真实会话 —— messages 集合 watch 实时监听、tradeConfirm 云函数双向确认。
//         云环境未就绪时自动回退演示模式（本地对话 + 模拟对方确认），保证零配置可跑通。
const app = getApp();
const db = require('../../utils/db');
const { toast } = require('../../utils/util');

Page({
  data: {
    itemId: '', itemTitle: '', price: '', seller: '', sellerAvatar: '👦',
    messages: [],
    draft: '',
    scrollTo: 'bottom',
    live: false,            // true = 云端实时会话；false = 演示模式
    role: 'buyer',          // 当前用户在本交易中的角色
    // 交易状态
    tradeStatus: '',        // '' 未发起 / '待完成' / '已完成'
    tradeStatusText: '',
    buyerDone: false, sellerDone: false,
    dealBtnText: '发起交易',
    _msgId: 0
  },

  async onLoad(q) {
    this.setData({
      itemId: q.itemId || '',
      itemTitle: decodeURIComponent(q.title || '商品'),
      price: q.price || '',
      seller: decodeURIComponent(q.seller || '卖家')
    });
    this._sellerId = q.sellerId || '';
    this._chatId = q.chatId || '';
    this._tradeId = '';
    wx.setNavigationBarTitle({ title: this.data.seller });

    const live = await this.initLive();
    if (!live) this.initDemo();
  },

  // ===== 云端实时会话 =====
  async initLive() {
    if (!db.hasCloud() || !app.globalData.openid) return false;

    // 会话：从消息列表进入时已带 chatId；从商品详情进入时按商品获取/创建
    if (!this._chatId) {
      const chat = await db.getOrCreateChat({
        itemId: this.data.itemId, itemTitle: this.data.itemTitle,
        price: this.data.price, sellerId: this._sellerId, sellerName: this.data.seller
      });
      if (!chat) return false;
      this._chatId = chat._id;
      if (!this._sellerId) this._sellerId = chat.sellerId || '';
    }

    const me = app.globalData.openid;
    this.setData({ live: true, role: me === this._sellerId ? 'seller' : 'buyer' });

    // 进入会话：清零我的未读数（v0.4.0）
    db.clearUnread(this._chatId, this.data.role);

    // 历史消息 + 实时监听（watch 首次快照即含全量，直接以快照为准渲染）
    this._msgWatcher = db.watchMessages(this._chatId, (docs) => {
      const messages = docs.map(m => ({
        id: m._id, content: m.content, me: m.from === me, type: m.type || 'text'
      }));
      this.setData({ messages, scrollTo: 'bottom' });
      // 在会话内收到新消息即视为已读（v0.4.0）
      const hasIncoming = docs.some(m => m.from !== me);
      if (hasIncoming) db.clearUnread(this._chatId, this.data.role);
    });
    if (!this._msgWatcher) {
      const docs = await db.listMessages(this._chatId);
      const messages = docs.map(m => ({
        id: m._id, content: m.content, me: m.from === me, type: m.type || 'text'
      }));
      this.setData({ messages, scrollTo: 'bottom' });
    }

    // 恢复该商品下与我相关的交易状态
    const trade = await db.getTrade({ itemId: this.data.itemId });
    if (trade) this.applyTrade(trade);
    return true;
  },

  // 把云端交易文档同步到界面
  applyTrade(t) {
    this._tradeId = t._id || this._tradeId;
    const done = t.status === '已完成';
    this.setData({
      tradeStatus: t.status,
      tradeStatusText: done ? '交易已完成' : '待双方线下当面完成',
      buyerDone: !!t.buyerDone, sellerDone: !!t.sellerDone,
      dealBtnText: done ? '已完成' : '查看交易'
    });
    if (done && !this._celebrated) {
      this._celebrated = true;
      toast('交易完成', 'success');
    }
    // 监听交易变化：对方确认后本端实时刷新
    if (!done && !this._tradeWatcher && this._tradeId) {
      this._tradeWatcher = db.watchTrade(this._tradeId, (doc) => this.applyTrade(doc));
    }
  },

  // ===== 演示模式（无云环境） =====
  initDemo() {
    this.pushMsg('你好，这个还在吗？', true);
    this.pushMsg('在的，诚心可小刀，校内当面交易~', false);
  },

  onDraft(e) { this.setData({ draft: e.detail.value }); },

  pushMsg(content, me, type = 'text') {
    const id = ++this.data._msgId;
    const messages = this.data.messages.concat([{ id, content, me, type }]);
    this.setData({ messages, _msgId: id, scrollTo: 'bottom' });
  },

  async send() {
    const text = this.data.draft.trim();
    if (!text) return;
    this.setData({ draft: '' });

    if (this.data.live) {
      try {
        await db.sendMessage({ chatId: this._chatId, content: text });
        // 渲染交给 watch 快照；watch 不可用时手动补一条
        if (!this._msgWatcher) this.pushMsg(text, true);
      } catch (e) {
        toast('发送失败，请重试');
        this.setData({ draft: text });
      }
      return;
    }
    // 演示：对方自动回一句
    this.pushMsg(text, true);
    setTimeout(() => this.pushMsg('好的，没问题 👌', false), 800);
  },

  // 顶部按钮：发起 / 查看交易
  onTradeAction() {
    if (!this.data.tradeStatus) this.startTrade();
    else this.setData({ scrollTo: 'tradeCard' });
  },

  // 发起交易
  async startTrade() {
    if ((app.globalData.authLevel || 0) < 2) {
      wx.showModal({
        title: '需要学生认证', content: '发起交易前请先完成学生认证',
        confirmText: '去认证',
        success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/auth/auth' }); }
      });
      return;
    }

    if (this.data.live) {
      const r = await db.createTrade({
        itemId: this.data.itemId, itemTitle: this.data.itemTitle,
        price: Number(this.data.price) || 0,
        sellerId: this._sellerId, sellerName: this.data.seller, chatId: this._chatId
      }).catch(() => null);
      if (!r || !r.ok) { toast((r && r.msg) || '发起交易失败'); return; }
      this.applyTrade(r.trade || { _id: r.tradeId, status: '待完成', buyerDone: false, sellerDone: false });
      db.sendMessage({
        chatId: this._chatId, type: 'sys',
        content: '已发起当面交易，请线下一手交钱一手交货，完成后双方点「我已完成」'
      }).catch(() => {});
      this.setData({ scrollTo: 'tradeCard' });
      toast('已发起交易', 'success');
      return;
    }

    // 演示模式
    this.setData({
      tradeStatus: '待完成', tradeStatusText: '待双方线下当面完成',
      dealBtnText: '查看交易'
    });
    this.pushMsg('已发起当面交易，请线下一手交钱一手交货，完成后双方点「我已完成」', false, 'sys');
    this.setData({ scrollTo: 'tradeCard' });
    toast('已发起交易', 'success');
  },

  // 确认完成
  async confirmDone() {
    if (this.data.live) {
      const mineDone = this.data.role === 'buyer' ? this.data.buyerDone : this.data.sellerDone;
      if (mineDone) { toast('你已确认，等待对方'); return; }
      const r = await db.confirmTrade(this._tradeId).catch(() => null);
      if (!r || !r.ok) { toast((r && r.msg) || '确认失败，请重试'); return; }
      this.applyTrade({
        _id: this._tradeId, status: r.status,
        buyerDone: r.buyerDone, sellerDone: r.sellerDone
      });
      db.sendMessage({
        chatId: this._chatId, type: 'sys',
        content: (this.data.role === 'buyer' ? '买家' : '卖家') + '已确认完成交易'
      }).catch(() => {});
      if (r.status !== '已完成') toast('已确认，等待对方确认', 'success');
      return;
    }

    // 演示模式：对方（卖家）随后也确认
    if (this.data.buyerDone) { toast('你已确认，等待对方'); return; }
    this.setData({ buyerDone: true });
    this.pushMsg('买家已确认完成交易', false, 'sys');
    setTimeout(() => {
      this.setData({ sellerDone: true });
      this.pushMsg('卖家已确认完成交易', false, 'sys');
      this.finishTrade();
    }, 1200);
  },

  finishTrade() {
    this.setData({
      tradeStatus: '已完成', tradeStatusText: '交易已完成',
      dealBtnText: '已完成'
    });
    this.pushMsg('🎉 交易已完成，感谢使用拾光集！记得互相评价哦', false, 'sys');
    toast('交易完成', 'success');
  },

  onUnload() {
    if (this._msgWatcher) { try { this._msgWatcher.close(); } catch (e) {} }
    if (this._tradeWatcher) { try { this._tradeWatcher.close(); } catch (e) {} }
  }
});
