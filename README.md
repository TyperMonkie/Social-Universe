# PersonaVerse

一个独立的个人粒子宇宙原型。输入文字、帖子、兴趣和歌曲后，服务端先生成 **Universe DNA**，再把它编译成经过校验的 **RenderSpec**；浏览器用项目自有的 Three.js / React Three Fiber 粒子渲染器生成可交互星球。旧 Genesis 仓库只作为参考，本项目不依赖它的代码或服务。

## 本地运行

需要 Node.js 24 和 npm。首次运行：

```powershell
git clone https://github.com/TyperMonkie/Social-Universe.git
cd Social-Universe
npm install
npm run dev -- -p 3010 -H 127.0.0.1
```

打开 `http://127.0.0.1:3010/`。如果端口被占用，换一个空闲端口。页面无需 AI 密钥即可探索示例星球、散开和回聚粒子、导出或导入宇宙 JSON。

生成个人宇宙需要服务端 MuzeAI 密钥。Windows 开发机默认从当前用户的 `.codex/config.toml` 中读取 `model_providers.muzeai.experimental_bearer_token`；其他环境可在未提交的 `.env.local` 里配置 `MUZEAI_API_KEY`。浏览器端不会获取密钥。工作流使用固定的 `gpt-6-sol` 和 MuzeAI Responses API。

## 数据与渲染

- `src/lib/contracts.ts` 定义输入、Universe DNA、RenderSpec 和导出格式。
- `src/app/api/generate/route.ts` 接收输入，服务端分两步生成并校验结果。
- `src/lib/creative-expression.ts` 只允许受限的纯 GLSL 浮点表达式；编译失败时客户端回退到安全着色器。
- `src/components/renderer` 中的粒子缓冲区由固定 seed 一次生成，GPU 负责每帧运动、交互和散开/回聚；支持球形、混合形和星云形。
- 导出 JSON 保存 seed、RenderSpec、可选输入及 DNA。导入时再次校验 RenderSpec 和自由表达式。

图片理解接口已经在输入契约中预留，当前版本不上传或理解图片。公开分享链接和 Nai Frog 伙伴也尚未实现。

## 检查

```powershell
npm run typecheck
npm run lint
npm run build
npm test
```

部署到公共网络前，给 `/api/generate` 增加身份验证、配额和限流，避免任何访问者消耗模型额度。
