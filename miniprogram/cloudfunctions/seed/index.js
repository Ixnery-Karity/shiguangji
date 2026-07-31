// cloudfunctions/seed/index.js
// 一键初始化：创建集合并写入演示商品数据。
// 用法：在微信开发者工具「云开发」控制台或页面调用 wx.cloud.callFunction({name:'seed'})
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 与小程序端 utils/mock.js 保持一致的演示数据
const ITEMS = [
  { title: '高等数学 同济第七版 上册 九成新无笔记', desc: '正版教材，仅翻阅几次，无划线笔记，无缺页。毕业清仓，诚心可小刀，宿舍楼下当面交易。', price: 15, originPrice: 42, category: '教材', condition: '九成新', cover: '📘', images: ['📘','📗','📙'], location: '3号宿舍楼', sellerName: '王同学', sellerVerified: true, sellerCredit: '成交28笔·好评98%', status: '在售' },
  { title: '索尼降噪耳机 WH-1000XM4 自用无拆修', desc: '去年买的，音质降噪都很好，配件齐全，因换新出。支持当面验货。', price: 680, originPrice: 1899, category: '数码', condition: '九成新', cover: '🎧', images: ['🎧'], location: '图书馆', sellerName: '李同学', sellerVerified: true, sellerCredit: '成交12笔·好评100%', status: '在售' },
  { title: '通勤自行车 捷安特 可议价', desc: '骑了一年，车况良好，刹车灵敏。毕业不带走了，校内自提。', price: 220, originPrice: 600, category: '生活', condition: '七成新', cover: '🚲', images: ['🚲'], location: '东门', sellerName: '张同学', sellerVerified: true, sellerCredit: '成交5笔·好评95%', status: '在售' },
  { title: '全新口红 色号#12 未拆封', desc: '买多了，全新未拆，专柜正品。可当面看。', price: 60, originPrice: 320, category: '美妆', condition: '全新', cover: '💄', images: ['💄'], location: '5号宿舍楼', sellerName: '陈同学', sellerVerified: true, sellerCredit: '成交9笔·好评97%', status: '在售' },
  { title: 'ThinkPad X1 i5 办公够用', desc: '轻薄本，办公写代码够用，电池健康度良好。可当面开机验机。', price: 2100, originPrice: 6999, category: '数码', condition: '八成新', cover: '💻', images: ['💻'], location: '研究生公寓', sellerName: '赵同学', sellerVerified: true, sellerCredit: '成交3笔·好评100%', status: '在售' },
  { title: '考研英语真题 全套+笔记', desc: '考研上岸出，真题全套加手写笔记，祝有缘人成功。', price: 35, originPrice: 150, category: '教材', condition: '九成新', cover: '📗', images: ['📗'], location: '2号宿舍楼', sellerName: '孙同学', sellerVerified: true, sellerCredit: '成交6笔·好评96%', status: '在售' }
];

// 若集合不存在则创建（忽略已存在错误）
async function ensureCollection(name) {
  try { await db.createCollection(name); } catch (e) { /* 已存在 */ }
}

exports.main = async () => {
  const collections = ['users', 'items', 'chats', 'messages', 'trades', 'authRecords', 'authCodes', 'reports'];
  for (const c of collections) await ensureCollection(c);

  // 清空旧演示商品（仅清 seed 标记的）后重新写入
  try {
    await db.collection('items').where({ _seed: true }).remove();
  } catch (e) {}

  let count = 0;
  for (const it of ITEMS) {
    await db.collection('items').add({
      data: Object.assign({ _seed: true, createdAt: db.serverDate() }, it)
    });
    count++;
  }
  return { ok: true, collections, itemsInserted: count };
};
