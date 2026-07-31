// cloudfunctions/authEmail/index.js
// 校园邮箱验证码（v0.3.0：验证码改为服务端生成/存储/校验，前端不再本地生成）
//
// action = 'send'   参数 { email }         生成 6 位验证码存入 authCodes（5 分钟有效、60 秒限频）。
//                                          若配置了 SMTP 环境变量则真实发邮件；未配置则在返回值中
//                                          携带 devCode（演示模式），便于未接邮箱服务时跑通流程。
// action = 'verify' 参数 { email, code }   服务端校验验证码，成功后把当前用户 users.authLevel 升为 1
//                                          并绑定邮箱，同时将该验证码标记为已使用。
//
// SMTP 配置方式：云函数「环境变量」中设置 SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const EMAIL_RE = /^[\w.\-]+@([\w\-]+\.)*edu\.cn$/i;
const EXPIRE_MS = 5 * 60 * 1000;   // 验证码有效期 5 分钟
const RESEND_MS = 60 * 1000;       // 同一用户发送间隔 ≥ 60 秒

function genCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
  return s;
}

// 未配置 SMTP 时返回 false（演示模式）
async function sendMail(email, code) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return false;
  const nodemailer = require('nodemailer');
  const port = Number(SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST, port, secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  await transporter.sendMail({
    from: `"校园集市" <${SMTP_USER}>`,
    to: email,
    subject: '校园集市 · 邮箱验证码',
    text: `你的验证码是 ${code}，5 分钟内有效。若非本人操作请忽略本邮件。`
  });
  return true;
}

async function actionSend(openid, email) {
  // 限频：60 秒内不允许重复发送
  const recent = await db.collection('authCodes')
    .where({ openid }).orderBy('createdAt', 'desc').limit(1).get();
  if (recent.data.length && Date.now() - recent.data[0].createdAt < RESEND_MS) {
    return { ok: false, msg: '发送太频繁，请 1 分钟后再试' };
  }

  const code = genCode();
  await db.collection('authCodes').add({
    data: {
      openid, email, code, used: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + EXPIRE_MS
    }
  });

  let mailed = false;
  try { mailed = await sendMail(email, code); }
  catch (e) { console.warn('[authEmail] 发信失败，转演示模式：', e.message || e); }

  if (mailed) return { ok: true, mailed: true, msg: '验证码已发送到邮箱' };
  // 演示模式：未配置 SMTP，直接把验证码带回（生产环境务必配置 SMTP，勿返回验证码）
  return { ok: true, mailed: false, devCode: code, msg: '未配置邮件服务，返回演示验证码' };
}

async function actionVerify(openid, email, code) {
  if (!code) return { ok: false, msg: '请输入验证码' };
  const res = await db.collection('authCodes')
    .where({ openid, email, code, used: false })
    .orderBy('createdAt', 'desc').limit(1).get();
  if (!res.data.length) return { ok: false, msg: '验证码不正确' };

  const rec = res.data[0];
  if (Date.now() > rec.expiresAt) return { ok: false, msg: '验证码已过期，请重新获取' };

  await db.collection('authCodes').doc(rec._id).update({ data: { used: true } });

  // 升级用户认证等级：邮箱已验证 = level 1（若已是 2 则不降级）
  const users = db.collection('users');
  const u = await users.where({ _openid: openid }).limit(1).get();
  if (u.data.length) {
    const level = Math.max(u.data[0].authLevel || 0, 1);
    await users.doc(u.data[0]._id).update({ data: { authLevel: level, email } });
    return { ok: true, authLevel: level };
  }
  await users.add({ data: { _openid: openid, authLevel: 1, email, createdAt: db.serverDate() } });
  return { ok: true, authLevel: 1 };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { action, email = '', code = '' } = event || {};
  if (!OPENID) return { ok: false, msg: '未获取到用户身份' };
  if (!EMAIL_RE.test(email)) return { ok: false, msg: '请输入正确的校园邮箱（edu.cn 后缀）' };

  try {
    if (action === 'send') return await actionSend(OPENID, email);
    if (action === 'verify') return await actionVerify(OPENID, email, code);
    return { ok: false, msg: '未知操作' };
  } catch (e) {
    console.error('[authEmail]', e);
    return { ok: false, msg: '服务异常，请稍后再试' };
  }
};
