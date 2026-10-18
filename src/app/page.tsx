"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent } from "react";
import {
  profileInputSchema,
  renderSpecSchema,
  universeDnaSchema,
  type ProfileInput,
  type RenderSpec,
  type UniverseDNA,
  type UniverseDocument,
} from "@/lib/contracts";
import { defaultSpec } from "@/lib/default-spec";
import { validateCreativeExpression } from "@/lib/creative-expression";

const UniverseScene = dynamic(() => import("@/components/UniverseScene"), {
  ssr: false,
  loading: () => <div className="scene-loading">正在点亮粒子宇宙…</div>,
});

type MusicDraft = { title: string; artist: string };

const exampleProfile = {
  description: "我喜欢在深夜写东西，收集城市里微小的光。对未知总有一点好奇，也需要一个安静的角落。",
  posts: ["有时候觉得每一盏窗灯都是一颗离我们很近的星星。"],
  interests: ["天文", "电子音乐", "摄影"],
  music: [{ title: "Space Song", artist: "Beach House" }],
};

function errorMessage(value: unknown, fallback: string) {
  if (value instanceof Error && value.message) return value.message;
  return fallback;
}

export default function Home() {
  const [description, setDescription] = useState("");
  const [posts, setPosts] = useState([""]);
  const [interests, setInterests] = useState<string[]>([]);
  const [interestDraft, setInterestDraft] = useState("");
  const [music, setMusic] = useState<MusicDraft[]>([{ title: "", artist: "" }]);
  const [spec, setSpec] = useState<RenderSpec>(defaultSpec);
  const [dna, setDna] = useState<UniverseDNA | null>(null);
  const [sourceInput, setSourceInput] = useState<ProfileInput | undefined>();
  const [burst, setBurst] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shaderStatus, setShaderStatus] = useState<"ok" | "fallback">("ok");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  function addInterests(raw: string) {
    const next = raw
      .split(/[,，、\n]/)
      .map((item) => item.trim().slice(0, 80))
      .filter(Boolean);
    if (!next.length) return;
    setInterests((current) => {
      const updated = [...current];
      for (const item of next) {
        if (updated.length >= 20) break;
        if (!updated.some((existing) => existing.toLocaleLowerCase() === item.toLocaleLowerCase())) {
          updated.push(item);
        }
      }
      return updated;
    });
    setInterestDraft("");
  }

  function onInterestKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === "，") {
      event.preventDefault();
      addInterests(interestDraft);
    }
  }

  function useExample() {
    setDescription(exampleProfile.description);
    setPosts(exampleProfile.posts);
    setInterests(exampleProfile.interests);
    setInterestDraft("");
    setMusic(exampleProfile.music);
    setError("");
    setNotice("示例资料已填入，点击「生成我的宇宙」即可体验完整流程。");
  }

  async function generate() {
    const inputResult = profileInputSchema.safeParse({
      description: description.trim(),
      posts: posts.map((post) => post.trim()).filter(Boolean),
      interests: [...interests, ...interestDraft.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean)],
      music: music.map((track) => ({ title: track.title.trim(), artist: track.artist.trim() })).filter((track) => track.title),
    });

    if (!inputResult.success) {
      setError("输入内容超出长度限制，请缩短描述、帖子或标签后重试。");
      return;
    }
    const input = inputResult.data;
    if (!input.description && !input.posts.length && !input.interests.length && !input.music.length) {
      setError("先写一点关于你的内容，或点击「试用示例资料」。");
      return;
    }

    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const raw: unknown = await response.json().catch(() => null);
      const result = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      if (!response.ok) {
        const apiError = result.error && typeof result.error === "object" ? result.error as Record<string, unknown> : null;
        throw new Error(typeof apiError?.message === "string" ? apiError.message : `生成失败（HTTP ${response.status}）`);
      }
      const parsedDna = universeDnaSchema.safeParse(result.dna);
      const parsedSpec = renderSpecSchema.safeParse(result.spec);
      if (!parsedDna.success || !parsedSpec.success) {
        throw new Error("生成结果格式不完整，请重试一次。");
      }
      setDna(parsedDna.data);
      setSpec(parsedSpec.data);
      setSourceInput(input);
      setBurst(false);
      setShaderStatus("ok");
      setNotice("宇宙已生成。拖动探索，或让粒子散开看看内部结构。");
    } catch (cause) {
      setError(errorMessage(cause, "生成失败，请稍后重试。"));
    } finally {
      setPending(false);
    }
  }

  function exportUniverse() {
    const document: UniverseDocument = {
      format: "personaverse-universe",
      version: 1,
      input: sourceInput,
      dna: dna ?? undefined,
      spec,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }));
    const link = documentCreateLink(url, `personaverse-${spec.seed}.json`);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("宇宙 JSON 已导出；同一配置与 seed 可以重现这颗星球。");
    setError("");
  }

  function applyImportedUniverse(raw: unknown) {
    if (!raw || typeof raw !== "object") throw new Error("JSON 内容不是有效的宇宙配置。");
    const object = raw as Record<string, unknown>;
    const parsedSpec = renderSpecSchema.safeParse(object.spec ?? raw);
    if (!parsedSpec.success) throw new Error("RenderSpec 校验失败：文件版本或参数不符合当前渲染器要求。");
    if (!validateCreativeExpression(parsedSpec.data.creative.displacement)) {
      throw new Error("创意粒子表达式未通过校验，已拒绝导入这个宇宙 JSON。");
    }
    const parsedDna = universeDnaSchema.safeParse(object.dna);
    const parsedInput = profileInputSchema.safeParse(object.input);
    setSpec(parsedSpec.data);
    setDna(parsedDna.success ? parsedDna.data : null);
    setSourceInput(parsedInput.success ? parsedInput.data : undefined);
    if (parsedInput.success) {
      setDescription(parsedInput.data.description);
      setPosts(parsedInput.data.posts.length ? parsedInput.data.posts : [""]);
      setInterests(parsedInput.data.interests);
      setMusic(parsedInput.data.music.length ? parsedInput.data.music : [{ title: "", artist: "" }]);
      setInterestDraft("");
    }
    setBurst(false);
    setShaderStatus("ok");
    setNotice(`已导入「${parsedSpec.data.name}」，seed ${parsedSpec.data.seed}。`);
    setImportOpen(false);
    setImportText("");
  }

  function importPastedUniverse() {
    setError("");
    setNotice("");
    try {
      if (importText.length > 1_000_000) throw new Error("JSON 内容过大，请缩短至 1 MB 以下。");
      applyImportedUniverse(JSON.parse(importText));
    } catch (cause) {
      setError(errorMessage(cause, "导入失败，请检查 JSON 内容。"));
    }
  }

  async function importUniverse(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    try {
      if (file.size > 1_000_000) throw new Error("文件过大，请选择小于 1 MB 的宇宙 JSON。");
      applyImportedUniverse(JSON.parse(await file.text()));
    } catch (cause) {
      setError(errorMessage(cause, "导入失败，请检查 JSON 文件。"));
    }
  }

  return (
    <div className="workspace">
      <header className="topbar">
        <div className="brand" aria-label="PersonaVerse">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <div><strong>PersonaVerse</strong><small>把个人故事，变成一座宇宙</small></div>
        </div>
        <div className="topbar-center"><span className="signal-dot" /> 粒子宇宙工作台 <span className="topbar-divider" /> 实时互动预览</div>
        <div className="topbar-right"><span className="version-pill">PROTOTYPE 01</span></div>
      </header>

      <div className="workspace-grid">
        <aside className="input-panel" aria-label="个人资料输入">
          <div className="panel-intro">
            <p className="eyebrow"><span>01</span> / 你的宇宙从这里开始</p>
            <h1>说说你是谁<span className="heading-spark">✦</span></h1>
            <p>留下一些文字、兴趣和音乐。AI 会先理解你的气质，再把它变成可以探索的粒子星球。</p>
          </div>

          <div className="form-stack">
            <div className="field-block">
              <div className="field-heading"><label htmlFor="description">关于你</label><span>自由描述</span></div>
              <textarea
                id="description"
                className="text-input main-description"
                placeholder="你喜欢什么？最近在想什么？你希望这座宇宙是什么感觉？"
                maxLength={4000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <div className="field-footnote">不必写得完整，几句话就可以开始。</div>
            </div>

            <div className="field-block">
              <div className="field-heading"><label>你的帖子</label><span>{posts.filter((post) => post.trim()).length} / 12</span></div>
              <div className="repeat-list">
                {posts.map((post, index) => (
                  <div className="repeat-row" key={index}>
                    <textarea
                      className="text-input post-input"
                      aria-label={`帖子 ${index + 1}`}
                      placeholder={index === 0 ? "粘贴一条你写过的话，或此刻想说的话…" : "再写一条…"}
                      maxLength={1000}
                      value={post}
                      onChange={(event) => setPosts((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                    />
                    {posts.length > 1 && <button className="icon-button remove-row" type="button" aria-label={`删除帖子 ${index + 1}`} onClick={() => setPosts((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
                  </div>
                ))}
              </div>
              <button className="inline-add" type="button" disabled={posts.length >= 12} onClick={() => setPosts((current) => [...current, ""])}><span>＋</span> 添加一条帖子</button>
            </div>

            <div className="field-block">
              <div className="field-heading"><label htmlFor="interest">兴趣标签</label><span>{interests.length} / 20</span></div>
              <div className="tag-entry">
                <input id="interest" className="text-input" placeholder="输入兴趣，按回车添加" maxLength={80} value={interestDraft} onChange={(event) => setInterestDraft(event.target.value)} onKeyDown={onInterestKeyDown} />
                <button type="button" aria-label="添加兴趣" disabled={!interestDraft.trim() || interests.length >= 20} onClick={() => addInterests(interestDraft)}>＋</button>
              </div>
              {interests.length > 0 && <div className="tag-list">{interests.map((interest) => <span className="interest-tag" key={interest}>{interest}<button type="button" aria-label={`移除 ${interest}`} onClick={() => setInterests((current) => current.filter((item) => item !== interest))}>×</button></span>)}</div>}
            </div>

            <div className="field-block">
              <div className="field-heading"><label>正在循环的歌</label><span>{music.filter((track) => track.title.trim()).length} / 12</span></div>
              <div className="repeat-list music-list">
                {music.map((track, index) => (
                  <div className="music-row" key={index}>
                    <span className="music-note" aria-hidden="true">♫</span>
                    <input className="text-input" aria-label={`歌曲 ${index + 1} 的标题`} placeholder="歌曲标题" maxLength={120} value={track.title} onChange={(event) => setMusic((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, title: event.target.value } : value))} />
                    <input className="text-input" aria-label={`歌曲 ${index + 1} 的歌手`} placeholder="歌手" maxLength={120} value={track.artist} onChange={(event) => setMusic((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, artist: event.target.value } : value))} />
                    {music.length > 1 && <button className="icon-button" type="button" aria-label={`删除歌曲 ${index + 1}`} onClick={() => setMusic((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
                  </div>
                ))}
              </div>
              <button className="inline-add" type="button" disabled={music.length >= 12} onClick={() => setMusic((current) => [...current, { title: "", artist: "" }])}><span>＋</span> 添加一首歌</button>
            </div>

            <div className="image-future"><span className="image-future-icon">◇</span><div><strong>图像理解</strong><small>照片与视觉素材，即将加入这段旅程</small></div><span className="soon-badge">SOON</span></div>
          </div>

          <div className="submit-area">
            {error && <p className="feedback error" role="alert">{error}</p>}
            {notice && <p className="feedback notice" role="status">{notice}</p>}
            <button className="generate-button" type="button" disabled={pending} onClick={generate}>
              <span className="generate-icon" aria-hidden="true">✦</span>
              <span>{pending ? "正在理解并构建你的宇宙…" : "生成我的宇宙"}</span>
              <span className="button-arrow" aria-hidden="true">↗</span>
            </button>
            <button className="example-button" type="button" onClick={useExample}>还没想好写什么？试用示例资料</button>
          </div>
        </aside>

        <main className="preview-column">
          <section className="universe-stage" aria-label="可交互的粒子星球" style={{ "--stage-bg": spec.palette.background } as CSSProperties}>
            <div className="scene-viewport"><UniverseScene spec={spec} burst={burst} onShaderStatus={setShaderStatus} /></div>
            <div className="stage-topline">
              <span className="stage-live"><span className="signal-dot" /> LIVE CANVAS</span>
              <span className="seed-label">SEED <strong>{spec.seed}</strong></span>
            </div>
            <div className="stage-side-label">PERSONAL UNIVERSE · 001</div>
            <div className="stage-bottom">
              <div className="stage-title">
                <span className="eyebrow">{dna ? "你的专属宇宙" : "可互动的示例宇宙"}</span>
                <h2>{spec.name}</h2>
                <p>{spec.tagline}</p>
              </div>
              <div className="stage-tools">
                <button className={`burst-button ${burst ? "is-active" : ""}`} type="button" aria-pressed={burst} onClick={() => setBurst((current) => !current)}><span aria-hidden="true">{burst ? "↺" : "✳"}</span>{burst ? "让粒子回聚" : "让粒子散开"}</button>
                <div className="file-actions">
                  <button type="button" onClick={exportUniverse}>导出 JSON <span aria-hidden="true">↓</span></button>
                  <button type="button" onClick={() => { setImportOpen(true); setError(""); }}>导入宇宙 <span aria-hidden="true">↑</span></button>
                  <input ref={importRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={importUniverse} aria-label="导入宇宙 JSON 文件" />
                </div>
              </div>
            </div>
            <div className="stage-hint">拖动旋转 · 滚轮缩放 · 点击粒子探索</div>
          </section>

          {importOpen && (
            <div className="import-overlay" role="presentation" onClick={() => { setImportOpen(false); setError(""); }}>
              <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title" onClick={(event) => event.stopPropagation()}>
                <div className="import-title-row"><div><p className="eyebrow">RECALL A UNIVERSE</p><h2 id="import-title">导入你的宇宙</h2></div><button type="button" aria-label="关闭导入窗口" onClick={() => { setImportOpen(false); setError(""); }}>×</button></div>
                <p>选择先前导出的 JSON 文件，或把 JSON 内容粘贴在下方。配置与 seed 会恢复同一颗星球。</p>
                <button className="choose-file-button" type="button" onClick={() => importRef.current?.click()}>↑ 选择 JSON 文件</button>
                <div className="import-separator">或粘贴 JSON</div>
                <textarea className="text-input import-textarea" aria-label="粘贴宇宙 JSON" placeholder="{ &quot;format&quot;: &quot;personaverse-universe&quot;, ... }" value={importText} onChange={(event) => setImportText(event.target.value)} />
                {error && <p className="feedback error" role="alert">{error}</p>}
                <button className="import-submit" type="button" disabled={!importText.trim()} onClick={importPastedUniverse}>载入这颗宇宙</button>
              </section>
            </div>
          )}

          <section className="dna-panel" aria-labelledby="dna-heading">
            <div className="dna-heading-row"><div><p className="eyebrow"><span>02</span> / AI 解读</p><h2 id="dna-heading">Universe DNA</h2></div><span className={`dna-state ${dna ? "is-ready" : ""}`}>{dna ? "已生成" : "等待输入"}</span></div>
            {dna ? (
              <div className="dna-content">
                <div className="dna-story"><p className="dna-tagline">“{dna.tagline}”</p><p>{dna.story}</p><div className="dna-metaphor"><span>视觉隐喻</span>{dna.visualMetaphor}</div></div>
                <div className="dna-details"><div className="dna-traits">{dna.traits.map((trait) => <span key={trait}>{trait}</span>)}</div><div className="dna-tone"><span>情绪底色</span><strong>{dna.emotionalTone}</strong></div><div className="dna-meter"><div><span>能量</span><strong>{Math.round(dna.energy * 100)}%</strong></div><span className="meter-track"><span style={{ width: `${dna.energy * 100}%` }} /></span></div><div className="dna-meter"><div><span>开放度</span><strong>{Math.round(dna.openness * 100)}%</strong></div><span className="meter-track"><span style={{ width: `${dna.openness * 100}%` }} /></span></div></div>
              </div>
            ) : (
              <div className="dna-empty"><span className="empty-sigil" aria-hidden="true">✧</span><div><strong>每个人都有自己的宇宙纹理。</strong><p>填入左侧内容后，这里会出现 AI 对你气质的理解；上方的示例星球现在就可以拖动和散开。</p></div></div>
            )}
            {spec.creative.displacement && <p className={`shader-note ${shaderStatus === "fallback" ? "is-fallback" : ""}`}>{shaderStatus === "fallback" ? "创意位移片段未通过校验，场景已安全回退。" : "此宇宙包含一段 AI 创作的粒子位移表达式。"}</p>}
          </section>
          <footer className="workspace-footer"><span>PERSONAVERSE / 把自己变成宇宙</span><span>同一 RenderSpec + Seed 可以重现相同的星球</span></footer>
        </main>
      </div>
    </div>
  );
}

function documentCreateLink(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  return link;
}
