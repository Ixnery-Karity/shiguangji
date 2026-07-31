# 拾光集（ShiGuangJi）· 项目协作约定

校园二手交易平台（微信小程序 MVP + 产品文档 + 原型）。项目背景与交付物见 `README.md`。

## 工作流约定（必须遵守）

1. **文档同步**：每一次有意义的产出（代码、原型、文档、决策）完成后，必须同步整理文档：
   - 功能/结构变化 → 更新 `README.md`（目录结构、交付物一览）与 `miniprogram/README.md`（如涉及小程序）。
   - 版本级变更 → 在 `CHANGELOG.md` 顶部新增版本条目（语义化版本，含 Added / Changed / Fixed 分节）。
2. **GitHub 推送**：每一次有意义的更新须提交并推送到 GitHub：
   - 仓库：https://github.com/Ixnery-Karity/shiguangji （原名 shopping_software）
   - 提交信息用中文，简述“为什么”而非“做了什么”。
3. **验证**：改动小程序 JS 后运行 `node --check` 校验语法；JSON 用 `python -m json.tool` 校验。

## 关键产品决策（勿违背）

- 仅限本校在校学生，强认证（校园邮箱 + 学生证审核）。
- 平台只做信息撮合，**线下当面交易**，不经手货款、不做线上支付。
- 第一版为微信小程序（原生 + 云开发），二期再做安卓 App。
- 小程序在无云环境下必须保留 mock 回退，保证零配置可预览。

## 目录速览

- `docs/` 产品文档（问卷、PRD，docx 由 `scripts/` 下 Python 脚本生成）
- `prototypes/` HTML 低保真原型与流程图
- `miniprogram/` 微信小程序工程（前端 + 云函数）
- `campus_secondhand_v*.zip` 历史版本归档（git 托管后不再新增，改用 git tag）
